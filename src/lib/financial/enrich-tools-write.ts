import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';
import { resolveRecurrenceGroupId } from './recurrence';

// Ported from transaction-manager's packages/jobs/src/enrich-tools-write.ts,
// collapsed to ONE mutation tool. The source splits write_rule / remember /
// ask_user (structure vs. personal knowledge vs. "ask the user") — this port
// drops memories and the ask-the-user queue (single-user scale, no UI for a
// question inbox) and keeps only the rule half, folded into the same call
// that classifies the group. classify_signature_group doubles as the
// "final answer" a structured runAgent() would otherwise provide: su-gachu's
// ModelProvider.call() only supports a free-running tool loop, so the loop
// ends naturally once the model calls this and stops.
//
// A `contains` pattern shorter than this matches half the feed — kept from
// the source's own hard-won guardrail (a 3-character seeded rule, "FEE",
// once matched enough unrelated Romanian descriptions to become the user's
// top "recurring payee"). Counted in letters/digits, not raw characters.
const MIN_PATTERN_LETTERS = 4;
const significantLength = (pattern: string) => pattern.replace(/[^\p{L}\p{N}]/gu, '').length;

export interface EnrichWriteContext {
  supabase: SupabaseClient;
  userId: string;
  /** Every transaction id in the signature group being classified. */
  transactionIds: number[];
  /** The group's normalized description, used as the default rule pattern. */
  defaultPattern: string;
}

export const ENRICH_WRITE_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'classify_signature_group',
    description:
      'Record your decision for every transaction in this group. Call this exactly once, last.',
    parameters: {
      type: 'object',
      properties: {
        categoryName: { type: 'string', description: 'Existing or new category name to apply' },
        categoryKind: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        normalizedPayee: {
          type: 'string',
          description: "The merchant or counterparty in human form, e.g. 'Revolut Savings'",
        },
        isInternalTransfer: {
          type: 'boolean',
          description:
            'True only if this moves money between two accounts THIS user owns. Wrongly true erases real income from every total.',
        },
        isRecurring: { type: 'boolean' },
        isEssential: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
        writeRule: {
          type: 'boolean',
          description:
            'Set true only for a genuinely structural pattern (a merchant/scheme name that means the same thing every time), so future runs skip the model for this description.',
        },
        rulePattern: {
          type: 'string',
          description: "Uppercase substring to match on future descriptions, e.g. 'NETFLIX'. Defaults to this group's normalized description.",
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        rationale: { type: 'string', description: 'One sentence: what settled it, citing what you looked up' },
      },
      required: ['categoryName', 'categoryKind', 'normalizedPayee', 'isInternalTransfer', 'confidence', 'rationale'],
    },
  },
];

interface ClassifyArgs {
  categoryName: string;
  categoryKind: 'income' | 'expense' | 'transfer';
  normalizedPayee: string;
  isInternalTransfer: boolean;
  isRecurring?: boolean;
  isEssential?: boolean;
  tags?: string[];
  notes?: string;
  writeRule?: boolean;
  rulePattern?: string;
  confidence: number;
  rationale: string;
}

export interface EnrichWriteOutcome {
  classified: boolean;
  ruleWritten: boolean;
}

/**
 * Returns the executor plus a mutable outcome object, mirroring the
 * source's WriteToolOutcome — since su-gachu's ModelProvider.call() returns
 * only final text, this is how the caller learns whether the model actually
 * classified the group rather than giving up after investigating.
 */
export function createEnrichWriteExecutor(ctx: EnrichWriteContext): {
  executor: ToolExecutor;
  outcome: EnrichWriteOutcome;
} {
  const outcome: EnrichWriteOutcome = { classified: false, ruleWritten: false };

  const executor: ToolExecutor = async (name, rawArgs) => {
    if (name !== 'classify_signature_group') return `Tool '${name}' not found.`;
    const args = rawArgs as unknown as ClassifyArgs;

    try {
      const { data: existing, error: findError } = await ctx.supabase
        .from('categories')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('name', args.categoryName)
        .maybeSingle();
      if (findError) throw new Error(findError.message);

      let categoryId = existing?.id as number | undefined;
      if (!categoryId) {
        const { data: created, error: createError } = await ctx.supabase
          .from('categories')
          .insert({ user_id: ctx.userId, name: args.categoryName, kind: args.categoryKind })
          .select('id')
          .single();
        if (createError) throw new Error(createError.message);
        categoryId = created.id;
      }

      // An internal transfer is never recurring, whatever the model said —
      // a round-up sweep between the user's own accounts is not a subscription.
      const isRecurring = args.isInternalTransfer ? false : (args.isRecurring ?? false);
      const recurrenceGroupId = isRecurring
        ? await resolveRecurrenceGroupId(ctx.supabase, ctx.userId, args.normalizedPayee)
        : null;

      const update: Record<string, unknown> = {
        category_id: categoryId,
        normalized_payee: args.normalizedPayee,
        is_internal_transfer: args.isInternalTransfer,
        is_recurring: isRecurring,
        is_essential: args.isEssential ?? null,
        recurrence_group_id: recurrenceGroupId,
        enrichment_confidence: args.confidence,
        enrichment_rationale: args.rationale,
        enrichment_source: 'agent',
      };
      if (args.tags) update.tags = args.tags.join(', ');
      if (args.notes !== undefined) update.notes = args.notes;

      const { error: updateError } = await ctx.supabase
        .from('transactions')
        .update(update)
        .in('id', ctx.transactionIds)
        .eq('user_id', ctx.userId);
      if (updateError) throw new Error(updateError.message);
      outcome.classified = true;

      if (args.writeRule) {
        const pattern = (args.rulePattern ?? ctx.defaultPattern).trim().toUpperCase();
        if (significantLength(pattern) < MIN_PATTERN_LETTERS) {
          return JSON.stringify({
            classified: ctx.transactionIds.length,
            categoryId,
            ruleWritten: false,
            ruleSkippedReason: `A rule pattern needs at least ${MIN_PATTERN_LETTERS} letters or digits — "${pattern}" would match unrelated transactions.`,
          });
        }
        const { error: ruleError } = await ctx.supabase.from('merchant_rules').upsert(
          {
            user_id: ctx.userId,
            pattern,
            match_type: 'contains',
            category_id: categoryId,
            normalized_payee: args.normalizedPayee,
          },
          { onConflict: 'user_id,pattern,match_type' }
        );
        if (ruleError) throw new Error(ruleError.message);
        outcome.ruleWritten = true;
      }

      return JSON.stringify({
        classified: ctx.transactionIds.length,
        categoryId,
        ruleWritten: outcome.ruleWritten,
      });
    } catch (err) {
      return `Tool 'classify_signature_group' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  return { executor, outcome };
}
