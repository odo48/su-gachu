/**
 * Proxy TTS spre jarvis-brain /tts (ElevenLabs).
 * POST { text: string } → audio/mpeg stream
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

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });

  try {
    const brainRes = await fetch(`${BRAIN_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brain-Token': MCP_SECRET,
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!brainRes.ok) {
      const errText = await brainRes.text();
      return NextResponse.json({ error: `TTS error: ${errText}` }, { status: 502 });
    }

    const audioBuffer = await brainRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Brain unreachable' }, { status: 502 });
  }
}
