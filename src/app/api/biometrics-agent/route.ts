import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runBiometricsAgentTurn } from '@/lib/biometrics/agent';

// Stateless agentic endpoint, mirrors /api/food-agent and /api/home-assistant-agent.
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
    response = await runBiometricsAgentTurn({ supabase, userId: user.id, task, provider: providerName, history: [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  return NextResponse.json({ response, provider: providerName });
}
