import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ModelProvider, ToolExecutor, ToolSchema } from './types';

// Ported from jarvis-brain/services/claude_service.py. Claude's input_schema
// accepts standard JSON Schema directly — no sanitizer needed, unlike Gemini.
const CLAUDE_MODEL = 'claude-sonnet-4-5';

export class ClaudeProvider implements ModelProvider {
  private client: Anthropic | null;

  constructor(apiKey: string | undefined) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async call(
    prompt: string,
    tools: ToolSchema[],
    systemPrompt: string,
    history: ChatMessage[],
    executeTool: ToolExecutor
  ): Promise<string> {
    if (!this.client) return 'Claude client not initialized';

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
      { role: 'user', content: prompt },
    ];

    try {
      let response = await this.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        tools: anthropicTools,
        system: systemPrompt,
        messages,
      });

      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          const resultText = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: resultText,
          });
        }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });

        response = await this.client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          tools: anthropicTools,
          system: systemPrompt,
          messages,
        });
      }

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return textBlock?.text ?? '';
    } catch (err) {
      return `Claude Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
