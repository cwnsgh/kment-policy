/**
 * HttpOnly 쿠키 기반 세션 (JWT)
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/lib/utils/logger";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET 환경 변수가 설정되지 않았습니다!");
    }
    return new TextEncoder().encode("dev-secret-key");
  }
  return new TextEncoder().encode(secret);
};

export const COOKIE_NAME = "kment_policy_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionData {
  mall_id: string;
  user_id?: string;
  shop_no?: string;
  iat: number;
  exp: number;
}

export async function createSession(data: {
  mall_id: string;
  user_id?: string;
  shop_no?: string;
}): Promise<string> {
  const JWT_SECRET = getJwtSecret();

  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(
  token: string
): Promise<SessionData | null> {
  try {
    const JWT_SECRET = getJwtSecret();
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (
      typeof payload.mall_id === "string" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number"
    ) {
      return payload as unknown as SessionData;
    }

    return null;
  } catch (error) {
    logger.error("세션 검증 실패", { error });
    return null;
  }
}

export async function getSession(
  req: NextRequest
): Promise<SessionData | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return await verifySession(token);
}

export function setSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function getSessionMallId(
  req: NextRequest
): Promise<string | null> {
  const session = await getSession(req);
  return session?.mall_id || null;
}
