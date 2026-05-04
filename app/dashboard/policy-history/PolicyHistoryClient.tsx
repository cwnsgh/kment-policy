"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PolicyPutSnapshotRow } from "@/types/policyPreset";
import styles from "./policy-history.module.css";

function formatSelectLabel(
  s: PolicyPutSnapshotRow,
  index: number
): string {
  const d = new Date(s.created_at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const recent = index === 0 ? " · 가장 최근 반영" : "";
  return `${y}-${m}-${day} ${h}:${min} 반영 (shop ${s.shop_no})${recent}`;
}

function formatEffectiveLine(s: PolicyPutSnapshotRow): string {
  return new Date(s.created_at).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PolicyHistoryClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const mallId = sp.get("mall_id")?.trim() ?? "";
  const shopNo = Number(sp.get("shop_no")) || 1;

  const [snapshots, setSnapshots] = useState<PolicyPutSnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const load = useCallback(async () => {
    if (!mallId) {
      setError("mall_id가 없습니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        mall_id: mallId,
        shop_no: String(shopNo),
        limit: "100",
      });
      const res = await fetch(`/api/policy/put-snapshots?${p}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; snapshots?: unknown };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list = (data.snapshots ?? []) as PolicyPutSnapshotRow[];
      setSnapshots(list);
      setSelectedIndex(0);
    } catch (e) {
      setSnapshots([]);
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [mallId, shopNo]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = snapshots[selectedIndex] ?? null;
  const beforeHtml = useMemo(() => {
    const nextOlder = snapshots[selectedIndex + 1];
    return nextOlder?.terms_body ?? null;
  }, [snapshots, selectedIndex]);

  const afterHtml = selected?.terms_body ?? "";

  const close = useCallback(() => {
    window.close();
    window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if (mallId) {
        router.replace(
          `/dashboard?mall_id=${encodeURIComponent(mallId)}`,
          { scroll: false }
        );
      } else {
        router.back();
      }
    }, 150);
  }, [mallId, router]);

  if (!mallId) {
    return (
      <div className={styles.shell}>
        <div className={styles.panel}>
          <p className={styles.msg}>mall_id 쿼리가 필요합니다.</p>
          <div className={styles.footer}>
            <button type="button" className={styles.btnClose} onClick={close}>
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.panel}>
        <h1 className={styles.title}>쇼핑몰 이용약관 반영 이력</h1>
        <p className={styles.lead}>
          카페24에 PUT으로 반영될 때마다 저장된 스냅샷입니다. 항목을 고르면{" "}
          <strong>그 반영 직전</strong>에 게시되어 있던 HTML과,{" "}
          <strong>그 반영으로 바뀐 뒤</strong> HTML을 나란히 볼 수 있습니다.
        </p>

        {error ? <p className={styles.msg}>{error}</p> : null}

        {loading ? (
          <p className={styles.lead}>불러오는 중…</p>
        ) : snapshots.length === 0 ? (
          <p className={styles.lead}>아직 반영 이력이 없습니다.</p>
        ) : (
          <>
            <div className={styles.metaGrid}>
              <div className={styles.metaLabel}>반영 이력</div>
              <div className={styles.metaValue}>
                <select
                  className={styles.select}
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  aria-label="반영 이력 선택"
                >
                  {snapshots.map((s, i) => (
                    <option key={s.id} value={i}>
                      {formatSelectLabel(s, i)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.metaLabel}>반영 일시</div>
              <div className={styles.metaValue}>
                <span className={styles.dateLink}>
                  {selected ? formatEffectiveLine(selected) : "—"}
                </span>
                {selected?.variant_label ? (
                  <span className={styles.variantMeta}>
                    · 참고 저장본: {selected.variant_label}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.compare}>
              <div className={styles.pane}>
                <p className={styles.paneTitle}>PUT 직전 (이전에 게시된 내용)</p>
                {beforeHtml != null && beforeHtml.length > 0 ? (
                  <div
                    className={styles.htmlBox}
                    dangerouslySetInnerHTML={{ __html: beforeHtml }}
                  />
                ) : (
                  <p className={styles.emptyPane}>
                    그보다 이전에 반영된 기록이 없습니다.
                    <br />
                    (이번이 첫 PUT이거나, 더 오래된 기록은 목록에 없을 수
                    있습니다.)
                  </p>
                )}
              </div>
              <div className={styles.pane}>
                <p className={`${styles.paneTitle} ${styles.paneTitleAfter}`}>
                  이번 PUT 이후 (반영된 내용)
                </p>
                {afterHtml.trim() ? (
                  <div
                    className={styles.htmlBox}
                    dangerouslySetInnerHTML={{ __html: afterHtml }}
                  />
                ) : (
                  <p className={styles.emptyPane}>저장된 본문이 비어 있습니다.</p>
                )}
              </div>
            </div>
          </>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.btnClose} onClick={close}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
