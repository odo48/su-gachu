/**
 * Proxy authenticated chat requests spre jarvis-brain.
 * Validează sesiunea Supabase, adaugă X-Brain-Token și forwrardează.
 * POST { message: string, history?: {role,content}[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatGarminContextForChat } from '@/lib/garmin-context';

const BRAIN_URL   = process.env.BRAIN_URL ?? 'http://localhost:5000';
const MCP_SECRET  = process.env.MCP_SECRET ?? '';

export const maxDuration = 60; // seconds — long-running AI calls

export async function POST(req: NextRequest) {
  // Validare sesiune utilizator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { message } = body as { message: string };
  if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: metricsRows } = await supabase
    .from('daily_metrics')
    .select('date, source, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, raw')
    .eq('user_id', user.id)
    .eq('source', 'garmin')
    .gte('date', weekAgo.toISOString().slice(0, 10))
    .lte('date', today)
    .order('date', { ascending: false });

  const garminBlock = formatGarminContextForChat(metricsRows ?? []);
  const fullPrompt = `${garminBlock}\n\n---\n\nÎntrebare utilizator:\n${message.trim()}`;

  try {
    const brainRes = await fetch(
      `${BRAIN_URL}/chat?prompt=${encodeURIComponent(fullPrompt)}`,
      {
        headers: {
          'X-Brain-Token': MCP_SECRET,
          'X-User-Id': user.id,
        },
        signal: AbortSignal.timeout(55_000),
      }
    );

    if (!brainRes.ok) {
      const text = await brainRes.text();
      return NextResponse.json({ error: `Brain error: ${text}` }, { status: 502 });
    }

    const data = await brainRes.json();
    // Returnează răspunsul preferat (Gemini > Claude)
    const responseText: string = data.gemini ?? data.claude ?? 'Fără răspuns.';

    return NextResponse.json({
      message: responseText,
      gemini: data.gemini,
      claude: data.claude,
      audio: data.audio ?? null, // base64 mp3 dacă brain-ul a generat TTS
    });
  } catch (e: any) {
    if (e?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout — brain nu a răspuns în 55s' }, { status: 504 });
    }
    return NextResponse.json({ error: e?.message ?? 'Brain unreachable' }, { status: 502 });
  }
}
