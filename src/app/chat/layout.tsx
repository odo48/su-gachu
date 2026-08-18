import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ConversationSidebar from '@/components/ConversationSidebar';

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
    <div className="flex h-screen">
      <ConversationSidebar conversations={conversations ?? []} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h1 className="font-semibold">Food Agent</h1>
          <Link href="/dashboard" className="text-sm text-brand underline">
            ← Dashboard
          </Link>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
