import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { getProvider } from '../ai/registry';
import { combineTools } from '../ai/combine-tools';
import { getGeneralToolSource } from '../mcp/tavily';
import {
  createGarminToolExecutor,
  createUltrahumanToolExecutor,
  GARMIN_TOOL_SCHEMAS,
  ULTRAHUMAN_TOOL_SCHEMAS,
} from './tools';
import { buildBiometricsPrompt } from './prompt';
import { loadTenantDisplayName, tenantIsolationBlock } from '../ai/tenant-context';
import { hasGarminConnection } from '../garmin/metrics';
import { hasUltrahumanConnection } from '../ultrahuman/connection';

export async function runBiometricsAgentTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}): Promise<string> {
  const ultrahuman = await hasUltrahumanConnection(params.supabase, params.userId);
  const garmin = await hasGarminConnection(params.supabase, params.userId);

  if (!ultrahuman && !garmin) {
    throw new Error('Niciun wearable conectat. Adaugă Garmin și/sau Ultrahuman pe Profil.');
  }

  const sources = [];
  if (ultrahuman) {
    sources.push({
      schemas: ULTRAHUMAN_TOOL_SCHEMAS,
      executor: createUltrahumanToolExecutor(params.supabase, params.userId),
    });
  }
  if (garmin) {
    sources.push({
      schemas: GARMIN_TOOL_SCHEMAS,
      executor: createGarminToolExecutor(params.supabase, params.userId),
    });
  }
  sources.push(await getGeneralToolSource());

  const provider = getProvider(params.provider);
  const { schemas, executor } = combineTools(...sources);
  const displayName = await loadTenantDisplayName(params.supabase, params.userId);
  const systemPrompt = `${buildBiometricsPrompt({ ultrahuman, garmin })}\n\n${tenantIsolationBlock(displayName)}`;
  return provider.call(params.task, schemas, systemPrompt, params.history, executor);
}
