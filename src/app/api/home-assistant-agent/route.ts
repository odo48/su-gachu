import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runHomeAssistantAgentTurn } from '@/lib/home-assistant/agent';

// Stateless agentic endpoint, mirrors /api/food-agent. Ports jarvis-brain's
// home_assistant_agent (agent_registry.py) minus the top-level router — food
// and home_assistant are each called directly for now; the router that picks
// between specialist agents comes once biometrics/financial exist too.
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
    response = await runHomeAssistantAgentTurn({ supabase, userId: user.id, task, provider: providerName, history: [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  return NextResponse.json({ response, provider: providerName });
}
