// Ported from transaction-manager's packages/jobs/src/signature.ts: the unit
// the enrichment agent actually reasons about. Asking a model to categorize
// every transaction individually is wasteful and inconsistent when hundreds
// of rows share one description pattern (e.g. every "Netflix" charge) — so
// the model is asked once per signature and its judgment applied to the
// whole group.

export interface EnrichTx {
  id: number;
  accountId: number;
  direction: 'debit' | 'credit';
  code: string | null;
  description: string;
  amount: number;
  currency: string;
  date: string;
  creditorName: string | null;
  debtorName: string | null;
}

export interface TransactionGroup {
  signature: string;
  transactions: EnrichTx[];
}

/**
 * Reference numbers are stripped because they're the one part of a
 * description guaranteed to differ between two otherwise-identical
 * transactions — six digits or more, so a genuinely meaningful number in a
 * merchant name survives.
 */
export function normalizeDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{6,}/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Direction and the bank's own code are part of the key, not just the text. */
export function transactionSignature(tx: EnrichTx): string {
  return [tx.direction, tx.code ?? '', normalizeDescription(tx.description)].join('|');
}

export function groupBySignature(transactions: readonly EnrichTx[]): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();

  for (const tx of transactions) {
    const signature = transactionSignature(tx);
    const existing = groups.get(signature);
    if (existing) {
      existing.transactions.push(tx);
    } else {
      groups.set(signature, { signature, transactions: [tx] });
    }
  }

  return [...groups.values()];
}
