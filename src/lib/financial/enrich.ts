import type { SupabaseClient } from '@supabase/supabase-js';
import { groupBySignature, normalizeDescription, type EnrichTx, type TransactionGroup } from './signature';
import { findTransferPairs, isConclusive } from './transfer-pairs';
import { classifyIncome } from './income';
import { matchesRule } from './enrich-tools-read';
import { enrichGroupWithAgent } from './enrich-agent';

// Ported from transaction-manager's packages/jobs/src/enrich.ts +
// enrich-group.ts, collapsed into one orchestrator since there's no
// queue/worker split here — this runs synchronously inside one route call,
// triggered by the "Categorizează" button.
//
// Cascade per group, cheapest/most-certain first: an existing rule, a
// conclusive transfer-pair match, an income keyword hit, and only then the
// LLM agent. Capped per invocation so one request finishes in a normal
// serverless timeout; the caller can call again for the rest.
const DEFAULT_WINDOW_DAYS = 90;
const MAX_GROUPS_PER_RUN = 30;
const MAX_LLM_CALLS_PER_RUN = 15;

export interface RunEnrichmentOptions {
  sinceDays?: number;
  transactionIds?: number[];
  provider?: string;
}

export interface RunEnrichmentResult {
  processedGroups: number;
  ruleHits: number;
  transferHits: number;
  incomeHits: number;
  llmCalls: number;
  remainingGroups: number;
  errors: string[];
}

interface Row {
  id: number;
  account_id: number;
  credit_debit_indicator: string;
  bank_transaction_code: string | null;
  remittance_information: string | null;
  amount: string | number;
  currency: string;
  booking_date: string;
  creditor_name: string | null;
  debtor_name: string | null;
  category_id: number | null;
}

function toEnrichTx(row: Row): EnrichTx {
  return {
    id: row.id,
    accountId: row.account_id,
    direction: row.credit_debit_indicator.toUpperCase() === 'DBIT' ? 'debit' : 'credit',
    code: row.bank_transaction_code,
    description: row.remittance_information ?? '',
    amount: Number(row.amount),
    currency: row.currency,
    date: row.booking_date,
    creditorName: row.creditor_name,
    debtorName: row.debtor_name,
  };
}

async function findOrCreateCategory(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  kind: 'income' | 'expense' | 'transfer'
): Promise<number> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();
  if (existing) return existing.id as number;

  const { data: created, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, kind })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return created.id as number;
}

