import { supabase, POLICY_SCHEMA } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import type { PolicyShopRow } from "@/types/shop";

const shopCache = new Map<
  string,
  { data: PolicyShopRow | null; timestamp: number }
>();
const SHOP_CACHE_DURATION = 10 * 60 * 1000;

export async function getShopByMallId(
  mall_id: string
): Promise<PolicyShopRow | null> {
  const cached = shopCache.get(mall_id);
  if (cached && Date.now() - cached.timestamp < SHOP_CACHE_DURATION) {
    logger.info("캐시된 shop 정보 사용", { mall_id });
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .schema(POLICY_SCHEMA)
      .from("shops")
      .select("*")
      .eq("mall_id", mall_id)
      .single();

    if (error) {
      logger.error("쇼핑몰 정보 조회 실패", { mall_id, error });
      return null;
    }

    shopCache.set(mall_id, {
      data,
      timestamp: Date.now(),
    });

    return data as PolicyShopRow;
  } catch (error) {
    logger.error("쇼핑몰 정보 조회 중 예외 발생", { mall_id, error });
    return null;
  }
}

export function invalidateShopCache(mall_id: string): void {
  if (shopCache.has(mall_id)) {
    shopCache.delete(mall_id);
    logger.debug("shopCache 무효화", { mall_id });
  }
}
