/**
 * Supabase Server Client - 서버 컴포넌트/API 라우트용
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

// Check if URL is a valid Supabase URL (must start with https://)
function isValidSupabaseUrl(url: string | undefined): boolean {
  return url !== undefined && url.startsWith('https://') && url.includes('.supabase.co');
}

// Use placeholder values during build time to prevent errors
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_URL = isValidSupabaseUrl(envUrl) ? envUrl! : 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = envKey && envKey.length > 20 ? envKey : 'placeholder-key';
const SUPABASE_SERVICE_KEY = serviceKey && serviceKey.length > 20 ? serviceKey : 'placeholder-service-key';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  );
}

export async function createServiceRoleClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  );
}
