import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../../ai/types';
import { getProvider } from '../../ai/registry';
import { combineTools } from '../../ai/combine-tools';

// Ported from transaction-manager's packages/email-ingestion/src/analyze.ts
// (pass 3 of 3): the analyzer reads the full body of a message screening
// selected and can cross-reference the bank feed before deciding — a
// receipt whose amount and date match a transaction is a receipt *for* that
// transaction. Final answer is the mutation tool save_email_classification,
// same "last tool call ends the loop" pattern as enrich-agent.ts, since
// su-gachu's ModelProvider.call() has no structured runAgent()/finalTool.
const CATEGORIES = ['receipt', 'refund_promise', 'subscription_confirmation', 'trial_ending', 'shipping', 'irrelevant'] as const;
export type EmailCategory = (typeof CATEGORIES)[number];

export interface EmailAnalysisResult {
  category: EmailCategory;
  extractedFields: Record<string, unknown>;
  confidence: number;
  rationale: string | null;
}

interface AnalyzeParams {
  supabase: SupabaseClient;
  userId: string;
  provider: string;
  emailId: number;
  subject: string;
  fromAddress: string;
  toAddress: string | null;
  receivedAt: string;
  body: string;
}

const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'find_matching_transactions',
    description:
      "Search the user's bank transactions for ones this email could correspond to — by amount, by merchant name, and within a date window. Use it to tell a receipt for a real charge from a marketing email quoting a price, and to see whether a promised refund has already landed.",
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: "Plain number, no currency symbol, e.g. '42.50'" },
        currency: { type: 'string', description: "ISO code, e.g. 'RON'" },
        merchant: { type: 'string', description: 'Substring of the payee or description' },
        direction: { type: 'string', enum: ['debit', 'credit'] },
        dateFrom: { type: 'string', description: 'ISO date, defaults to 14 days before the email' },
        dateTo: { type: 'string', description: "ISO date, defaults to the email's own date" },
      },
    },
  },
  {
    name: 'find_similar_emails',
    description: 'See how earlier emails from the same sender were classified. A sender that has produced ten receipts is very likely producing an eleventh.',
    parameters: {
      type: 'object',
      properties: { fromAddress: { type: 'string', description: 'Sender address or a substring of it' } },
      required: ['fromAddress'],
    },
  },
  {
    name: 'save_email_classification',
    description: "Record this email's category and what you extracted. Call once, last.",
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: CATEGORIES as unknown as string[] },
        merchant: { type: 'string' },
        amount: { type: 'string', description: "Plain number, '.' as the decimal separator" },
        currency: { type: 'string', description: "ISO code; 'lei' is RON" },
        expectedByDate: { type: 'string', description: 'ISO YYYY-MM-DD' },
        matchedTransactionId: { type: 'integer' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        rationale: { type: 'string', description: 'One sentence: what settled it, citing what you looked up' },
      },
      required: ['category', 'confidence', 'rationale'],
    },
  },
];

