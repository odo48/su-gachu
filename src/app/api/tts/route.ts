import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { textToSpeech } from '@/lib/audio/tts';

// Mirrors jarvis-brain's POST /tts.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = body?.text;
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: '"text" is required' }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Textul e prea lung (max 2000 caractere).' }, { status: 400 });
  }

  try {
    const audio = await textToSpeech(text);
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
