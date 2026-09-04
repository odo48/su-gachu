import type { SupabaseClient } from '@supabase/supabase-js';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { normalizeDescription, type EnrichTx, type TransactionGroup } from './signature';
import { ENRICH_READ_TOOL_SCHEMAS, createEnrichReadExecutor } from './enrich-tools-read';
import { ENRICH_WRITE_TOOL_SCHEMAS, createEnrichWriteExecutor, type EnrichWriteOutcome } from './enrich-tools-write';

// Ported from transaction-manager's packages/jobs/src/enrich-agent.ts: the
// model investigates before answering, once per signature group rather than
// once per transaction. Rules/transfer-pairs/income keywords are evidence
// handed to it via tools, not a gate in front of it — the rule cascade in
// enrich.ts only calls this when none of those settled the group on their
// own.
export interface EnrichAgentParams {
  supabase: SupabaseClient;
  userId: string;
  provider: string;
  group: TransactionGroup;
  /** The user's recent-window transactions, for check_counter_leg. */
  windowTxs: EnrichTx[];
}

export interface EnrichAgentOutcome {
  raw: string;
  writes: EnrichWriteOutcome;
}

export async function enrichGroupWithAgent(params: EnrichAgentParams): Promise<EnrichAgentOutcome> {
  const sample = params.group.transactions[0];
  const { executor: writeExecutor, outcome: writes } = createEnrichWriteExecutor({
    supabase: params.supabase,
    userId: params.userId,
    transactionIds: params.group.transactions.map((t) => t.id),
    defaultPattern: normalizeDescription(sample?.description ?? ''),
  });

  const { schemas, executor } = combineTools(
    {
      schemas: ENRICH_READ_TOOL_SCHEMAS,
      executor: createEnrichReadExecutor({
        supabase: params.supabase,
        userId: params.userId,
        windowTxs: params.windowTxs,
      }),
    },
    { schemas: ENRICH_WRITE_TOOL_SCHEMAS, executor: writeExecutor }
  );

  const provider = getProvider(params.provider);
  const raw = await provider.call(describeGroup(params.group), schemas, systemPrompt(), [], executor);

  return { raw, writes };
}

function describeGroup(group: TransactionGroup): string {
  const rows = group.transactions.slice(0, 20).map((tx) => ({
    id: tx.id,
    direction: tx.direction,
    code: tx.code,
    amount: tx.amount,
    currency: tx.currency,
    date: tx.date,
    creditor: tx.creditorName,
    debtor: tx.debtorName,
  }));
  return [
    `Signature: ${group.signature}`,
    `${group.transactions.length} transaction(s) share this pattern (showing up to 20):`,
    JSON.stringify(rows, null, 2),
  ].join('\n');
}

/**
 * Guardrails first, ARCHITECTURE.md-style ordering — nothing user-influenced
 * appears before the rules that constrain the model's behavior.
 */
function systemPrompt(): string {
  return [
    "You categorize bank transactions for one user's personal finance app.",
    '',
    'You are given a GROUP of transactions that share a description pattern, not a single row. Decide once; your answer is applied to all of them.',
    '',
    'Investigate before answering. You have tools to search this user\'s own transaction history, list their accounts, find the opposite leg of a movement, and read existing rules. A decision that matches what was decided for the same description last time is worth more than a fresh guess.',
    '',
    "INTERNAL TRANSFERS matter more than anything else here. A movement between two accounts the user owns is neither income nor spending. Use check_counter_leg first: a match of kind 'exact' or 'fx' is proof. 'amount_only' is NOT proof — amounts agreeing while descriptions differ is also what paying a friend and separately being paid by someone else looks like on the same day. Wrongly calling real income a transfer silently deletes it from the user's totals, which is worse than missing a transfer.",
    '',
    "MONEY ARRIVING that is not a transfer and not a refund is `income`. Prefer an existing income category over creating a near-duplicate.",
    '',
    'When a description pattern structurally means one category for anyone (a merchant name, a scheme name), set writeRule=true so future runs skip the model for it. Do NOT write a rule when the meaning depends on something personal about this user — just answer this group and leave the next one to be asked fresh.',
    '',
    'CONFIDENCE is a real estimate, not a formality: ~0.95 when a structural fact settled it (a counter-leg match, an existing rule, an unmistakable merchant name), ~0.7 when the description is clear but nothing corroborates it, ~0.4 when you are reading between the lines.',
    '',
    'Finish by calling classify_signature_group exactly once.',
    'Always respond in Romanian in any free text, but tool arguments (category names, rule patterns) may stay as written.',
  ].join('\n');
}
