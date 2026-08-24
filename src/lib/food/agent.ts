import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { getGeneralToolSource } from '../mcp/tavily';
import { createFoodToolExecutor, FOOD_TOOL_SCHEMAS } from './tools';
import { FOOD_MANAGEMENT_PROMPT } from './prompt';

// Shared by /api/food-agent (stateless, history: []) and the conversational
// /api/conversations/[id]/messages route (real persisted history) — kept in
// one place so the provider/tool/prompt wiring isn't duplicated across
// routes the way it was in jarvis-brain before that cleanup.
export async function runFoodAgentTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}): Promise<string> {
  // Absence of a row means "not configured yet" (allowed), not disabled —
  // keeps this working even before schema_modules.sql's backfill has run.
  // See supabase/schema_modules.sql for why this check exists.
  const { data: moduleRow } = await params.supabase
    .from('user_modules')
    .select('enabled')
    .eq('user_id', params.userId)
    .eq('module', 'food')
    .maybeSingle();
  if (moduleRow && !moduleRow.enabled) {
    throw new Error('Food planning is not enabled for this account.');
  }

  const provider = getProvider(params.provider);
  const { schemas, executor } = combineTools(
    { schemas: FOOD_TOOL_SCHEMAS, executor: createFoodToolExecutor(params.supabase, params.userId) },
    await getGeneralToolSource()
  );
  return provider.call(params.task, schemas, FOOD_MANAGEMENT_PROMPT, params.history, executor);
}
