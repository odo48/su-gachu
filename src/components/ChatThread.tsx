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
          <p className="text-sm text-muted-foreground">Scrie ceva ca să începi conversația cu Food Agent-ul.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm sm:max-w-lg ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-muted-foreground">Se gândește...</p>}
      </div>

      {err && <p className="px-4 text-sm text-destructive">{err}</p>}

      <div className="flex min-w-0 items-center gap-2 border-t border-border p-3">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          disabled={loading}
          aria-label="Model"
          className="h-11 shrink-0 rounded-lg border border-input bg-background px-2 text-base disabled:opacity-50"
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
          maxLength={8000}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !prompt.trim()}
          className="h-11 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:px-4"
        >
          Trimite
        </button>
      </div>
    </div>
  );
}
