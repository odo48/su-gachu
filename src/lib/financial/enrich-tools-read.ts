import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';
import { findTransferPairs } from './transfer-pairs';
import type { EnrichTx } from './signature';

// Ported from transaction-manager's packages/jobs/src/enrich-tools-read.ts:
// what the enrichment agent may LOOK AT. userId and the transaction window
// are bound here, before the model sees a tool definition — never an input
// the model can supply. Dropped `recall_memories` (no memories table in this
// port, see enrich-tools-write.ts).
export interface EnrichReadContext {
  supabase: SupabaseClient;
  userId: string;
  /** The user's recent-window transactions, for counter-leg pairing. */
  windowTxs: EnrichTx[];
}

export const ENRICH_READ_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'find_similar_transactions',
    description:
      "Search this user's own past transactions by description text, and see how each was categorized. Use this first: matching what was decided for the same merchant last time is more valuable than a fresh guess.",
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Substring of the description or payee to look for' },
        limit: { type: 'integer', description: 'Default 10, max 25' },
      },
      required: ['search'],
    },
  },
  {
    name: 'list_own_accounts',
    description:
      "List every bank account this user has connected, with its bank and currency. A movement between two of these is an internal transfer, not income and not spending.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_counter_leg',
    description:
      "Given a transaction id from the group you were given, look for the opposite leg of the same movement in this user's own feed — an entry in the opposite direction, on a different account, within a day. A match of kind 'exact' or 'fx' proves the transaction is an internal transfer. 'amount_only' means the amounts line up but the descriptions don't, which is suggestive and not proof.",
    parameters: {
      type: 'object',
      properties: { transactionId: { type: 'integer' } },
      required: ['transactionId'],
    },
  },
  {
    name: 'search_rules',
    description:
      'See which categorization rules already exist for this user whose pattern matches a description. Check before proposing a new rule — a rule that already covers the case does not need a second one.',
    parameters: {
      type: 'object',
      properties: { description: { type: 'string' } },
      required: ['description'],
    },
  },
];

export function matchesRule(normalizedDescription: string, pattern: string, matchType: string): boolean {
  if (matchType === 'exact') return normalizedDescription === pattern;
  if (matchType === 'contains') return normalizedDescription.includes(pattern);
  if (matchType === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(normalizedDescription);
    } catch {
      return false;
    }
  }
  return false;
}

export function createEnrichReadExecutor(ctx: EnrichReadContext): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'find_similar_transactions': {
          const { search, limit } = args as { search: string; limit?: number };
          const cap = Math.min(25, Math.max(1, limit ?? 10));
          const { data, error } = await ctx.supabase
            .from('transactions')
            .select(
              'remittance_information, amount, currency, credit_debit_indicator, booking_date, bank_transaction_code, creditor_name, debtor_name, normalized_payee, is_internal_transfer, enrichment_source, categories(name, kind)'
            )
            .eq('user_id', ctx.userId)
            .or(
              `creditor_name.ilike.%${search}%,debtor_name.ilike.%${search}%,remittance_information.ilike.%${search}%`
            )
            .order('booking_date', { ascending: false })
            .limit(cap);
          if (error) throw new Error(error.message);
          return JSON.stringify({ matches: data ?? [] });
        }
        case 'list_own_accounts': {
          const { data, error } = await ctx.supabase
            .from('accounts')
            .select('id, bank, currency, balance')
            .eq('user_id', ctx.userId);
          if (error) throw new Error(error.message);
          return JSON.stringify({ accounts: data ?? [] });
        }
        case 'check_counter_leg': {
          const { transactionId } = args as { transactionId: number };
          const pairs = findTransferPairs(ctx.windowTxs, [transactionId]);
          const pair = pairs.get(transactionId);
          return JSON.stringify(pair ? { found: true, pair } : { found: false });
        }
        case 'search_rules': {
          const { description } = args as { description: string };
          const normalized = description.toUpperCase();
          const { data, error } = await ctx.supabase
            .from('merchant_rules')
            .select('pattern, match_type, normalized_payee, categories(name, kind)')
            .eq('user_id', ctx.userId);
          if (error) throw new Error(error.message);
          const rows = (data ?? []).filter((rule) => matchesRule(normalized, rule.pattern, rule.match_type));
          return JSON.stringify({ rules: rows.slice(0, 10) });
        }
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
