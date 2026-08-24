import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEnableBankingToken } from '@/lib/enable-banking/jwt';

// Mirrors jarvis-backend's Controller/EnableBanking/GetTokenController.
// This is the app-level JWT (see lib/enable-banking/jwt.ts) — required for
// whatever account-linking/consent flow gets built next; requires auth only
// so it's not a public unauthenticated endpoint, not because the token
// itself is user-specific.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return NextResponse.json({ token: generateEnableBankingToken() });
}
