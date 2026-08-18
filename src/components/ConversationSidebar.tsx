'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Conversation = { id: number; title: string | null };

export default function ConversationSidebar({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id ? String(params.id) : null;
  const [creating, setCreating] = useState(false);

  async function handleNewChat() {
    setCreating(true);
    const res = await fetch('/api/conversations', { method: 'POST' });
    setCreating(false);
    if (!res.ok) return;
    const conversation = await res.json();
    router.push(`/chat/${conversation.id}`);
  }

  return (
    <div className="flex h-full w-64 flex-shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="p-3">
        <button
          onClick={handleNewChat}
          disabled={creating}
          className="w-full rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          + Chat nou
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <p className="px-2 py-2 text-sm text-neutral-400">Nicio conversație încă.</p>
        )}
        {conversations.map((c) => {
          const isActive = activeId === String(c.id);
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              title={c.title ?? 'Conversație nouă'}
              className={`block truncate rounded px-2 py-2 text-sm ${
                isActive ? 'bg-brand/10 text-brand' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {c.title || 'Conversație nouă'}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
