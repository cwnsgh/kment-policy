import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import crypto from "crypto";

/**
 * 카페24 앱 실행 URL(쿼리 파라미터) → HMAC 검증 → 세션 쿠키 → 대시보드
 * 최초 설치/토큰 없음이면 루트로 OAuth 유도 리다이렉트
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const mall_id = searchParams.get("mall_id");
    const user_id = searchParams.get("user_id");
    const shop_no = searchParams.get("shop_no");
    const timestamp = searchParams.get("timestamp");
    const hmac = searchParams.get("hmac");

    if (!mall_id) {
      return NextResponse.json(
        {
          success: false,
          error: "mall_id parameter is required",
          code: "MISSING_MALL_ID",
        },
        { status: 400 },
      );
    }

    if (!user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id parameter is required",
          code: "MISSING_USER_ID",
        },
        { status: 400 },
      );
    }

    if (hmac) {
      const clientSecret = process.env.CAFE24_CLIENT_SECRET;
      if (!clientSecret) {
        return NextResponse.json(
          {
            success: false,
            error: "CAFE24_CLIENT_SECRET not set",
            code: "MISSING_SECRET",
          },
          { status: 500 },
        );
      }

      const isValid = verifyHMAC(req.url, hmac, clientSecret);
      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid HMAC",
            code: "INVALID_HMAC",
          },
          { status: 401 },
        );
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            success: false,
            error: "HMAC parameter is required in production",
            code: "MISSING_HMAC",
          },
          { status: 400 },
        );
      }
    }

    if (!timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: "timestamp parameter is required",
          code: "MISSING_TIMESTAMP",
        },
        { status: 400 },
      );
    }

    const requestTime = parseInt(timestamp, 10) * 1000;
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    const maxAge = 2 * 60 * 60 * 1000;

    if (timeDiff > maxAge) {
      return NextResponse.json(
        {
          success: false,
          error: "Request timestamp is too old",
          code: "TIMESTAMP_TOO_OLD",
        },
        { status: 401 },
      );
    }

    const { data: shop, error: shopError } = await supabaseAdmin
      .schema(POLICY_SCHEMA)
      .from("shops")
      .select("*")
      .eq("mall_id", mall_id)
      .single();

    if (shopError || !shop) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      return NextResponse.redirect(
        `${baseUrl}/?mall_id=${mall_id}&oauth_required=true`,
      );
    }

    if (!shop.access_token || !shop.refresh_token) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      return NextResponse.redirect(
        `${baseUrl}/?mall_id=${mall_id}&oauth_required=true`,
      );
    }

    const sessionToken = await createSession({
      mall_id,
      user_id: user_id || undefined,
      shop_no: shop_no || undefined,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUrl = `${baseUrl}/dashboard?mall_id=${mall_id}`;

    const response = NextResponse.redirect(redirectUrl);
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    logger.error("session-from-cafe24 오류", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
}

function verifyHMAC(
  fullUrl: string,
  receivedHmac: string,
  secretKey: string,
): boolean {
  try {
    const urlObj = new URL(fullUrl);
    const queryString = urlObj.search.substring(1);
    const lastIndexOfAmpersand = queryString.lastIndexOf("&hmac=");
    if (lastIndexOfAmpersand === -1) {
      return false;
    }

    const plain_query = queryString.substring(0, lastIndexOfAmpersand);
    const computedHmac = crypto
      .createHmac("sha256", secretKey)
      .update(plain_query, "utf-8")
      .digest("base64");

    const decodedReceivedHmac = decodeURIComponent(receivedHmac);
    return computedHmac === decodedReceivedHmac;
  } catch {
    return false;
  }
}
