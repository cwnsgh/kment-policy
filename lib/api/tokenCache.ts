/**
 * 인메모리 토큰 캐시 (kment-widget과 동일 패턴)
 */

import { logger } from "@/lib/utils/logger";

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
  isRefreshing: boolean;
  refreshPromise?: Promise<string | { reinstallRequired: true } | null>;
}

class TokenCache {
  private cache = new Map<string, CachedToken>();
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

  constructor() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  get(mallId: string): CachedToken | undefined {
    return this.cache.get(mallId);
  }

  set(mallId: string, accessToken: string, expiresAt: Date): void {
    this.cache.set(mallId, {
      accessToken,
      expiresAt,
      isRefreshing: false,
    });
    logger.debug("토큰 캐시 저장", { mallId, expiresAt });
  }

  setRefreshing(
    mallId: string,
    refreshPromise: Promise<string | { reinstallRequired: true } | null>
  ): void {
    const cached = this.cache.get(mallId);
    if (cached) {
      cached.isRefreshing = true;
      cached.refreshPromise = refreshPromise;
      logger.debug("토큰 갱신 시작", { mallId });
    }
  }

  setRefreshed(mallId: string, accessToken: string, expiresAt: Date): void {
    this.cache.set(mallId, {
      accessToken,
      expiresAt,
      isRefreshing: false,
    });
    logger.debug("토큰 갱신 완료", { mallId, expiresAt });
  }

  setRefreshFailed(mallId: string): void {
    this.cache.delete(mallId);
    logger.debug("토큰 갱신 실패, 캐시 삭제", { mallId });
  }

  delete(mallId: string): void {
    this.cache.delete(mallId);
    logger.debug("토큰 캐시 삭제", { mallId });
  }

  invalidate(mallId: string): void {
    this.delete(mallId);
    logger.info("토큰 캐시 무효화", { mallId });
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info("전체 토큰 캐시 무효화", { clearedCount: size });
  }

  isExpired(expiresAt: Date, bufferMinutes: number = 5): boolean {
    const now = new Date();
    const bufferTime = bufferMinutes * 60 * 1000;
    return now.getTime() + bufferTime >= expiresAt.getTime();
  }

  private cleanupExpiredCache(): void {
    let cleanedCount = 0;
    for (const [mallId, cached] of this.cache.entries()) {
      if (this.isExpired(cached.expiresAt, 0) && !cached.isRefreshing) {
        this.cache.delete(mallId);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.debug("만료된 캐시 정리", { cleanedCount });
    }
  }
}

export const tokenCache = new TokenCache();
