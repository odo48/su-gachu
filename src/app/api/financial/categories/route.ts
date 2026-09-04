import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mirrors jarvis-backend's Controller/Financial/ListCategoriesController.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('categories').select('id, name, icon, kind').eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
