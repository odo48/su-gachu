import { GoogleGenAI, type FunctionDeclaration } from '@google/genai';
import type { ChatMessage, ModelProvider, ToolExecutor, ToolSchema } from './types';

// Ported from jarvis-brain/services/gemini_service.py.
// Gemini's function-calling schema only accepts a whitelist of JSON Schema
// fields — this mirrors GeminiService._sanitize_parameters exactly.
const ALLOWED_SCHEMA_FIELDS = new Set([
  'type',
  'format',
  'description',
  'properties',
  'required',
  'items',
  'enum',
  'nullable',
]);

function sanitizeParameters(parameters: unknown): unknown {
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return parameters;
  }

  const input = parameters as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (ALLOWED_SCHEMA_FIELDS.has(key)) output[key] = input[key];
  }

  if (output.properties && typeof output.properties === 'object') {
    const props = output.properties as Record<string, unknown>;
    output.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, sanitizeParameters(v)])
    );
  }

  if (output.items) output.items = sanitizeParameters(output.items);

  if (Array.isArray(output.type)) {
    const nonNull = (output.type as string[]).filter((t) => t !== 'null');
    output.type = nonNull.length > 0 ? nonNull[0] : 'string';
  }

  if (output.type === 'array' && !output.items) {
    output.items = { type: 'string' };
  }

  return output;
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite';

export class GeminiProvider implements ModelProvider {
  private client: GoogleGenAI | null;

  constructor(apiKey: string | undefined) {
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async call(
    prompt: string,
    tools: ToolSchema[],
    systemPrompt: string,
    history: ChatMessage[],
    executeTool: ToolExecutor
  ): Promise<string> {
    if (!this.client) return 'Gemini API key missing';

    const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: sanitizeParameters(t.parameters),
    }));

    const chat = this.client.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
      },
      history: history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    try {
      let response = await chat.sendMessage({ message: prompt });

      while (response.functionCalls && response.functionCalls.length > 0) {
        const responseParts = [];
        for (const fc of response.functionCalls) {
          const name = fc.name ?? '';
          const args = (fc.args ?? {}) as Record<string, unknown>;
          const resultText = await executeTool(name, args);

          responseParts.push({
            functionResponse: {
              id: fc.id,
              name,
              response: { result: resultText },
            },
          });
        }

        response = await chat.sendMessage({ message: responseParts });
      }

      return response.text ?? '';
    } catch (err) {
      return `Gemini Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
