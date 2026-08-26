import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AppNav from '@/components/AppNav';
import ConversationSidebar from '@/components/ConversationSidebar';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Vorbește cu antrenorul AI despre mâncare, somn, antrenament și cheltuieli.',
  robots: { index: false, follow: false },
};

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="flex h-dvh flex-col">
      <AppNav />
      <div className="flex min-h-0 flex-1">
        <ConversationSidebar conversations={conversations ?? []} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
