import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatThread from '@/components/ChatThread';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15);

  return <ChatThread conversationId={conversationId} initialMessages={(messages ?? []).reverse()} />;
}
