import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function resolveSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Supabase URL is not configured");
  }
  return url;
}

function resolveSupabaseKey(): string {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return serviceKey;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) return anonKey;
  throw new Error("Supabase key is not configured");
}

export function getServerSupabaseClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(resolveSupabaseUrl(), resolveSupabaseKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "tripay-ai-expenses" } },
    });
  }
  return cached;
}
