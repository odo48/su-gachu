import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runFoodAgentTurn } from '@/lib/food/agent';

// Agentic food-planning endpoint: ports jarvis-brain's food_agent (prompt +
// tool-calling loop) into su-gachu. Stateless — history is always empty.
// For persisted multi-turn conversations, see /api/conversations/[id]/messages.
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

  let response: string;
  try {
    response = await runFoodAgentTurn({ supabase, userId: user.id, task, provider: providerName, history: [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  return NextResponse.json({ response, provider: providerName });
}
