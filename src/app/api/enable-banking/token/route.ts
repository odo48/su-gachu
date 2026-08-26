import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Intentionally closed: JWTs must stay server-side. */
export async function GET() {
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
