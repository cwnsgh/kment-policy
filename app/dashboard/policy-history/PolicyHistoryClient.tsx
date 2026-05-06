"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PolicyPutSnapshotRow } from "@/types/policyPreset";
import type { Cafe24ShopListItem } from "@/types/cafe24Shop";
import { HtmlLineDiff } from "./HtmlLineDiff";
import styles from "./policy-history.module.css";

function shopNameFromStoreApiBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const wrap = root.store;
  if (wrap && typeof wrap === "object") {
    const n = (wrap as Record<string, unknown>).shop_name;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  }
  const n = root.shop_name;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

function formatShopOptionLabel(s: Cafe24ShopListItem): string {
  const parts = [s.shop_name];
  if (s.language_name) parts.push(s.language_name);
  if (s.default_shop) parts.push("기본");
  if (!s.active) parts.push("비활성");
  return parts.join(" · ");
}

function formatSelectLabel(s: PolicyPutSnapshotRow, index: number): string {
  const d = new Date(s.created_at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const recent = index === 0 ? " · 가장 최근 반영" : "";
  return `${y}-${m}-${day} ${h}:${min} 반영${recent}`;
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
  const pathname = usePathname();
  const sp = useSearchParams();
  const mallId = sp.get("mall_id")?.trim() ?? "";
  const shopNo = Number(sp.get("shop_no")) || 1;

  const [snapshots, setSnapshots] = useState<PolicyPutSnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shopList, setShopList] = useState<Cafe24ShopListItem[] | null>(null);
  const [shopDisplayName, setShopDisplayName] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<"preview" | "diff">("preview");

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

  useEffect(() => {
    if (!mallId) return;
    let cancelled = false;
    setShopList(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/cafe24/shops?mall_id=${encodeURIComponent(mallId)}`,
          { credentials: "include" }
        );
        const data = (await res.json()) as { shops?: Cafe24ShopListItem[] };
        if (cancelled) return;
        if (!res.ok) {
          setShopList([]);
          return;
        }
        setShopList(Array.isArray(data.shops) ? data.shops : []);
      } catch {
        if (!cancelled) setShopList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mallId]);

  useEffect(() => {
    if (!shopList || shopList.length === 0) return;
    if (shopList.some((s) => s.shop_no === shopNo)) return;
    const def = shopList.find((s) => s.default_shop) ?? shopList[0];
    const p = new URLSearchParams();
    p.set("mall_id", mallId);
    p.set("shop_no", String(def.shop_no));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [shopList, shopNo, mallId, pathname, router]);

  useEffect(() => {
    if (shopList === null) return;
    if (shopList.length > 0) {
      setShopDisplayName(null);
      return;
    }
    if (!mallId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = new URLSearchParams({
          mall_id: mallId,
          shop_no: String(shopNo),
        });
        const res = await fetch(`/api/cafe24/store?${p}`, {
          credentials: "include",
        });
        const data = (await res.json()) as unknown;
        if (cancelled) return;
        if (!res.ok) {
          setShopDisplayName(null);
          return;
        }
        setShopDisplayName(shopNameFromStoreApiBody(data));
      } catch {
        if (!cancelled) setShopDisplayName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mallId, shopNo, shopList]);

  const headerShopLabel = useMemo(() => {
    const row = shopList?.find((s) => s.shop_no === shopNo);
    if (row?.shop_name) return row.shop_name;
    return shopDisplayName;
  }, [shopList, shopNo, shopDisplayName]);

  const changeHistoryShop = useCallback(
    (nextShopNo: number) => {
      const p = new URLSearchParams();
      p.set("mall_id", mallId);
      p.set("shop_no", String(nextShopNo));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [mallId, pathname, router]
  );

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
        <p className={styles.shopMeta}>
          {headerShopLabel ?? "쇼핑몰 정보를 불러오는 중…"}
        </p>
        {shopList && shopList.length > 1 ? (
          <div className={styles.shopPickerBar}>
            <label className={styles.shopPickerLabel} htmlFor="hist-shop">
              다른 쇼핑몰 이력 보기
            </label>
            <select
              id="hist-shop"
              className={styles.shopPickerSelect}
              value={String(shopNo)}
              onChange={(e) =>
                changeHistoryShop(Number(e.target.value) || 1)
              }
            >
              {shopList.map((s) => (
                <option key={s.shop_no} value={s.shop_no}>
                  {formatShopOptionLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className={styles.lead}>
          카페24에 PUT으로 반영될 때마다 저장된 스냅샷입니다. 항목을 고른 뒤{" "}
          <strong>미리보기</strong>에서 렌더링 결과를 나란히 보거나,{" "}
          <strong>변경 추적</strong>에서 VS Code처럼 추가(초록)·삭제(빨강) 줄 diff를
          볼 수 있습니다. (diff는 저장된 HTML 태그·공백까지 포함한{" "}
          <strong>원문</strong>을 줄 단위로 비교합니다.)
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

            <div className={styles.viewToggle} role="tablist" aria-label="보기 방식">
              <button
                type="button"
                role="tab"
                aria-selected={historyView === "preview"}
                className={
                  historyView === "preview"
                    ? `${styles.viewToggleBtn} ${styles.viewToggleBtnActive}`
                    : styles.viewToggleBtn
                }
                onClick={() => setHistoryView("preview")}
              >
                미리보기 (나란히)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={historyView === "diff"}
                className={
                  historyView === "diff"
                    ? `${styles.viewToggleBtn} ${styles.viewToggleBtnActive}`
                    : styles.viewToggleBtn
                }
                onClick={() => setHistoryView("diff")}
              >
                변경 추적 (diff)
              </button>
            </div>

            {historyView === "preview" ? (
              <div className={styles.compare}>
                <div className={styles.pane}>
                  <p className={styles.paneTitle}>
                    PUT 직전 (이전에 게시된 내용)
                  </p>
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
                    <p className={styles.emptyPane}>
                      저장된 본문이 비어 있습니다.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className={styles.diffLegend}>
                  한 줄이 통째로 바뀌면 삭제(빨강) 다음에 추가(초록)로 보일 수
                  있습니다. 태그·공백까지 비교합니다.
                </p>
                <HtmlLineDiff before={beforeHtml} after={afterHtml} />
              </>
            )}
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
