import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';

// Tool implementations mirroring jarvis-backend's Mcp/BalanceTool,
// TransactionTool, ClassifyTransactionTool, CategoryTool. Run in-process
// against Supabase, scoped to the authenticated user — see food/tools.ts
// and biometrics/tools.ts for the same pattern.

function mapTransactionRow(row: {
  id: number;
  amount: string | number;
  currency: string;
  creditor_name: string | null;
  debtor_name: string | null;
  bank_transaction_code: string | null;
  credit_debit_indicator: string;
  remittance_information: string | null;
  booking_date: string;
  tags: string | null;
  notes: string | null;
  accounts?: { bank: string; currency: string } | null;
  categories?: { id: number; name: string; kind: string } | null;
}) {
  return {
    id: row.id,
    bank: row.accounts?.bank ?? '',
    accountCurrencyCode: row.accounts?.currency ?? '',
    amount: Number(row.amount),
    currencyCode: row.currency,
    creditorName: row.creditor_name ?? '',
    debtorName: row.debtor_name ?? '',
    code: row.bank_transaction_code ?? '',
    type: row.credit_debit_indicator,
    description: row.remittance_information ?? '',
    date: row.booking_date,
    categoryId: row.categories?.id ?? null,
    categoryName: row.categories?.name ?? null,
    categoryKind: row.categories?.kind ?? null,
    tags: row.tags,
    notes: row.notes,
  };
}

export async function getBalances(supabase: SupabaseClient, userId: string, args: { bank?: string; currency?: string }) {
  let query = supabase.from('accounts').select('id, bank, currency, balance').eq('user_id', userId);
  if (args.bank) query = query.ilike('bank', `%${args.bank}%`);
  if (args.currency) query = query.eq('currency', args.currency);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((a) => ({ accountId: a.id, bank: a.bank, currencyCode: a.currency, balance: Number(a.balance) }));
}

export async function getTransactions(
  supabase: SupabaseClient,
  userId: string,
  args: {
    accountId?: number;
    creditorName?: string;
    debtorName?: string;
    since?: string;
    categoryId?: number;
    withoutCategory?: boolean;
    sort?: string;
    order?: string;
    limit?: number;
    page?: number;
  }
) {
  let query = supabase
    .from('transactions')
    .select('*, accounts!inner(bank, currency), categories(id, name, kind)')
    .eq('user_id', userId);

  if (args.accountId) query = query.eq('account_id', args.accountId);
  if (args.creditorName) query = query.ilike('creditor_name', `%${args.creditorName}%`);
  if (args.debtorName) query = query.ilike('debtor_name', `%${args.debtorName}%`);
  if (args.since) query = query.gte('booking_date', args.since);
  if (args.withoutCategory) {
    query = query.is('category_id', null);
  } else if (args.categoryId) {
    query = query.eq('category_id', args.categoryId);
  }

  const sortField = args.sort === 'amount' ? 'amount' : 'booking_date';
  const ascending = (args.order ?? 'DESC').toUpperCase() === 'ASC';
  const limit = args.limit ?? 50;
  const page = args.page ?? 1;
  query = query.order(sortField, { ascending }).range((page - 1) * limit, page * limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapTransactionRow);
}

export async function getCategories(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from('categories').select('id, name, icon, kind').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(
  supabase: SupabaseClient,
  userId: string,
  args: { name: string; icon?: string; kind?: 'income' | 'expense' | 'transfer' }
) {
  const { data: existing, error: findError } = await supabase
    .from('categories')
    .select('id, name, icon, kind')
    .eq('user_id', userId)
    .eq('name', args.name)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: args.name, icon: args.icon ?? null, kind: args.kind ?? 'expense' })
    .select('id, name, icon, kind')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function classifyTransaction(
  supabase: SupabaseClient,
  userId: string,
  args: { transactionId: number; categoryId: number; tags?: string[]; notes?: string }
) {
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', args.categoryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (categoryError) throw new Error(categoryError.message);
  if (!category) throw new Error(`Category not found with ID: ${args.categoryId}`);

  const update: Record<string, unknown> = { category_id: args.categoryId };
  if (args.tags !== undefined) update.tags = args.tags.join(', ');
  if (args.notes !== undefined) update.notes = args.notes;

  const { data, error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', args.transactionId)
    .eq('user_id', userId)
    .select('*, accounts!inner(bank, currency), categories(id, name, kind)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Transaction not found with ID: ${args.transactionId}`);

  return mapTransactionRow(data);
}

export async function getSignals(supabase: SupabaseClient, userId: string, args: { status?: string }) {
  let query = supabase
    .from('financial_signals')
    .select('id, type, priority, expected_value, expected_by_date, confidence, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  query = args.status ? query.eq('status', args.status) : query.in('status', ['detected', 'confirmed']);

  const { data, error } = await query.limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const FINANCIAL_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_balances',
    description:
      'Provides a summary of all bank accounts, including their names, internal IDs, currencies, and current balances. Use this tool first to discover account IDs when you need it for other tools.',
    parameters: {
      type: 'object',
      properties: {
        bank: { type: 'string', description: 'Filter by bank name (partial match)' },
        currency: { type: 'string', description: 'Filter by currency code (e.g., RON, EUR)' },
      },
    },
  },
  {
    name: 'get_transactions',
    description:
      'Retrieve financial transactions. Use withoutCategory=true to identify transactions that need classification. Use since to filter by period (e.g., last month). Use creditorName to find specific merchants.',
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'integer', description: 'Filter by account ID' },
        creditorName: { type: 'string' },
        debtorName: { type: 'string' },
        since: { type: 'string', description: 'ISO-8601 date' },
        categoryId: { type: 'integer' },
        withoutCategory: { type: 'boolean' },
        sort: { type: 'string', description: '"bookingDate" or "amount"' },
        order: { type: 'string', description: '"ASC" or "DESC"' },
        limit: { type: 'integer', description: 'Default 50' },
      },
    },
  },
  {
    name: 'get_categories',
    description: 'Returns a list of all available transaction categories with their IDs.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_category',
    description: 'Creates a new transaction category. Use this only if no existing category matches the transaction context.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        icon: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['income', 'expense', 'transfer'],
          description:
            'income = money arriving that is not a transfer/refund; transfer = movement between the user\'s own accounts; expense = default for everything else.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'classify_transaction',
    description: 'Updates a transaction with a category, tags, and personal notes. Use this after identifying the correct category.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: { type: 'integer' },
        categoryId: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['transactionId', 'categoryId'],
    },
  },
  {
    name: 'get_signals',
    description:
      'Returns proactive alerts (subscription renewals, low-balance forecasts, fraud outliers, refund/trial reminders, income anomalies) for this user. Defaults to open (unresolved) ones.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['detected', 'confirmed', 'resolved', 'expired', 'dismissed'] },
      },
    },
  },
];

export function createFinancialToolExecutor(supabase: SupabaseClient, userId: string): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'get_balances':
          return JSON.stringify(await getBalances(supabase, userId, args as { bank?: string; currency?: string }));
        case 'get_transactions':
          return JSON.stringify(await getTransactions(supabase, userId, args as Parameters<typeof getTransactions>[2]));
        case 'get_categories':
          return JSON.stringify(await getCategories(supabase, userId));
        case 'create_category':
          return JSON.stringify(
            await createCategory(supabase, userId, args as Parameters<typeof createCategory>[2])
          );
        case 'classify_transaction':
          return JSON.stringify(await classifyTransaction(supabase, userId, args as Parameters<typeof classifyTransaction>[2]));
        case 'get_signals':
          return JSON.stringify(await getSignals(supabase, userId, args as { status?: string }));
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
