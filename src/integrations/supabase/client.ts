import { createClient } from "@supabase/supabase-js";
// NOTE: the generated ./types.ts is behind the live database schema
// (admin_messages, bank_transfer_requests, profiles.suspended, several RPCs).
// The client is intentionally loosely typed so schema drift cannot break the
// build; runtime behaviour is unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDatabase = any;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
  console.warn(
    `[Supabase] Missing env var(s): ${missing.join(", ")}. Set them as Cloudflare Pages build environment variables. Some features will not work until configured.`,
  );
}

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      `Missing Supabase environment variable(s). Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Cloudflare Pages environment variables.`,
    );
  }
  return createClient<LooseDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      _supabase = createSupabaseClient();
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
