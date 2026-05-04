import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config/env";

/** 브라우저용 (shops 조회 등) */
export const supabase: SupabaseClient = createClient(
  config.supabase.url || "https://placeholder.supabase.co",
  config.supabase.anonKey || "placeholder-anon-key"
);

/** 서버 전용 — RLS 우회. API Route에서만 사용 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url || "https://placeholder.supabase.co",
  config.supabase.serviceRoleKey || "placeholder-service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/** 이 앱은 Supabase 스키마 `policy` 사용 (punding의 `punding`과 분리) */
export const POLICY_SCHEMA = "policy" as const;
