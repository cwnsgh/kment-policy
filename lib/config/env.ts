/**
 * 환경변수 검증 및 설정
 */

export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CAFE24_CLIENT_ID",
    "CAFE24_CLIENT_SECRET",
    "CAFE24_REDIRECT_URI",
    "JWT_SECRET",
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  cafe24: {
    clientId: process.env.CAFE24_CLIENT_ID || "",
    clientSecret: process.env.CAFE24_CLIENT_SECRET || "",
    redirectUri: process.env.CAFE24_REDIRECT_URI || "",
    apiVersion: process.env.CAFE24_API_VERSION || "2025-12-01",
    baseUrl: process.env.CAFE24_BASE_URL || "cafe24api.com",
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isProduction: process.env.NODE_ENV === "production",
  },
};
