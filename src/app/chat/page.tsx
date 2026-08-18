import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Entry point for /chat — mirrors jarvis-ui's pages/index.js: redirect into
// the most recently active conversation, or create one if none exist yet.
export default async function ChatIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/chat/${existing.id}`);

  const { data: created } = await supabase.from('conversations').insert({ user_id: user.id }).select('id').single();
  redirect(`/chat/${created!.id}`);
}
