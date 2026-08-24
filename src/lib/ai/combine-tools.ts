import type { ToolExecutor, ToolSchema } from './types';

// A tool source: its schemas plus the executor that handles calls to any of
// them. combineTools() merges several sources into one (schemas, executor)
// pair — used to add Tavily's tools (lib/mcp/tavily.ts) on top of each
// agent's own tools, mirroring jarvis-brain's per-agent "module_tools +
// general_tools" merge (base_agent.py, brain_service.py) as one shared
// helper instead of duplicating the merge in every agent file.
export type ToolSource = { schemas: ToolSchema[]; executor: ToolExecutor };

export function combineTools(...sources: ToolSource[]): ToolSource {
  const schemas: ToolSchema[] = [];
  const executorByName = new Map<string, ToolExecutor>();

  for (const source of sources) {
    for (const schema of source.schemas) {
      // First source wins on a name collision — matches jarvis-brain's own
      // MCP tool dedup in mcp_service.py.
      if (executorByName.has(schema.name)) continue;
      schemas.push(schema);
      executorByName.set(schema.name, source.executor);
    }
  }

  const executor: ToolExecutor = async (name, args) => {
    const exec = executorByName.get(name);
    return exec ? exec(name, args) : `Tool '${name}' not found.`;
  };

  return { schemas, executor };
}
