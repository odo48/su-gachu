export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (object type)
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

export interface ModelProvider {
  call(
    prompt: string,
    tools: ToolSchema[],
    systemPrompt: string,
    history: ChatMessage[],
    executeTool: ToolExecutor
  ): Promise<string>;
}
