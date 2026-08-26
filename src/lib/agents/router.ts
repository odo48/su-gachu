import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, ToolExecutor, ToolSchema } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { loadTenantDisplayName, tenantIsolationBlock } from '../ai/tenant-context';
import { getGeneralToolSource } from '../mcp/tavily';
import { AGENT_REGISTRY, type AppModule } from './registry';
import { CORE_IDENTITY_PROMPT } from './prompt';
import { hasGarminConnection } from '../garmin/metrics';
import { hasUltrahumanConnection } from '../ultrahuman/connection';
import { hasFinancialAccounts } from '../financial/connection';
import { hasHomeAssistantConnection } from '../home-assistant/connection';

// Ported from jarvis-brain's BrainService.get_chat_response + _execute_tool.
// The main orchestrator sees each of the user's *enabled* specialist agents
// as a single tool (just a "task" string). When it calls one, that agent
// runs its own full turn (its own prompt/tools/provider call), and the
// result comes back as this tool's output. Delegated sub-agent calls are
// stateless (task-only, no history) — matches jarvis's BaseAgent.run, which
// never received the parent conversation's history either; only this
// top-level call gets real history.
export async function runRouterTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}): Promise<string> {
  const { supabase, userId, task, provider: providerName, history } = params;

  const { data: modules } = await supabase.from('user_modules').select('module, enabled').eq('user_id', userId);
  const enabled = new Set((modules ?? []).filter((m) => m.enabled).map((m) => m.module as AppModule));
  if (
    (await hasGarminConnection(supabase, userId)) ||
    (await hasUltrahumanConnection(supabase, userId))
  ) {
    enabled.add('biometrics');
  }
  if (await hasFinancialAccounts(supabase, userId)) enabled.add('financial');
  if (await hasHomeAssistantConnection(supabase, userId)) enabled.add('home_assistant');

  const entries = (Object.entries(AGENT_REGISTRY) as [AppModule, (typeof AGENT_REGISTRY)[AppModule]][]).filter(([module]) =>
    enabled.has(module)
  );

  const toolSchemas: ToolSchema[] = entries.map(([, agent]) => ({
    name: agent.toolName,
    description: agent.description,
    parameters: {
      type: 'object',
      properties: { task: { type: 'string', description: 'Complete task with all necessary context' } },
      required: ['task'],
    },
  }));

  const toolNameToModule = new Map(entries.map(([module, agent]) => [agent.toolName, module]));

  const executeAgentTool: ToolExecutor = async (name, args) => {
    const module = toolNameToModule.get(name);
    if (!module) return `Tool '${name}' not found.`;

    const task = typeof args.task === 'string' ? args.task : JSON.stringify(args);
    try {
      return await AGENT_REGISTRY[module].runTurn({ supabase, userId, task, provider: providerName, history: [] });
    } catch (err) {
      return `Agent '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const provider = getProvider(providerName);
  // "general" tools (Tavily) are available at the top level too, same as
  // jarvis-brain's BrainService.get_chat_response merging them in alongside
  // the agent-as-tool entries — not just inside each specialist.
  const { schemas, executor } = combineTools({ schemas: toolSchemas, executor: executeAgentTool }, await getGeneralToolSource());
  const displayName = await loadTenantDisplayName(supabase, userId);
  const systemPrompt = `${CORE_IDENTITY_PROMPT}\n\n${tenantIsolationBlock(displayName)}`;
  return provider.call(task, schemas, systemPrompt, history, executor);
}
