import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchFood } from '@/lib/openfoodfacts';

// GET /api/food/search?q=iaurt%20grecesc
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (!q) return NextResponse.json({ products: [] });
  const products = await searchFood(q);
  return NextResponse.json({ products });
}
