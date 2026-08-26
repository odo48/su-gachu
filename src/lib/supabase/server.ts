import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withSecureCookies } from '@/lib/security/cookies';

// Client legat de sesiunea userului (respectă RLS). În Next 15 cookies() e async.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withSecureCookies(options))
            );
          } catch {
            // apelat dintr-un Server Component — ignorăm (middleware reîmprospătează)
          }
        },
      },
    }
  );
}
