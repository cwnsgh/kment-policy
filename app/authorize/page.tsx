"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function AuthorizePage() {
  const [mallId, setMallId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuthorize = async () => {
    if (!mallId.trim()) {
      alert("쇼핑몰 ID를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const randomString = Math.random().toString(36).substring(2, 15);
      const state = `${mallId}:${randomString}`;

      const authorizeUrl = `/api/oauth/authorize?mall_id=${encodeURIComponent(
        mallId,
      )}&state=${encodeURIComponent(state)}`;

      window.location.href = authorizeUrl;
    } catch (error) {
      console.error("인증 시작 실패:", error);
      alert("인증 시작에 실패했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageCenter}>
      <div className={styles.card}>
        <h1 className={styles.title}>카페24 인증 시작</h1>

        <div className={styles.stack}>
          <div>
            <label className={styles.label} htmlFor="mall_id">
              쇼핑몰 ID
            </label>
            <input
              id="mall_id"
              className={styles.input}
              type="text"
              value={mallId}
              onChange={(e) => setMallId(e.target.value)}
              placeholder="예: yourshop"
              disabled={loading}
            />
            <p className={styles.hint}>
              쇼핑몰 URL의 도메인 부분만 입력 (예: yourshop.cafe24.com →
              yourshop)
            </p>
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleAuthorize}
            disabled={loading || !mallId.trim()}
          >
            {loading ? "인증 중..." : "인증 시작"}
          </button>
        </div>

        <div className={styles.notice}>
          <strong>주의:</strong> 카페24 개발자센터에서 앱 등록 후 Client ID,
          Client Secret을 환경 변수에 넣어야 합니다. Supabase에{" "}
          <code>policy</code> 스키마와 테이블도 필요합니다.
        </div>
      </div>
    </div>
  );
}
