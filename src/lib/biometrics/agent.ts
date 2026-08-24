import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { getGeneralToolSource } from '../mcp/tavily';
import { createBiometricsToolExecutor, BIOMETRICS_TOOL_SCHEMAS } from './tools';
import { BIOMETRICS_PROMPT } from './prompt';

// Mirrors src/lib/food/agent.ts's shape.
export async function runBiometricsAgentTurn(params: {
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
    .eq('module', 'biometrics')
    .maybeSingle();
  if (!moduleRow?.enabled) {
    throw new Error('Biometrics is not enabled for this account. Connect Ultrahuman first.');
  }

  const provider = getProvider(params.provider);
  const { schemas, executor } = combineTools(
    { schemas: BIOMETRICS_TOOL_SCHEMAS, executor: createBiometricsToolExecutor(params.supabase, params.userId) },
    await getGeneralToolSource()
  );
  return provider.call(params.task, schemas, BIOMETRICS_PROMPT, params.history, executor);
}
