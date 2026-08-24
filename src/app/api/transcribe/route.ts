import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/audio/transcribe';

// Mirrors jarvis-brain's POST /transcribe.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const audioData = await req.arrayBuffer();
  const contentType = req.headers.get('content-type') ?? 'audio/webm';

  try {
    const text = await transcribeAudio(audioData, contentType);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
