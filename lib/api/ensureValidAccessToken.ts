/**
 * 카페24 OAuth access_token 생명주기 (kment-widget과 동일 패턴)
 * — DB 갱신은 service role + policy 스키마 (anon은 UPDATE 없음)
 */

import { getShopByMallId, invalidateShopCache } from "@/lib/api/getShop";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import { config } from "@/lib/config/env";
import { tokenCache } from "@/lib/api/tokenCache";
import type { Cafe24TokenResponse, TokenRefreshResult } from "@/types/shop";

function shopsTable() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("shops");
}

/** 카페24/ OAuth가 refresh 실패 시 내는 오류 문자열 (형식이 환경마다 조금 다를 수 있음) */
function isInvalidGrantError(err: string | undefined): boolean {
  if (!err) return false;
  const e = err.toLowerCase();
  return (
    e === "invalid_grant" ||
    e.includes("invalid_grant") ||
    e.includes("invalid refresh") ||
    e.includes("token was revoked")
  );
}

export async function ensureValidAccessToken(
  mall_id: string
): Promise<string | { reinstallRequired: true } | null> {
  const cached = tokenCache.get(mall_id);

  if (cached?.isRefreshing && cached.refreshPromise) {
    logger.debug("토큰 갱신 중, 완료될 때까지 대기", { mall_id });
    return await cached.refreshPromise;
  }

  if (cached && !tokenCache.isExpired(cached.expiresAt)) {
    logger.debug("캐시에서 유효한 토큰 반환", { mall_id });
    return cached.accessToken;
  }

  const refreshToken = async (): Promise<
    string | { reinstallRequired: true } | null
  > => {
    let actualMallId: string | undefined;
    try {
      const shop = await getShopByMallId(mall_id);
      if (!shop) {
        logger.error("쇼핑몰 정보를 찾을 수 없음", { mall_id });
        return null;
      }

      actualMallId = shop.mall_id;
      const actualMallIdStr = shop.mall_id;
      const now = new Date();

      if (
        shop.access_token &&
        shop.expires_at &&
        new Date(shop.expires_at) > now
      ) {
        logger.info("DB에서 유효한 토큰 발견", { mall_id });
        tokenCache.set(mall_id, shop.access_token, new Date(shop.expires_at));
        return shop.access_token;
      }

      const refreshExpiresAt = shop.refresh_expires_at
        ? new Date(shop.refresh_expires_at)
        : null;

      const refreshTokenValid = refreshExpiresAt
        ? refreshExpiresAt > now
        : !!shop.refresh_token;

      if (refreshTokenValid && shop.refresh_token) {
        logger.info("토큰 만료, refresh_token으로 갱신 시도", { mall_id });

        const refreshResult = await refreshCafe24Token(
          actualMallIdStr,
          shop.refresh_token
        );

        if (refreshResult.success && refreshResult.access_token) {
          const exp = refreshResult.expires_at
            ? new Date(refreshResult.expires_at)
            : new Date(Date.now() + 7200 * 1000);
          tokenCache.set(mall_id, refreshResult.access_token, exp);
          logger.info("토큰 갱신 성공", { mall_id });
          return refreshResult.access_token;
        }

        logger.error("토큰 갱신 실패", {
          mall_id,
          error: refreshResult.error,
        });

        if (isInvalidGrantError(refreshResult.error)) {
          logger.error("refresh_token 만료/무효화, 재인증 필요", { mall_id });
          await handleTokenExpiration(actualMallIdStr);
          tokenCache.setRefreshFailed(mall_id);
          invalidateShopCache(mall_id);
          invalidateShopCache(actualMallIdStr);
          return { reinstallRequired: true };
        }

        tokenCache.setRefreshFailed(mall_id);
        invalidateShopCache(mall_id);
        invalidateShopCache(actualMallIdStr);
        return null;
      }

      logger.error("Access Token과 Refresh Token 모두 만료", { mall_id });
      await handleTokenExpiration(actualMallIdStr);
      tokenCache.setRefreshFailed(mall_id);
      invalidateShopCache(mall_id);
      invalidateShopCache(actualMallIdStr);
      return { reinstallRequired: true };
    } catch (error) {
      logger.error("토큰 갱신 중 오류 발생", { mall_id, error });
      tokenCache.setRefreshFailed(mall_id);
      invalidateShopCache(mall_id);
      if (actualMallId) invalidateShopCache(actualMallId);
      return null;
    }
  };

  logger.debug("토큰 갱신 시작", { mall_id });

  const refreshPromise = refreshToken();
  tokenCache.setRefreshing(mall_id, refreshPromise);

  const currentCached = tokenCache.get(mall_id);
  if (
    currentCached?.isRefreshing &&
    currentCached.refreshPromise &&
    currentCached.refreshPromise !== refreshPromise
  ) {
    logger.debug("다른 요청이 먼저 갱신을 시작함, 대기", { mall_id });
    return await currentCached.refreshPromise;
  }

  return await refreshPromise;
}