const DEFAULT_DATE_WINDOW_DAYS = 14;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function analyzeEmail(params: AnalyzeParams): Promise<EmailAnalysisResult | null> {
  let outcome: EmailAnalysisResult | null = null;

  const readExecutor: ToolExecutor = async (name, args) => {
    try {
      if (name === 'find_matching_transactions') {
        const a = args as {
          amount?: string;
          currency?: string;
          merchant?: string;
          direction?: 'debit' | 'credit';
          dateFrom?: string;
          dateTo?: string;
        };
        const anchor = new Date(params.receivedAt);
        const defaultFrom = new Date(anchor.getTime() - DEFAULT_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        let query = params.supabase
          .from('transactions')
          .select('id, remittance_information, amount, currency, credit_debit_indicator, booking_date, normalized_payee')
          .eq('user_id', params.userId)
          .gte('booking_date', a.dateFrom ?? isoDate(defaultFrom))
          .lte('booking_date', a.dateTo ?? isoDate(anchor));
        if (a.amount) query = query.eq('amount', a.amount);
        if (a.currency) query = query.eq('currency', a.currency);
        if (a.direction) query = query.eq('credit_debit_indicator', a.direction === 'debit' ? 'DBIT' : 'CRDT');
        if (a.merchant) {
          query = query.or(
            `remittance_information.ilike.%${a.merchant}%,normalized_payee.ilike.%${a.merchant}%`
          );
        }
        const { data, error } = await query.order('booking_date', { ascending: false }).limit(10);
        if (error) throw new Error(error.message);
        return JSON.stringify({ transactions: data ?? [] });
      }

      if (name === 'find_similar_emails') {
        const { fromAddress } = args as { fromAddress: string };
        const { data, error } = await params.supabase
          .from('gmail_emails')
          .select('subject, received_at, screening, gmail_email_classifications(category, confidence)')
          .eq('user_id', params.userId)
          .ilike('from_address', `%${fromAddress}%`)
          .neq('id', params.emailId)
          .order('received_at', { ascending: false })
          .limit(10);
        if (error) throw new Error(error.message);
        return JSON.stringify({ emails: data ?? [] });
      }

      if (name === 'save_email_classification') {
        const a = args as {
          category: EmailCategory;
          merchant?: string;
          amount?: string;
          currency?: string;
          expectedByDate?: string;
          matchedTransactionId?: number;
          confidence: number;
          rationale: string;
        };
        const extractedFields = Object.fromEntries(
          Object.entries({
            merchant: a.merchant,
            amount: a.amount,
            currency: a.currency,
            expectedByDate: a.expectedByDate,
            matchedTransactionId: a.matchedTransactionId,
          }).filter(([, v]) => v != null)
        );

        const { error } = await params.supabase.from('gmail_email_classifications').upsert(
          {
            email_id: params.emailId,
            user_id: params.userId,
            category: a.category,
            extracted_fields: extractedFields,
            confidence: a.confidence,
            rationale: a.rationale,
          },
          { onConflict: 'email_id' }
        );
        if (error) throw new Error(error.message);
        await params.supabase
          .from('gmail_emails')
          .update({ analyzed_at: new Date().toISOString() })
          .eq('id', params.emailId);

        outcome = { category: a.category, extractedFields, confidence: a.confidence, rationale: a.rationale };
        return JSON.stringify({ saved: true });
      }

      return `Tool '${name}' not found.`;
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const { schemas, executor } = combineTools({ schemas: TOOL_SCHEMAS, executor: readExecutor });
  const provider = getProvider(params.provider);
  const prompt = [
    `From: ${params.fromAddress}`,
    `To: ${params.toAddress ?? ''}`,
    `Subject: ${params.subject}`,
    `Received: ${params.receivedAt}`,
    '',
    params.body,
  ].join('\n');

  await provider.call(prompt, schemas, systemPrompt(), [], executor);
  return outcome;
}

function systemPrompt(): string {
  return [
    'You analyze one email for a personal finance app and classify it into exactly one category: receipt, refund_promise, subscription_confirmation, trial_ending, shipping, or irrelevant.',
    '',
    'Look things up before deciding. find_matching_transactions tells you whether the money actually moved — a receipt that matches a real charge is a receipt, and an email quoting a price with no matching transaction is usually marketing. find_similar_emails tells you how this sender\'s earlier mail was treated.',
    '',
    'Extract merchant, amount, currency and expectedByDate only where the email states them. Leave a field out rather than guessing: a wrong amount on a refund creates a signal that waits for money that was never promised.',
    '',
    'Emails may be in any language, commonly English or Romanian. Classify on meaning, never on English keywords, and always answer with the English category name. A Romanian refund reads \'veți primi banii înapoi\' or \'se va face retur\'.',
    "Amounts may use ',' as the decimal separator and '.' as thousands ('1.234,56 lei' is 1234.56 RON). Dates may be day-first (03.05.2026 is 3 May). Report amounts with '.' as the decimal separator and dates as ISO YYYY-MM-DD.",
    '',
    'Use refund_promise only when money is owed and has not arrived, and trial_ending only when a charge is coming unless the user acts.',
    '',
    'Finish by calling save_email_classification exactly once.',
  ].join('\n');
}
