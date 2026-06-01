'use client';
import { createBrowserClient } from '@supabase/ssr';

// Client pentru componente client (browser).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
