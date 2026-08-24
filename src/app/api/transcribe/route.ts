/**
 * Proxy transcription spre jarvis-brain /transcribe (Groq Whisper).
 * Primește audio raw body, forwrardează la brain, returnează { text }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BRAIN_URL  = process.env.BRAIN_URL ?? 'http://localhost:5000';
const MCP_SECRET = process.env.MCP_SECRET ?? '';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? 'audio/webm';
  const audioData   = await req.arrayBuffer();

  if (!audioData.byteLength) {
    return NextResponse.json({ error: 'No audio data' }, { status: 400 });
  }

  try {
    const brainRes = await fetch(`${BRAIN_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-Brain-Token': MCP_SECRET,
      },
      body: audioData,
      signal: AbortSignal.timeout(25_000),
    });

    if (!brainRes.ok) {
      const text = await brainRes.text();
      return NextResponse.json({ error: `Transcription error: ${text}` }, { status: 502 });
    }

    const data = await brainRes.json();
    return NextResponse.json({ text: data.text ?? '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Brain unreachable' }, { status: 502 });
  }
}
