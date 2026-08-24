import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../ai/types';
import { runFoodAgentTurn } from '../food/agent';
import { runHomeAssistantAgentTurn } from '../home-assistant/agent';
import { runBiometricsAgentTurn } from '../biometrics/agent';
import { runFinancialAgentTurn } from '../financial/agent';

// Ported from jarvis-brain's services/agent_registry.py (data) +
// base_agent.py (behavior), which were two separate files linked only by a
// "module" string. Collapsing them into one registry (name + description +
// the actual run function together) means there's no string key that can
// silently drift out of sync between the two, unlike jarvis-brain.
export type AppModule = 'food' | 'home_assistant' | 'biometrics' | 'financial';

type RunTurn = (params: {
  supabase: SupabaseClient;
  userId: string;
  task: string;
  provider: string;
  history: ChatMessage[];
}) => Promise<string>;

export const AGENT_REGISTRY: Record<AppModule, { toolName: string; description: string; runTurn: RunTurn }> = {
  food: {
    toolName: 'food_agent',
    description:
      "Specialized agent for meal planning, nutrition optimization, and recipe management. Route to this agent for generating weekly or monthly meal plans aligned with specific fitness goals (e.g., Lean Cut, Bulk, Maintenance). It specializes in 'batch cooking' optimization, structuring plans into large meal blocks (bulk breakfast and lunch prep) rather than rigid daily menus. The agent handles automated recipe searching from the local database or external target platforms (GymBeam, Jamila Cuisine), enforces strict dietary restrictions (e.g., excluding mushrooms, olives, or other blacklisted items), calculates dynamically adjusted macro-nutrients at the plan level, and compiles aggregated, categorized weekly shopping lists.",
    runTurn: runFoodAgentTurn,
  },
  home_assistant: {
    toolName: 'home_assistant_agent',
    description:
      'Specialized agent for smart-home management via Home Assistant. Route to this agent for managing physical devices, checking sensor states, controlling lights, climate, switches, media players, and robot vacuums. Also handles home-related built-in features like broadcasting messages and managing shopping or to-do lists.',
    runTurn: runHomeAssistantAgentTurn,
  },
  biometrics: {
    toolName: 'biometrics_agent',
    description:
      'Specialized agent for physical biometrics, sleep tracking, and health data. Use this for: analyzing sleep scores, recovery indices, heart rate (HR) trends, heart rate variability (HRV), daily steps, sleep consistency, and tracking physical performance over time.',
    runTurn: runBiometricsAgentTurn,
  },
  financial: {
    toolName: 'financial_agent',
    description:
      'Specialized agent for personal finances. Use this for: transactions, balances, expense categorization, financial reports, budgets, account transfers.',
    runTurn: runFinancialAgentTurn,
  },
};
