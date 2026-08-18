import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { getProvider } from '../ai/registry';
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
  const provider = getProvider(params.provider);
  const executeTool = createFoodToolExecutor(params.supabase, params.userId);
  return provider.call(params.task, FOOD_TOOL_SCHEMAS, FOOD_MANAGEMENT_PROMPT, params.history, executeTool);
}
