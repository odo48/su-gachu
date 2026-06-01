import { NextRequest, NextResponse } from 'next/server';
import { searchFood } from '@/lib/openfoodfacts';

// GET /api/food/search?q=iaurt%20grecesc
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ products: [] });
  const products = await searchFood(q);
  return NextResponse.json({ products });
}
