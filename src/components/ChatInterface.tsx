"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  gemini?: string;
  claude?: string;
};

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10v1a7 7 0 0 1-14 0v-1"
      />
      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── TTS ────────────────────────────────────────────────────────────────────
  const playTTS = useCallback(
    async (text: string) => {
      if (!ttsEnabled || !text?.trim()) return;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {});
      } catch {}
    },
    [ttsEnabled]
  );

  const playBase64Audio = useCallback((b64: string) => {
    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    audio.play().catch(() => {});
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev, { id, role: "user", content: text }]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        const content =
          data.message ?? data.gemini ?? data.claude ?? "Fără răspuns.";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            gemini: data.gemini,
            claude: data.claude,
          },
        ]);

        if (data.audio) {
          playBase64Audio(data.audio);
        } else {
          playTTS(content);
        }
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Eroare: ${e?.message ?? "Brain inaccesibil."}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [playTTS, playBase64Audio]
  );

  // ── Voice recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      audioChunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunks.current, { type: mime });
        if (!blob.size) return;

        setTranscribing(true);
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": mime },
            body: blob,
          });
          const data = await res.json();
          if (data.text?.trim()) {
            setTranscribing(false);
            await send(data.text);
          }
        } catch {
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      alert("Nu pot accesa microfonul. Verifică permisiunile.");
    }
  }, [send]);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else startRecording();
  }, [recording, startRecording, stopRecording]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      send(input);
    },
    [input, send]
  );

  const disabled = loading || transcribing;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Chat cu Su Gachu</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTtsEnabled((v) => !v)}
          title={ttsEnabled ? "Dezactivează voce" : "Activează voce"}
          className={cn(
            "rounded-full",
            ttsEnabled
              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300"
              : "text-muted-foreground"
          )}
        >
          <SpeakerIcon className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm pt-16">
            <p className="text-3xl mb-3">🤖</p>
            <p>Salut! Sunt Su Gachu. Pot să planific mesele săptămânii,</p>
            <p>
              să-ți arăt macronutrienții sau să te ajut cu lista de cumpărături.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-card-foreground shadow-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {transcribing && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              Se transcrie vocea...
            </div>
          </div>
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <span className="inline-flex gap-1">
                <span
                  className="animate-bounce"
                  style={{ animationDelay: "0ms" }}
                >
                  ●
                </span>
                <span
                  className="animate-bounce"
                  style={{ animationDelay: "150ms" }}
                >
                  ●
                </span>
                <span
                  className="animate-bounce"
                  style={{ animationDelay: "300ms" }}
                >
                  ●
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 pt-3 border-t border-border"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            recording
              ? "Înregistrează vocea..."
              : transcribing
              ? "Se procesează..."
              : "Scrie sau înregistrează..."
          }
          disabled={disabled || recording}
          className="input flex-1 rounded-full"
        />

        <Button
          type="button"
          variant={recording ? "destructive" : "secondary"}
          size="icon"
          onClick={toggleRecording}
          disabled={disabled}
          className={cn(
            "rounded-full h-11 w-11 shrink-0",
            recording && "animate-pulse ring-2 ring-destructive/40"
          )}
          title={recording ? "Oprește înregistrarea" : "Înregistrează voce"}
        >
          {recording ? (
            <StopIcon className="w-5 h-5" />
          ) : (
            <MicIcon className="w-5 h-5" />
          )}
        </Button>

        <Button
          type="submit"
          disabled={disabled || recording || !input.trim()}
          className="rounded-full h-11 px-4 shrink-0"
        >
          <SendIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Trimite</span>
        </Button>
      </form>
    </div>
  );
}
