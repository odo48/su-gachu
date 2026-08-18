'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = 'gemini' | 'claude';
type Message = { id: number | string; role: 'user' | 'assistant'; content: string; provider?: Provider | null };

export default function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: number;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const content = prompt.trim();
    if (!content || loading) return;

    setPrompt('');
    setErr(null);
    setLoading(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content }]);

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, provider }),
    });
    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'Eroare la trimitere');
      return;
    }

    const { assistantMessage } = await res.json();
    setMessages((prev) => [...prev, assistantMessage]);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">Scrie ceva ca să începi conversația cu Food Agent-ul.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-lg whitespace-pre-wrap rounded px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-neutral-400">Se gândește...</p>}
      </div>

      {err && <p className="px-4 text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-2 border-t border-neutral-200 p-3">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          disabled={loading}
          className="rounded border border-gray-300 px-2 py-2 text-sm disabled:opacity-50"
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
          placeholder="Scrie un mesaj..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !prompt.trim()}
          className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Trimite
        </button>
      </div>
    </div>
  );
}
