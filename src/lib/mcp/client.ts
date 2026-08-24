import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ToolSchema } from '../ai/types';

// Generic MCP-over-HTTP client, shared by every external MCP server this app
// talks to (Home Assistant, Tavily, ...). Wraps the official SDK's
// StreamableHTTPClientTransport, which implements the same single-endpoint +
// Mcp-Session-Id + JSON-or-SSE-response shape jarvis-brain's
// services/mcp_service.py hand-rolled over raw httpx for all three of its
// MCP servers (backend, home_assistant, tavily). Originally written
// HA-specific (home-assistant/mcp-client.ts); generalized once Tavily needed
// the identical connect/list/call flow rather than duplicating it.
export class McpHttpClient {
  private client: Client;
  private connected = false;

  constructor(
    private url: string,
    private headers: Record<string, string> = {}
  ) {
    this.client = new Client({ name: 'su-gachu', version: '1.0.0' });
  }

  private async ensureConnected() {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: { headers: this.headers },
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async listTools(): Promise<ToolSchema[]> {
    await this.ensureConnected();
    const { tools } = await this.client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      parameters: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ensureConnected();
    const result = await this.client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    if (result.isError) throw new Error(text || `Tool '${name}' failed`);
    return text;
  }

  async close() {
    if (this.connected) await this.client.close();
  }
}
