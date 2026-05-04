"use client";

import { useEffect, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getShopByMallId } from "@/lib/api/getShop";
import { FullPageLoader } from "@/components/FullPageLoader";
import styles from "./page.module.css";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [shopStatus, setShopStatus] = useState<{
    enabled?: boolean;
  } | null>(null);

  const mall_id = searchParams.get("mall_id");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  const generateState = (mallId: string): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const randomHex = Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${mallId}:${randomHex}`;
  };

  useEffect(() => {
    if (!mall_id) {
      setLoading(false);
      return;
    }

    const oauthRequired = searchParams.get("oauth_required");
    if (oauthRequired === "true") {
      const state = generateState(mall_id);
      window.location.href = `/api/oauth/authorize?mall_id=${mall_id}&state=${encodeURIComponent(
        state,
      )}`;
      return;
    }

    const timestamp = searchParams.get("timestamp");
    const hmac = searchParams.get("hmac");
    const user_id = searchParams.get("user_id");

    if (timestamp && (hmac || user_id)) {
      createSessionFromCafe24();
    } else {
      checkShopStatus();
    }
  }, [mall_id]);

  const createSessionFromCafe24 = async () => {
    try {
      setSessionCreating(true);
      const apiUrl = `/api/auth/session-from-cafe24?${searchParams.toString()}`;
      window.location.href = apiUrl;
    } catch (e) {
      console.error(e);
      setSessionCreating(false);
      setLoading(false);
    }
  };

  const checkShopStatus = async () => {
    try {
      const shop = await getShopByMallId(mall_id!);
      setShopStatus(shop);

      if (shop?.enabled && mall_id) {
        router.push(`/dashboard?mall_id=${mall_id}`);
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = () => {
    if (mall_id) {
      const state = generateState(mall_id);
      window.location.href = `/api/oauth/authorize?mall_id=${mall_id}&state=${encodeURIComponent(
        state,
      )}`;
    }
  };

  if (loading || sessionCreating) {
    return (
      <FullPageLoader
        label={sessionCreating ? "세션 생성 중..." : "로딩 중..."}
      />
    );
  }

  if (!mall_id) {
    return (
      <div className={styles.pageCenter}>
        <div className={styles.card}>
          <h1 className={styles.title}>Kment Policy</h1>
          <p className={styles.muted}>
            카페24 앱스토어에서 실행하면 <code>mall_id</code>가 붙습니다. 수동
            OAuth는 아래 링크를 사용하세요.
          </p>
          <a className={styles.linkButton} href="/authorize">
            수동 인증 (/authorize)
          </a>
        </div>
      </div>
    );
  }

  if (error === "oauth_failed") {
    return (
      <div className={styles.pageCenter}>
        <div className={styles.card}>
          <h1 className={styles.title}>권한 요청 실패</h1>
          <p className={styles.errorText}>
            {error_description || "알 수 없는 오류"}
          </p>
          <button
            type="button"
            className={styles.primaryButtonLarge}
            onClick={handleAuthorize}
          >
            다시 권한 요청
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageShell}>
      <div className={styles.homeInner}>
        <div className={styles.headerBlock}>
          <h1 className={styles.pageHeading}>Kment Policy</h1>
          <p className={styles.subtitle}>
            인증 스타터 — 카페24 OAuth까지 동일 패턴
          </p>
        </div>

        <div className={styles.cardSoft}>
          <h3 className={styles.sectionTitle}>쇼핑몰</h3>
          <p className={styles.mallMono}>{mall_id}</p>
        </div>

        {shopStatus?.enabled ? (
          <div className={styles.bannerGreen}>
            <p className={styles.bannerText}>이미 연결되어 있습니다.</p>
            <button
              type="button"
              className={styles.successButton}
              onClick={() => router.push(`/dashboard?mall_id=${mall_id}`)}
            >
              대시보드
            </button>
          </div>
        ) : (
          <div className={styles.bannerAmber}>
            <p className={styles.bannerText}>
              최초 설치 시 카페24 권한 승인(OAuth)이 필요합니다.
            </p>
            <button
              type="button"
              className={styles.primaryButtonLarge}
              onClick={handleAuthorize}
            >
              권한 요청하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <HomeContent />
    </Suspense>
  );
}
