import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, ToolExecutor } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { getGeneralToolSource } from '../mcp/tavily';
import { createAdminClient } from '../supabase/admin';
import { McpHttpClient } from '../mcp/client';
import { HOME_ASSISTANT_PROMPT } from './prompt';

// Mirrors src/lib/food/agent.ts's runFoodAgentTurn shape (shared by a
// stateless route and a future conversational one), but tools are fetched
// dynamically per-user from their own Home Assistant instance instead of
// being statically declared like food's FOOD_TOOL_SCHEMAS.
export async function runHomeAssistantAgentTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}): Promise<string> {
  const { supabase, userId, task, provider: providerName, history } = params;

  const { data: moduleRow } = await supabase
    .from('user_modules')
    .select('enabled')
    .eq('user_id', userId)
    .eq('module', 'home_assistant')
    .maybeSingle();
  if (!moduleRow?.enabled) {
    throw new Error('Home Assistant is not enabled for this account. Connect it first.');
  }

  const { data: connection, error: connError } = await supabase
    .from('home_assistant_connections')
    .select('mcp_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (connError) throw new Error(connError.message);
  if (!connection) throw new Error('No Home Assistant connection configured for this account.');

  // Token is Vault-encrypted and only readable via this service_role RPC —
  // see get_ha_token() in supabase/schema_home_assistant.sql.
  const admin = createAdminClient();
  const { data: token, error: tokenError } = await admin.rpc('get_ha_token', { p_user_id: userId });
  if (tokenError || !token) throw new Error('Could not read Home Assistant token.');

  const mcp = new McpHttpClient(connection.mcp_url, { Authorization: `Bearer ${token}` });
  try {
    const haTools = await mcp.listTools();
    const haExecutor: ToolExecutor = async (name, args) => {
      try {
        return await mcp.callTool(name, args);
      } catch (err) {
        return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    const provider = getProvider(providerName);
    const { schemas, executor } = combineTools({ schemas: haTools, executor: haExecutor }, await getGeneralToolSource());
    return await provider.call(task, schemas, HOME_ASSISTANT_PROMPT, history, executor);
  } finally {
    await mcp.close();
  }
}
