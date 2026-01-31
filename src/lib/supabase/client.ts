/**
 * Supabase Client - 브라우저/서버 클라이언트 설정
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// Check if URL is a valid Supabase URL (must start with https://)
function isValidSupabaseUrl(url: string | undefined): boolean {
  return url !== undefined && url.startsWith('https://') && url.includes('.supabase.co');
}

// Use placeholder values during build time to prevent errors
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_URL = isValidSupabaseUrl(envUrl) ? envUrl! : 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = envKey && envKey.length > 20 ? envKey : 'placeholder-key';

export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
