export type InternalTransferTx = {
  id: number;
  bank: string;
  amount: number;
  currencyCode: string;
  creditorName: string;
  debtorName: string;
  type: string;
  description: string;
  date: string;
  categoryName?: string | null;
  tags?: string | null;
  code?: string;
};

export type OwnAccountHint = {
  bank: string;
  iban?: string;
};

export function isDebitIndicator(type: string) {
  const t = type.toUpperCase();
  return t === 'DBIT' || t === 'DEBIT';
}

export function isCreditIndicator(type: string) {
  const t = type.toUpperCase();
  return t === 'CRDT' || t === 'CREDIT';
}

/** Spend = explicit debit (or negative amount). Never treat unknown/credit as spend. */
export function transactionFlow(type: string, amount: number): 'debit' | 'credit' | 'unknown' {
  if (isDebitIndicator(type)) return 'debit';
  if (isCreditIndicator(type)) return 'credit';
  if (amount < 0) return 'debit';
  if (amount > 0) return 'credit';
  return 'unknown';
}

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function blob(tx: InternalTransferTx) {
  return fold(
    [tx.creditorName, tx.debtorName, tx.description, tx.bank, tx.categoryName ?? '', tx.tags ?? '', tx.code ?? ''].join(
      ' '
    )
  );
}

function bankAliases(name: string): string[] {
  const f = fold(name);
  const aliases = new Set<string>();
  if (f) aliases.add(f);
  const rules: Array<[RegExp, string]> = [
    [/\brevolut\b/, 'revolut'],
    [/\bing\b/, 'ing'],
    [/\bbcr\b/, 'bcr'],
    [/\bbrd\b/, 'brd'],
    [/\braiffeisen\b/, 'raiffeisen'],
    [/\btransilvania\b|\bbanca transilvania\b|\bbt\b/, 'bt'],
    [/\bcec\b/, 'cec'],
    [/\bunicredit\b/, 'unicredit'],
    [/\blibera\b/, 'libera'],
  ];
  for (const [re, alias] of rules) {
    if (re.test(f)) aliases.add(alias);
  }
  return [...aliases];
}

function ibanTail(iban?: string) {
  const compact = (iban ?? '').replace(/\s+/g, '');
  if (compact.length < 4) return '';
  return compact.slice(-4).toLowerCase();
}

const INTERNAL_CATEGORY = /internal\s*transfer|transfer\s*intern|intre conturi|own accounts?/i;

const TEXT_HINTS = [
  /\btop\s*up\b/,
  /\btopup\b/,
  /\badaugare fonduri\b/,
  /\bincarcare(a)? cont\b/,
  /\bfrom (my |the )?(savings|current|ing|revolut|bcr|brd)\b/,
  /\bto (my |the )?(savings|current|ing|revolut|bcr|brd)\b/,
  /\bto [a-z0-9 ].*account\b/,
  /\bfrom [a-z0-9 ].*account\b/,
  /\btransfer intern\b/,
  /\bown account\b/,
  /\bintre contur/,
];

function looksLikeInternalText(text: string) {
  return TEXT_HINTS.some((re) => re.test(text));
}

function hasAlias(text: string, alias: string) {
  if (!alias) return false;
  if (alias.includes(' ')) return ` ${text} `.includes(` ${alias} `);
  return text.split(' ').includes(alias);
}

function mentionsOtherOwnAccount(text: string, txBank: string, accounts: OwnAccountHint[]) {
  const own = bankAliases(txBank);
  for (const account of accounts) {
    const other = bankAliases(account.bank);
    const isSameBank = other.some((token) => own.includes(token));
    if (!isSameBank && other.some((token) => token.length >= 3 && hasAlias(text, token))) {
      return true;
    }
    const tail = ibanTail(account.iban);
    if (tail && text.split(' ').includes(tail) && !isSameBank) return true;
  }
  return false;
}

function daysBetween(a: string, b: string) {
  const da = Date.parse(`${a}T12:00:00`);
  const db = Date.parse(`${b}T12:00:00`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.abs(da - db) / 86_400_000;
}

function cents(amount: number) {
  return Math.round(Math.abs(amount) * 100);
}

function pairedWithOppositeLeg(tx: InternalTransferTx, all: InternalTransferTx[], accounts: OwnAccountHint[]) {
  if (accounts.length < 2) return false;
  const debit = isDebitIndicator(tx.type);
  const amount = cents(tx.amount);
  const currency = (tx.currencyCode || '').toUpperCase();
  const bank = fold(tx.bank);

  return all.some((other) => {
    if (other.id === tx.id) return false;
    if (cents(other.amount) !== amount) return false;
    if ((other.currencyCode || '').toUpperCase() !== currency) return false;
    if (isDebitIndicator(other.type) === debit) return false;
    if (fold(other.bank) === bank) return false;
    if (daysBetween(tx.date, other.date) > 2) return false;
    return true;
  });
}

export function isInternalTransfer(
  tx: InternalTransferTx,
  accounts: OwnAccountHint[],
  allTxs: InternalTransferTx[]
) {
  if (tx.categoryName && INTERNAL_CATEGORY.test(fold(tx.categoryName))) return true;
  if (tx.tags && /internal[_ ]?transfer|transfer[_ ]?intern/.test(fold(tx.tags))) return true;

  const text = blob(tx);
  if (looksLikeInternalText(text)) return true;
  if (mentionsOtherOwnAccount(text, tx.bank, accounts)) return true;
  if (pairedWithOppositeLeg(tx, allTxs, accounts)) return true;

  return false;
}
