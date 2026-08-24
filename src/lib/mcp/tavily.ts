import type { ToolSource } from '../ai/combine-tools';
import { McpHttpClient } from './client';

// Ported from jarvis-brain's services/mcp_service.py, where Tavily was
// registered with module: "general" — meaning its tools (web search) were
// merged into the router's tool list AND every specialist agent's, not
// gated behind a single domain the way Home Assistant/Biometrics/Financial
// are. This is why it lives in lib/mcp/ rather than under one domain folder,
// and why every agent (see combineTools() calls in food/agent.ts,
// home-assistant/agent.ts, biometrics/agent.ts, financial/agent.ts,
// agents/router.ts) pulls it in the same way.
//
// Unlike Home Assistant/Ultrahuman, this is an app-wide capability (one
// Tavily account paying for the app's web search), not a per-user
// connection — the key is a plain env var, same as GEMINI_API_KEY.
const TAVILY_MCP_URL_PREFIX = process.env.TAVILY_MCP_URL ?? 'https://mcp.tavily.com/mcp/?tavilyApiKey=';

let cachedClient: McpHttpClient | null | undefined;

function getTavilyClient(): McpHttpClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const apiKey = process.env.TAVILY_API_KEY;
  cachedClient = apiKey ? new McpHttpClient(`${TAVILY_MCP_URL_PREFIX}${apiKey}`) : null;
  return cachedClient;
}

export async function getGeneralToolSource(): Promise<ToolSource> {
  const client = getTavilyClient();
  if (!client) return { schemas: [], executor: async (name) => `Tool '${name}' not found.` };

  let schemas;
  try {
    schemas = await client.listTools();
  } catch {
    // Tavily being unreachable shouldn't break an agent turn that doesn't
    // need it — just offer no general tools for this call.
    return { schemas: [], executor: async (name) => `Tool '${name}' not found.` };
  }

  return {
    schemas,
    executor: async (name, args) => {
      try {
        return await client.callTool(name, args);
      } catch (err) {
        return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
