import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../../ai/types';
import { getProvider } from '../../ai/registry';

// Ported from transaction-manager's packages/email-ingestion/src/screen.ts
// (pass 2 of 3): the model decides which emails are worth opening, from
// metadata only (sender, recipient, subject, Gmail's own snippet) — cheap
// enough to run over everything in the window. A message the model doesn't
// mention is skipped, not selected; a batch whose answer doesn't parse is
// counted as unusable rather than silently dropped.
const SCREEN_BATCH_SIZE = 40;

export interface ScreenableEmail {
  id: number;
  gmailMessageId: string;
  subject: string;
  fromAddress: string;
  toAddress: string | null;
  snippet: string;
  receivedAt: string;
}

export interface ScreeningVerdict {
  selected: boolean;
  reason: string;
}

export interface ScreeningResult {
  verdicts: Map<string, ScreeningVerdict>;
  unusableBatches: number;
  batches: number;
}

const SCREEN_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'screen_emails',
    description: 'Record, for every email you were given, whether its body is worth reading.',
    parameters: {
      type: 'object',
      properties: {
        verdicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'gmailMessageId, verbatim from the email you were given' },
              relevant: { type: 'boolean' },
              reason: { type: 'string' },
            },
            required: ['id', 'relevant', 'reason'],
          },
        },
      },
      required: ['verdicts'],
    },
  },
];

function isRawVerdicts(value: unknown): value is Array<{ id: unknown; relevant: unknown; reason: unknown }> {
  return Array.isArray(value);
}

export async function screenEmails(provider: string, emails: readonly ScreenableEmail[]): Promise<ScreeningResult> {
  const verdicts = new Map<string, ScreeningVerdict>();
  let unusableBatches = 0;
  let batches = 0;
  if (emails.length === 0) return { verdicts, unusableBatches, batches };

  const modelProvider = getProvider(provider);

  for (let index = 0; index < emails.length; index += SCREEN_BATCH_SIZE) {
    const batch = emails.slice(index, index + SCREEN_BATCH_SIZE);
    batches += 1;
    const known = new Set(batch.map((e) => e.gmailMessageId));

    let captured: unknown = null;
    const executor: ToolExecutor = async (name, args) => {
      if (name !== 'screen_emails') return `Tool '${name}' not found.`;
      captured = (args as { verdicts?: unknown }).verdicts;
      return JSON.stringify({ ok: true });
    };

    await modelProvider.call(batch.map(describe).join('\n\n'), SCREEN_TOOL_SCHEMAS, systemPrompt(), [], executor);

    if (!isRawVerdicts(captured)) {
      unusableBatches += 1;
      continue;
    }

    for (const entry of captured) {
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (!id || !known.has(id)) continue;
      verdicts.set(id, {
        selected: entry.relevant === true,
        reason: typeof entry.reason === 'string' ? entry.reason.slice(0, 300) : '',
      });
    }
  }

  return { verdicts, unusableBatches, batches };
}

function describe(email: ScreenableEmail): string {
  return [
    `id: ${email.gmailMessageId}`,
    `from: ${email.fromAddress}`,
    `to: ${email.toAddress ?? ''}`,
    `subject: ${email.subject}`,
    `received: ${email.receivedAt}`,
    `preview: ${email.snippet}`,
  ].join('\n');
}

function systemPrompt(): string {
  return [
    "You screen a user's email for a personal finance app. You see only metadata — sender, recipient, subject, and a one-line preview. Decide which messages are worth opening and reading in full.",
    '',
    'Say relevant: true only for email about this person\'s own money. Receipts and order confirmations, refunds and returns, invoices and bills, subscription and trial notices, payment failures, shipping notices for something they bought, bank and card notifications.',
    '',
    'Say relevant: false for everything else, and in particular:',
    "- Developer and work tooling — GitHub, GitLab, Jira, CI. A pull request titled 'Add payment transaction retry' is about code, not money. Judge the sender and the whole subject, never a single word in it.",
    '- Newsletters, marketing and promotions, even ones quoting prices or discounts.',
    '- Social, calendar and account-security notifications.',
    '',
    "Email may be in any language, commonly English or Romanian — judge meaning, not English keywords. A Romanian receipt reads 'chitanță' or 'ați plătit', a refund 'veți primi banii înapoi'.",
    '',
    'Being wrong in the two directions costs different things: opening a newsletter wastes one call, while skipping a real refund notice means a signal the user never gets. When a message genuinely could go either way, select it.',
    '',
    'Answer with exactly one verdict per email you were given, using the id verbatim, by calling screen_emails exactly once.',
  ].join('\n');
}
