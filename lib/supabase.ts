import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Uses the service role key so the API route can
 * insert appointments while the table stays locked down to the public.
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
