// Ported from transaction-manager's packages/jobs/src/transfer-pairs.ts,
// computed client-side over an in-memory window instead of a Postgres
// self-join — at personal-account transaction volumes (hundreds, not
// millions) the O(n^2) scan is cheap and avoids a bespoke SQL RPC.
//
// Finds the *other leg* of a movement between two of the user's own
// accounts. Enable Banking rarely gives a reliable counterparty account
// number, but both legs are usually present in the feed: two accounts each
// showing one side of the same transfer, same day, same amount.
import { normalizeDescription, type EnrichTx } from './signature';

/** How the two legs were matched, in descending order of certainty. */
export type TransferMatchKind =
  /** Same amount, same currency, same description, opposite direction, two
   * different accounts, within a day. Applied as fact. */
  | 'exact'
  /** Same description and day, opposite direction, different accounts, but
   * different currencies (so the amounts can't corroborate each other).
   * Still applied as fact — the description carries the match. */
  | 'fx'
  /** Amount and date line up but the descriptions don't. Never applied on
   * its own — handed to the agent as evidence to weigh. */
  | 'amount_only';

export interface TransferPair {
  transactionId: number;
  pairTransactionId: number;
  pairAccountId: number;
  pairAmount: number;
  pairCurrency: string;
  pairDescription: string;
  pairDate: string;
  kind: TransferMatchKind;
}

const KIND_RANK: Record<TransferMatchKind, number> = { exact: 0, fx: 1, amount_only: 2 };

/** Kinds strong enough to mark a transfer without asking anyone. */
export function isConclusive(kind: TransferMatchKind): boolean {
  return kind === 'exact' || kind === 'fx';
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T12:00:00`);
  const db = Date.parse(`${b}T12:00:00`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.abs(da - db) / 86_400_000;
}

function cents(amount: number) {
  return Math.round(Math.abs(amount) * 100);
}

interface CandidateRow {
  transactionId: number;
  pair: EnrichTx;
  kind: TransferMatchKind;
  dayGap: number;
}

/**
 * Greedy 1:1 assignment, strongest match first — necessary because
 * candidates are genuinely ambiguous (five round-ups landing on the same
 * day can all match each other's amount). Claiming one leg twice would
 * leave another with none, and a real transfer would then look like income.
 */
function assign(rows: readonly CandidateRow[]): Map<number, TransferPair> {
  const sorted = [...rows].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.dayGap - b.dayGap);

  const pairs = new Map<number, TransferPair>();
  const usedAsCounterLeg = new Set<number>();

  for (const row of sorted) {
    if (pairs.has(row.transactionId) || usedAsCounterLeg.has(row.pair.id)) continue;

    pairs.set(row.transactionId, {
      transactionId: row.transactionId,
      pairTransactionId: row.pair.id,
      pairAccountId: row.pair.accountId,
      pairAmount: row.pair.amount,
      pairCurrency: row.pair.currency,
      pairDescription: row.pair.description,
      pairDate: row.pair.date,
      kind: row.kind,
    });
    usedAsCounterLeg.add(row.pair.id);
  }

  return pairs;
}

/**
 * `allTxs` should span the user's whole recent window (not just the current
 * batch) — a transfer's two legs are only in the same batch by luck.
 */
export function findTransferPairs(
  allTxs: readonly EnrichTx[],
  targetIds: readonly number[]
): Map<number, TransferPair> {
  const targets = new Set(targetIds);
  const rows: CandidateRow[] = [];

  for (const t of allTxs) {
    if (!targets.has(t.id)) continue;

    for (const p of allTxs) {
      if (p.id === t.id) continue;
      if (p.accountId === t.accountId) continue;
      if (p.direction === t.direction) continue;

      const dayGap = daysBetween(t.date, p.date);
      if (dayGap > 1) continue;

      const sameDescription = normalizeDescription(p.description) === normalizeDescription(t.description);
      const sameCurrencyAmount = p.currency === t.currency && cents(p.amount) === cents(t.amount);
      const fxCandidate = p.currency !== t.currency && sameDescription && p.date === t.date;
      if (!sameCurrencyAmount && !fxCandidate) continue;

      let kind: TransferMatchKind;
      if (sameCurrencyAmount && sameDescription) kind = 'exact';
      else if (fxCandidate) kind = 'fx';
      else kind = 'amount_only';

      rows.push({ transactionId: t.id, pair: p, kind, dayGap });
    }
  }

  return assign(rows);
}
