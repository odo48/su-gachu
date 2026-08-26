import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { parseAuthBody } from '@/lib/security/auth';

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: 'Prea multe încercări. Reîncearcă în 15 minute.' }, { status: 429 });
  }

  const parsed = parseAuthBody(await req.json().catch(() => null));
  if ('honeypot' in parsed) {
    return NextResponse.json({ ok: true });
  }
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
