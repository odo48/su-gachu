import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import type { ModelProvider } from './types';

export type ProviderName = 'gemini' | 'claude';

// Single dispatch point, unlike jarvis-brain's base_agent.py/brain_service.py
// which each duplicated this branch (and disagreed on unknown-provider
// handling — one errored, the other silently fell back to Gemini).
const providers: Record<ProviderName, ModelProvider> = {
  gemini: new GeminiProvider(process.env.GEMINI_API_KEY),
  claude: new ClaudeProvider(process.env.ANTHROPIC_API_KEY),
};

export function getProvider(name: string): ModelProvider {
  const provider = providers[name as ProviderName];
  if (!provider) {
    throw new Error(`Unknown provider "${name}". Expected "gemini" or "claude".`);
  }
  return provider;
}
