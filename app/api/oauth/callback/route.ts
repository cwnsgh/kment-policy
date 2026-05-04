import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  if (error) {
    logger.error("OAuth 에러", { error, error_description, state });
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const mall_id = state?.split(":")[0] || "";
    const errorUrl = `${baseUrl}/?error=oauth_failed&error_description=${encodeURIComponent(
      error_description || error,
    )}&mall_id=${mall_id}`;
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  const { data: stateData, error: stateError } = await supabaseAdmin
    .schema(POLICY_SCHEMA)
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .gte("expires_at", new Date().toISOString())
    .single();

  if (stateError || !stateData) {
    logger.error("State 검증 실패", { stateError, state });
    return NextResponse.json(
      { error: "Invalid or expired state parameter" },
      { status: 400 },
    );
  }

  const mall_id = stateData.mall_id as string;

  await supabaseAdmin
    .schema(POLICY_SCHEMA)
    .from("oauth_states")
    .delete()
    .eq("state", state);

  try {
    const credentials = btoa(
      `${process.env.CAFE24_CLIENT_ID}:${process.env.CAFE24_CLIENT_SECRET}`,
    );

    const tokenRes = await fetch(
      `https://${mall_id}.cafe24api.com/api/v2/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.CAFE24_REDIRECT_URI!,
        }),
      },
    );

    const token = await tokenRes.json();

    if (!token.access_token) {
      logger.error("토큰 요청 실패", {
        status: tokenRes.status,
        error: token.error,
        mall_id,
      });
      return NextResponse.json(
        { error: "Failed to get access token", details: token },
        { status: 500 },
      );
    }

    let storeInfo = null;
    try {
      const storeResponse = await fetch(
        `https://${mall_id}.cafe24api.com/api/v2/admin/store?shop_no=${
          token.shop_no || "1"
        }`,
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Content-Type": "application/json",
            "X-Cafe24-Api-Version":
              process.env.CAFE24_API_VERSION || "2025-12-01",
          },
        },
      );

      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        storeInfo = storeData.store;
      }
    } catch {
      // optional store fetch
    }

    const addTimezone = (dateStr: string | undefined) => {
      if (!dateStr) return undefined;
      return dateStr.endsWith("Z") || dateStr.includes("+")
        ? dateStr
        : dateStr + "+09:00";
    };

    const shopData = {
      mall_id: token.mall_id || mall_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: addTimezone(token.expires_at),
      refresh_expires_at: addTimezone(token.refresh_token_expires_at),
      user_id: token.user_id,
      shop_no: token.shop_no || "1",
      scopes: token.scopes,
      issued_at: addTimezone(token.issued_at),
      shop_name: storeInfo?.shop_name,
      primary_domain: storeInfo?.primary_domain,
      base_domain: storeInfo?.base_domain,
      country: storeInfo?.country,
      country_code: storeInfo?.country_code,
      enabled: true,
      created_at: addTimezone(token.issued_at) || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabaseAdmin
      .schema(POLICY_SCHEMA)
      .from("shops")
      .upsert(shopData);

    if (dbError) {
      logger.error("Supabase 저장 실패", { mall_id, dbError });
      return NextResponse.json(
        { error: "Failed to save to database", details: dbError },
        { status: 500 },
      );
    }

    const { createSession, setSessionCookie } =
      await import("@/lib/auth/session");

    const sessionToken = await createSession({
      mall_id: token.mall_id || mall_id,
      user_id: token.user_id,
      shop_no: token.shop_no || "1",
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUrl = `${baseUrl}/dashboard?mall_id=${mall_id}`;

    const response = NextResponse.redirect(redirectUrl);
    return setSessionCookie(response, sessionToken);
  } catch (err) {
    logger.error("OAuth Callback 오류", { err });
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? err instanceof Error
              ? err.message
              : String(err)
            : undefined,
      },
      { status: 500 },
    );
  }
}