async function refreshCafe24Token(
  mallId: string,
  refreshTokenValue: string
): Promise<TokenRefreshResult> {
  try {
    logger.info("토큰 갱신 시작", { mallId });

    const credentials = Buffer.from(
      `${config.cafe24.clientId}:${config.cafe24.clientSecret}`
    ).toString("base64");

    const response = await fetch(
      `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshTokenValue,
        }),
      }
    );

    const tokenData: Cafe24TokenResponse = await response.json();

    if (!response.ok || !tokenData.access_token) {
      logger.error("토큰 갱신 실패", {
        mallId,
        status: response.status,
        error: tokenData,
      });
      return {
        success: false,
        error:
          tokenData.error ||
          tokenData.error_description ||
          "토큰 갱신 실패",
      };
    }

    const addTimezone = (dateStr: string | undefined) => {
      if (!dateStr) return undefined;
      return dateStr.endsWith("Z") || dateStr.includes("+")
        ? dateStr
        : dateStr + "+09:00";
    };

    const updateRow: Record<string, unknown> = {
      access_token: tokenData.access_token,
      expires_at: addTimezone(tokenData.expires_at),
      updated_at: new Date().toISOString(),
    };
    // 응답에 refresh_token이 없을 때 기존 값을 null로 덮어쓰면 다음 갱신이 영구 실패함
    if (
      typeof tokenData.refresh_token === "string" &&
      tokenData.refresh_token.length > 0
    ) {
      updateRow.refresh_token = tokenData.refresh_token;
      updateRow.refresh_expires_at = addTimezone(
        tokenData.refresh_token_expires_at
      );
    }

    const { error: updateError } = await shopsTable()
      .update(updateRow)
      .eq("mall_id", mallId);

    if (updateError) {
      logger.error("토큰 저장 실패", { mallId, updateError });
      return {
        success: false,
        error: "토큰 저장 실패",
      };
    }

    invalidateShopCache(mallId);

    const expiresAtWithTimezone = addTimezone(tokenData.expires_at);
    const expiresAtDate = expiresAtWithTimezone
      ? new Date(expiresAtWithTimezone)
      : new Date(Date.now() + 7200 * 1000);

    tokenCache.setRefreshed(mallId, tokenData.access_token, expiresAtDate);

    logger.info("토큰 갱신 성공", { mallId });
    return {
      success: true,
      access_token: tokenData.access_token,
      expires_at: addTimezone(tokenData.expires_at),
    };
  } catch (error) {
    logger.error("토큰 갱신 중 오류", { mallId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

async function handleTokenExpiration(mallId: string): Promise<void> {
  try {
    await shopsTable()
      .update({
        access_token: null,
        refresh_token: null,
        expires_at: null,
        refresh_expires_at: null,
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("mall_id", mallId);

    invalidateShopCache(mallId);
    logger.info("토큰 만료 처리 완료", { mallId });
  } catch (error) {
    logger.error("토큰 만료 처리 중 오류", { mallId, error });
  }
}

export function isTokenExpired(
  expiresAt: string,
  bufferMinutes: number = 5
): boolean {
  if (!expiresAt) return true;
  const now = new Date();
  const expirationTime = new Date(expiresAt);
  const bufferTime = bufferMinutes * 60 * 1000;
  return now.getTime() + bufferTime >= expirationTime.getTime();
}

export async function refreshAllTokens(): Promise<{
  success: number;
  failed: number;
}> {
  try {
    logger.info("모든 쇼핑몰 토큰 갱신 시작");

    const { data: shops, error } = await shopsTable()
      .select("mall_id, refresh_token, expires_at")
      .eq("enabled", true);

    if (error || !shops) {
      logger.error("쇼핑몰 목록 조회 실패", { error });
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const shop of shops as {
      mall_id: string;
      refresh_token: string | null;
      expires_at: string | null;
    }[]) {
      if (!shop.refresh_token) {
        failedCount++;
        continue;
      }
      if (shop.expires_at && !isTokenExpired(shop.expires_at, 30)) {
        logger.info("토큰 갱신 불필요", { mall_id: shop.mall_id });
        continue;
      }

      const result = await refreshCafe24Token(shop.mall_id, shop.refresh_token);

      if (result.success) {
        successCount++;
        logger.info("토큰 갱신 성공", { mall_id: shop.mall_id });
      } else {
        failedCount++;
        logger.error("토큰 갱신 실패", {
          mall_id: shop.mall_id,
          error: result.error,
        });
      }
    }

    logger.info("토큰 갱신 완료", {
      success: successCount,
      failed: failedCount,
    });
    return { success: successCount, failed: failedCount };
  } catch (error) {
    logger.error("일괄 토큰 갱신 중 오류", { error });
    return { success: 0, failed: 0 };
  }
}

export async function checkTokenStatus(mallId: string): Promise<{
  valid: boolean;
  expiresIn: number;
  needsRefresh: boolean;
}> {
  try {
    const { data: shop, error } = await shopsTable()
      .select("expires_at")
      .eq("mall_id", mallId)
      .single();

    if (error || !shop?.expires_at) {
      return { valid: false, expiresIn: 0, needsRefresh: false };
    }

    const now = new Date();
    const expirationTime = new Date(shop.expires_at as string);
    const expiresIn = Math.max(0, expirationTime.getTime() - now.getTime());
    const valid = expiresIn > 0;
    const needsRefresh = isTokenExpired(shop.expires_at as string, 5);

    return { valid, expiresIn, needsRefresh };
  } catch (error) {
    logger.error("토큰 상태 확인 중 오류", { mallId, error });
    return { valid: false, expiresIn: 0, needsRefresh: false };
  }
}
