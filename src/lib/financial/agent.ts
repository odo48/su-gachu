import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { getGeneralToolSource } from '../mcp/tavily';
import { createFinancialToolExecutor, FINANCIAL_TOOL_SCHEMAS } from './tools';
import { FINANCIAL_MANAGEMENT_PROMPT } from './prompt';
import { hasFinancialAccounts } from './connection';

// Mirrors src/lib/food/agent.ts's shape.
export async function runFinancialAgentTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}): Promise<string> {
  const { data: moduleRow } = await params.supabase
    .from('user_modules')
    .select('enabled')
    .eq('user_id', params.userId)
    .eq('module', 'financial')
    .maybeSingle();
  if (!moduleRow?.enabled) {
    const linked = await hasFinancialAccounts(params.supabase, params.userId);
    if (!linked) {
      throw new Error('Financial is not enabled. Adaugă un cont pe Profil.');
    }
  }

  const provider = getProvider(params.provider);
  const { schemas, executor } = combineTools(
    { schemas: FINANCIAL_TOOL_SCHEMAS, executor: createFinancialToolExecutor(params.supabase, params.userId) },
    await getGeneralToolSource()
  );
  return provider.call(params.task, schemas, FINANCIAL_MANAGEMENT_PROMPT, params.history, executor);
}
