import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runRouterTurn } from '@/lib/agents/router';
import type { ChatMessage } from '@/lib/ai/types';

// Mirrors jarvis-backend's ListConversationMessagesController /
// CreateConversationMessageController, collapsed into one POST since
// su-gachu has no separate brain microservice to orchestrate the two
// backend calls jarvis-brain's BrainService.get_chat_response makes.
// Delegates to the top-level router (lib/agents/router.ts) rather than a
// single domain agent, so one conversation can span food/home_assistant/
// biometrics/financial depending on what's enabled for this user.

async function getOwnedConversation(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: number) {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const conversation = await getOwnedConversation(supabase, user.id, conversationId);
  if (!conversation) return NextResponse.json({ error: `Conversation ${conversationId} not found.` }, { status: 404 });

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 15);
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data ?? []).reverse());
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const conversation = await getOwnedConversation(supabase, user.id, conversationId);
  if (!conversation) return NextResponse.json({ error: `Conversation ${conversationId} not found.` }, { status: 404 });

  const body = await req.json().catch(() => null);
  const content = body?.content;
  const providerName = body?.provider ?? 'gemini';
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: '"content" is required' }, { status: 400 });
  }

  // 1. History for LLM context, before this turn's messages exist.
  const { data: recent, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15);
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });
  const history: ChatMessage[] = (recent ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));

  // 2. Persist the user message; auto-title on first message, bump updated_at.
  const { data: userMessage, error: userMsgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'user', content })
    .select()
    .single();
  if (userMsgError) return NextResponse.json({ error: userMsgError.message }, { status: 500 });

  const titleUpdate = !conversation.title ? { title: content.length > 80 ? `${content.slice(0, 80)}…` : content } : {};
  await supabase
    .from('conversations')
    .update({ ...titleUpdate, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // 3. Run the agent turn.
  let response: string;
  try {
    response = await runRouterTurn({ supabase, userId: user.id, task: content, provider: providerName, history });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  // 4. Persist the assistant message, bump updated_at again.
  const { data: assistantMessage, error: assistantMsgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'assistant', content: response, provider: providerName })
    .select()
    .single();
  if (assistantMsgError) return NextResponse.json({ error: assistantMsgError.message }, { status: 500 });

  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

  return NextResponse.json({ userMessage, assistantMessage }, { status: 201 });
}