export async function runEnrichment(
  supabase: SupabaseClient,
  userId: string,
  opts: RunEnrichmentOptions = {}
): Promise<RunEnrichmentResult> {
  const sinceDays = opts.sinceDays ?? DEFAULT_WINDOW_DAYS;
  const provider = opts.provider ?? 'claude';
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: jobRun } = await supabase
    .from('finance_job_runs')
    .insert({ user_id: userId, job_type: 'enrich', status: 'running' })
    .select('id')
    .single();

  const result: RunEnrichmentResult = {
    processedGroups: 0,
    ruleHits: 0,
    transferHits: 0,
    incomeHits: 0,
    llmCalls: 0,
    remainingGroups: 0,
    errors: [],
  };

  try {
    // Window used both as counter-leg candidate pool and as the target
    // scope — a simplification vs. the source's separate "whole history"
    // search, reasonable at personal-account transaction volumes.
    const { data: windowRows, error: windowError } = await supabase
      .from('transactions')
      .select(
        'id, account_id, credit_debit_indicator, bank_transaction_code, remittance_information, amount, currency, booking_date, creditor_name, debtor_name, category_id'
      )
      .eq('user_id', userId)
      .gte('booking_date', sinceIso);
    if (windowError) throw new Error(windowError.message);

    const windowTxs = (windowRows ?? []).map(toEnrichTx);

    const targetIds = opts.transactionIds
      ? new Set(opts.transactionIds)
      : new Set((windowRows ?? []).filter((r) => r.category_id === null).map((r) => r.id));
    const targets = windowTxs.filter((tx) => targetIds.has(tx.id));

    const groups = groupBySignature(targets);
    const toProcess = groups.slice(0, MAX_GROUPS_PER_RUN);
    result.remainingGroups = Math.max(0, groups.length - toProcess.length);

    const { data: rules } = await supabase
      .from('merchant_rules')
      .select('pattern, match_type, category_id, normalized_payee')
      .eq('user_id', userId);

    let llmCalls = 0;

    for (const group of toProcess) {
      try {
        const applied = await applyGroup(supabase, userId, group, windowTxs, rules ?? [], provider, llmCalls < MAX_LLM_CALLS_PER_RUN);
        result.processedGroups += 1;
        if (applied === 'rule') result.ruleHits += 1;
        else if (applied === 'transfer') result.transferHits += 1;
        else if (applied === 'income') result.incomeHits += 1;
        else if (applied === 'llm') {
          result.llmCalls += 1;
          llmCalls += 1;
        } else if (applied === 'llm_skipped') {
          result.remainingGroups += 1;
        }
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await supabase
      .from('finance_job_runs')
      .update({
        status: result.errors.length > 0 ? 'failed' : 'succeeded',
        items_processed: result.processedGroups,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobRun?.id);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('finance_job_runs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', jobRun?.id);
    throw err;
  }
}

type ApplyOutcome = 'rule' | 'transfer' | 'income' | 'llm' | 'llm_skipped' | 'none';

interface RuleRow {
  pattern: string;
  match_type: string;
  category_id: number;
  normalized_payee: string | null;
}

async function applyGroup(
  supabase: SupabaseClient,
  userId: string,
  group: TransactionGroup,
  windowTxs: EnrichTx[],
  rules: RuleRow[],
  provider: string,
  allowLlm: boolean
): Promise<ApplyOutcome> {
  const sample = group.transactions[0];
  const ids = group.transactions.map((t) => t.id);
  const normalized = normalizeDescription(sample.description);

  // 1. An existing rule.
  const rule = rules.find((r) => matchesRule(normalized, r.pattern, r.match_type));
  if (rule) {
    await supabase
      .from('transactions')
      .update({
        category_id: rule.category_id,
        normalized_payee: rule.normalized_payee ?? null,
        enrichment_source: 'rule',
        enrichment_confidence: 0.9,
      })
      .in('id', ids)
      .eq('user_id', userId);
    return 'rule';
  }

  // 2. A conclusive transfer-pair match (majority vote across the group's
  // transactions, since they all share one description pattern).
  const pairs = findTransferPairs(windowTxs, ids);
  const conclusiveCount = ids.filter((id) => {
    const pair = pairs.get(id);
    return pair && isConclusive(pair.kind);
  }).length;
  if (conclusiveCount > ids.length / 2) {
    const { data: transferCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Transfer intern')
      .maybeSingle();
    if (transferCategory) {
      await supabase
        .from('transactions')
        .update({
          category_id: transferCategory.id,
          is_internal_transfer: true,
          is_recurring: false,
          enrichment_source: 'rule',
          enrichment_confidence: 0.95,
        })
        .in('id', ids)
        .eq('user_id', userId);
      return 'transfer';
    }
  }

  // 3. Income keyword match — credit-direction groups only.
  if (sample.direction === 'credit') {
    const income = classifyIncome({
      direction: 'credit',
      description: sample.description,
      counterpartyName: sample.debtorName,
      isInternalTransfer: false,
    });
    if (income.categoryName && income.categoryKind) {
      const categoryId = await findOrCreateCategory(supabase, userId, income.categoryName, income.categoryKind);
      await supabase
        .from('transactions')
        .update({ category_id: categoryId, enrichment_source: 'rule', enrichment_confidence: income.confidence })
        .in('id', ids)
        .eq('user_id', userId);
      return 'income';
    }
  }

  // 4. The agent, investigating.
  if (!allowLlm) return 'llm_skipped';
  await enrichGroupWithAgent({ supabase, userId, provider, group, windowTxs });
  return 'llm';
}
