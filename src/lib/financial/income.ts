// Ported from transaction-manager's packages/jobs/src/income.ts. How money
// arrived, on credits only, from the counterparty/description text — rules
// before the model, same as the rest of the enrichment cascade (enrich.ts).
// Most income is boringly identifiable and the cases that aren't are exactly
// the ones worth spending a model call on.
//
// Keyword lists are Romanian *and* English on purpose: the production data
// is a Romanian bank feed.
const KEYWORDS: ReadonlyArray<{ categoryName: string; patterns: readonly string[] }> = [
  { categoryName: 'Salariu', patterns: ['salar', 'salary', 'payroll', 'wage', 'lohn', 'remuneratie'] },
  { categoryName: 'Dividende', patterns: ['dividend', 'divid'] },
  { categoryName: 'Dobândă', patterns: ['interest', 'dobanda', 'dobânda', 'dobânzi'] },
  { categoryName: 'Chirie încasată', patterns: ['rent', 'chirie', 'rental', 'lease'] },
  { categoryName: 'Pensie / beneficii', patterns: ['pension', 'pensie', 'benefit', 'alocatie', 'indemnizatie', 'somaj'] },
  { categoryName: 'Câștig de capital', patterns: ['capital gain', 'dezinvestire', 'sale proceeds', 'proceeds'] },
  // Not income: getting your own money back is not earning it. Kept as
  // 'expense' kind (there's no fourth bucket) so it never inflates income
  // totals if a future pass starts summing by kind instead of raw flow.
  { categoryName: 'Rambursare', patterns: ['refund', 'rambursare', 'returnare', 'reversal', 'chargeback'] },
  {
    categoryName: 'Venituri activitate independentă',
    patterns: ['invoice', 'factura', 'freelance', 'consulting', 'pfa', 'srl'],
  },
];

export interface IncomeClassificationInput {
  direction: 'debit' | 'credit';
  description: string;
  counterpartyName: string | null;
  isInternalTransfer: boolean;
}

export interface IncomeClassification {
  categoryName: string | null;
  categoryKind: 'income' | 'expense' | 'transfer' | null;
  /** 1 for a structural match, lower for a keyword guess. */
  confidence: number;
}

/**
 * Returns nulls for debits and for credits nothing could identify —
 * deliberately, since "unknown" and "not income" are different facts. A
 * null leaves the category to the agent.
 */
export function classifyIncome(input: IncomeClassificationInput): IncomeClassification {
  if (input.direction !== 'credit') return { categoryName: null, categoryKind: null, confidence: 0 };

  // Structural, not textual: the opposite leg was found in the user's own
  // feed. That outranks anything the description might say.
  if (input.isInternalTransfer) {
    return { categoryName: 'Transfer intern', categoryKind: 'transfer', confidence: 1 };
  }

  const haystack = `${input.description} ${input.counterpartyName ?? ''}`.toLowerCase();

  for (const rule of KEYWORDS) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      const kind = rule.categoryName === 'Rambursare' ? 'expense' : 'income';
      // Not 1.0: a keyword in free text is a strong hint, not a structural
      // fact, and should lose to a user correction.
      return { categoryName: rule.categoryName, categoryKind: kind, confidence: 0.8 };
    }
  }

  return { categoryName: null, categoryKind: null, confidence: 0 };
}
