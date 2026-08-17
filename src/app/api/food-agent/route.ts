import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createFoodToolExecutor, FOOD_TOOL_SCHEMAS } from '@/lib/food/tools';
import { FOOD_MANAGEMENT_PROMPT } from '@/lib/food/prompt';
import { getProvider } from '@/lib/ai/registry';

// Agentic food-planning endpoint: ports jarvis-brain's food_agent (prompt +
// tool-calling loop) into su-gachu. Not wired to any UI control yet.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const task = body?.task;
  const providerName = body?.provider ?? 'gemini';
  if (!task || typeof task !== 'string') {
    return NextResponse.json({ error: '"task" is required' }, { status: 400 });
  }

  let provider;
  try {
    provider = getProvider(providerName);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const executeTool = createFoodToolExecutor(supabase, user.id);
  const response = await provider.call(task, FOOD_TOOL_SCHEMAS, FOOD_MANAGEMENT_PROMPT, [], executeTool);

  return NextResponse.json({ response, provider: providerName });
}
