"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  POLICY_SLOTS,
  REVISION_ACTION_LABELS,
  SLOT_LABELS,
  type PolicySlot,
  type VariantRevisionRow,
} from "@/types/policyPreset";
import type { Cafe24PolicyPayload } from "@/lib/api/cafe24Policy";
import { PolicyRichEditor } from "./PolicyRichEditor";
import styles from "./PolicyWorkspace.module.css";

function slotBodyFromLive(p: Cafe24PolicyPayload, slot: PolicySlot): string {
  const v = p[slot as keyof Cafe24PolicyPayload];
  return typeof v === "string" ? v : "";
}

function isDbSetupError(text: string) {
  return (
    /schema cache|policy_text_variants|policy_variant_revisions|PGRST106|PGRST205/i.test(
      text
    ) || text.includes("Could not find the table")
  );
}

type VariantRow = {
  id: string;
  slot: PolicySlot;
  label: string;
  body: string;
  updated_at: string;
};

type Picks = Record<PolicySlot, string>;

type NewRow = Record<PolicySlot, { label: string; body: string }>;

function emptyPicks(): Picks {
  return {
    privacy_all: "",
    terms_using_mall: "",
    privacy_join: "",
    withdrawal: "",
  };
}

function emptyNewRows(): NewRow {
  return {
    privacy_all: { label: "", body: "" },
    terms_using_mall: { label: "", body: "" },
    privacy_join: { label: "", body: "" },
    withdrawal: { label: "", body: "" },
  };
}

export function PolicyWorkspace({ mallId }: { mallId: string }) {
  const [bySlot, setBySlot] = useState<Record<PolicySlot, VariantRow[]>>(() => ({
    privacy_all: [],
    terms_using_mall: [],
    privacy_join: [],
    withdrawal: [],
  }));
  const [picks, setPicks] = useState<Picks>(emptyPicks);
  const [newRows, setNewRows] = useState<NewRow>(emptyNewRows);
  const [shopNo, setShopNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [edit, setEdit] = useState<{
    slot: PolicySlot;
    id: string;
    label: string;
    body: string;
  } | null>(null);
  const [revisions, setRevisions] = useState<VariantRevisionRow[]>([]);
  const [historySlot, setHistorySlot] = useState<"" | PolicySlot>("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(
    null
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [livePolicy, setLivePolicy] = useState<Cafe24PolicyPayload | null>(null);

  const q = useMemo(
    () => `mall_id=${encodeURIComponent(mallId)}`,
    [mallId]
  );

  const loadVariants = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/policy/variants?mall_id=${encodeURIComponent(mallId)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list = (data.variants || []) as VariantRow[];
      const next: Record<PolicySlot, VariantRow[]> = {
        privacy_all: [],
        terms_using_mall: [],
        privacy_join: [],
        withdrawal: [],
      };
      for (const v of list) {
        if (POLICY_SLOTS.includes(v.slot)) {
          next[v.slot].push(v);
        }
      }
      setBySlot(next);
      return true;
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "목록 로드 실패",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [mallId]);

  const loadLiveFromCafe24 = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const p = new URLSearchParams({
        mall_id: mallId,
        shop_no: String(shopNo),
      });
      const res = await fetch(`/api/policy/cafe24?${p}`, {
        credentials: "include",
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const parts: string[] = [
          String(data.error ?? res.statusText),
        ];
        if (typeof data.hint === "string") parts.push(data.hint);
        if (data.cafe24_status != null) {
          parts.push(`카페24 HTTP ${String(data.cafe24_status)}`);
        }
        if (data.cafe24 != null) {
          const raw =
            typeof data.cafe24 === "string"
              ? data.cafe24
              : JSON.stringify(data.cafe24);
          parts.push(raw.length > 600 ? `${raw.slice(0, 600)}…` : raw);
        }
        throw new Error(parts.join(" — "));
      }
      if (!data.policy) throw new Error("응답에 policy가 없습니다.");
      setLivePolicy(data.policy as Cafe24PolicyPayload);
      setMsg({
        type: "ok",
        text: "카페24에 지금 올라가 있는 약관을 불러왔습니다. (GET)",
      });
    } catch (e) {
      setLivePolicy(null);
      setMsg({
        type: "err",
        text:
          e instanceof Error
            ? e.message
            : "카페24 약관을 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }, [mallId, shopNo]);

  const loadRevisions = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const p = new URLSearchParams({
        mall_id: mallId,
        limit: "100",
      });
      if (historySlot) p.set("slot", historySlot);
      const res = await fetch(`/api/policy/variant-revisions?${p}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const raw = (data.revisions || []) as VariantRevisionRow[];
      setRevisions(
        raw.filter((r) =>
          POLICY_SLOTS.includes(r.slot as PolicySlot)
        ) as VariantRevisionRow[]
      );
    } catch (e) {
      setRevisions([]);
      setHistoryError(
        e instanceof Error ? e.message : "히스토리를 불러오지 못했습니다."
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [mallId, historySlot]);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  const setPick = (slot: PolicySlot, variantId: string) => {
    setPicks((p) => ({ ...p, [slot]: variantId }));
  };

  const addVariant = async (slot: PolicySlot) => {
    const nr = newRows[slot];
    const label = nr.label.trim() || "1번";
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/policy/variants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mall_id: mallId,
          slot,
          label,
          body: nr.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setNewRows((r) => ({
        ...r,
        [slot]: { label: "", body: "" },
      }));
      setMsg({ type: "ok", text: `${SLOT_LABELS[slot]}에 "${label}" 저장했습니다.` });
      await loadVariants();
      void loadRevisions();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "추가 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  const importSlot = async (slot: PolicySlot) => {
    const label = prompt(`${SLOT_LABELS[slot]} — 저장할 라벨`, "카페24 원문");
    if (label === null) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/policy/import-from-cafe24", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mall_id: mallId,
          slot,
          shop_no: shopNo,
          label: label || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg({ type: "ok", text: "카페24에서 이 슬롯만 가져왔습니다." });
      await loadVariants();
      void loadRevisions();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "가져오기 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  const delVariant = async (slot: PolicySlot, id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/policy/variants/${id}?${q}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setPicks((p) => (p[slot] === id ? { ...p, [slot]: "" } : p));
      await loadVariants();
      void loadRevisions();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "삭제 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/policy/variants/${edit.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mall_id: mallId,
          label: edit.label,
          body: edit.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setEdit(null);
      setMsg({ type: "ok", text: "수정했습니다." });
      await loadVariants();
      void loadRevisions();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "수정 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyCafe24 = async () => {
    if (
      !confirm(
        "선택한 조합으로 카페24에 반영합니다. (빈 선택 = 해당 항목은 지금 쇼핑몰 값 유지) 한 번의 PUT으로 전송합니다."
      )
    ) {
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/policy/cafe24", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mall_id: mallId,
          shop_no: shopNo,
          picks: {
            privacy_all: picks.privacy_all || undefined,
            terms_using_mall: picks.terms_using_mall || undefined,
            privacy_join: picks.privacy_join || undefined,
            withdrawal: picks.withdrawal || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg({ type: "ok", text: "카페24에 반영했습니다." });
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "반영 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>적용 조합 (퍼즐)</p>
        <p className={styles.meta}>
          슬롯마다 variant를 고르거나 &quot;현재 유지&quot;로 두세요.
        </p>
        <div className={styles.field}>
          <label className={styles.label}>shop_no</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={shopNo}
            onChange={(e) => setShopNo(Number(e.target.value) || 1)}
          />
        </div>
        {POLICY_SLOTS.map((slot) => (
          <div key={slot} className={styles.field}>
            <label className={styles.label}>{SLOT_LABELS[slot]}</label>
            <select
              className={styles.select}
              value={picks[slot]}
              onChange={(e) => setPick(slot, e.target.value)}
            >
              <option value="">현재 쇼핑몰 유지 (GET)</option>
              {bySlot[slot].map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void applyCafe24()}
          disabled={loading}
        >
          선택 조합으로 카페24 PUT
        </button>
      </aside>

      <div className={styles.main}>
        <h2 className={styles.heading}>약관 · {mallId}</h2>

        <section className={styles.stepsPanel} aria-label="사용 순서">
          <p className={styles.stepsLead}>
            처음엔 <strong>불러오기</strong>만 눌러 확인하면 됩니다.
          </p>
          <ol className={styles.stepsList}>
            <li>
              <strong>카페24 현재 약관 불러오기</strong> — 지금 쇼핑몰에 게시된 HTML
              (GET, 읽기 전용)
            </li>
            <li>
              <strong>저장된 목록 불러오기</strong> — 이 앱 DB에 만든 초안·버전
              (GET)
            </li>
            <li>
              아래에서 슬롯별로 수정·추가한 뒤, 왼쪽에서 조합하고{" "}
              <strong>카페24에 반영</strong> (PUT)
            </li>
          </ol>
          <div className={styles.stepActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void loadLiveFromCafe24()}
              disabled={loading}
            >
              카페24 현재 약관 불러오기 (GET)
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void loadVariants()}
              disabled={loading}
            >
              저장된 목록 불러오기 (DB)
            </button>
          </div>
        </section>

        <p className={styles.hint}>
          DB 저장본은 슬롯마다 여러 <strong>라벨(1번, 2번…)</strong>로 둘 수 있고,
          왼쪽에서 섞어서 한 번에 PUT 합니다. 본문은 에디터 기준{" "}
          <strong>HTML</strong>로 저장됩니다.
        </p>

        {msg && (
          <p className={msg.type === "ok" ? styles.msgOk : styles.msgErr}>
            {msg.text}
          </p>
        )}

        {msg?.type === "err" && isDbSetupError(msg.text) ? (
          <div className={styles.setupCallout} role="note">
            <strong>DB / Supabase 설정이 필요할 때 나는 메시지입니다.</strong>
            <ul className={styles.setupList}>
              <li>
                Supabase SQL Editor에서{" "}
                <code className={styles.codeInline}>supabase/policy_init.sql</code>{" "}
                전체 실행 (테이블 생성)
              </li>
              <li>
                <code className={styles.codeInline}>
                  supabase/policy_variant_revisions.sql
                </code>{" "}
                실행 (히스토리 테이블)
              </li>
              <li>
                Supabase <strong>Project Settings → Data API → Exposed schemas</strong>
                에 <code className={styles.codeInline}>policy</code> 추가
              </li>
              <li>저장 후 이 페이지에서 「저장된 목록 불러오기」 다시 시도</li>
            </ul>
          </div>
        ) : null}

        {livePolicy ? (
          <section
            className={styles.livePanel}
            aria-label="카페24에 반영 중인 약관 미리보기"
          >
            <h3 className={styles.liveTitle}>
              지금 쇼핑몰에 올라가 있는 약관 (읽기 전용)
            </h3>
            <p className={styles.meta}>
              shop_no {livePolicy.shop_no} · 가입/철회 플래그: 가입개인정보{" "}
              {livePolicy.use_privacy_join} / 철회 {livePolicy.use_withdrawal} (
              필수 {livePolicy.required_withdrawal})
            </p>
            {POLICY_SLOTS.map((slot) => (
              <details key={slot} className={styles.liveSlot}>
                <summary className={styles.liveSummary}>
                  {SLOT_LABELS[slot]}
                </summary>
                <div
                  className={styles.htmlPreview}
                  dangerouslySetInnerHTML={{
                    __html: slotBodyFromLive(livePolicy, slot) || "<p>(비어 있음)</p>",
                  }}
                />
              </details>
            ))}
          </section>
        ) : null}

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>변경 히스토리 (펼치기)</summary>
          <div className={styles.historyDetailsBody}>
        <section className={styles.historySection}>
          <p className={styles.historyHint}>
            슬롯별 저장본이 <strong>추가·수정·삭제</strong>될 때마다 기록됩니다.
            &quot;수정 직전&quot;은 바뀌기 <strong>이전</strong> 내용입니다.
          </p>
          {historyError ? (
            <p className={styles.msgErr}>{historyError}</p>
          ) : null}
          <div className={styles.historyToolbar}>
            <label className={styles.historyLabel}>
              슬롯 필터
              <select
                className={styles.select}
                value={historySlot}
                onChange={(e) =>
                  setHistorySlot(
                    (e.target.value || "") as "" | PolicySlot
                  )
                }
              >
                <option value="">전체</option>
                {POLICY_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void loadRevisions()}
              disabled={historyLoading}
            >
              히스토리 새로고침
            </button>
          </div>
          {historyLoading && revisions.length === 0 ? (
            <p className={styles.meta}>불러오는 중…</p>
          ) : revisions.length === 0 ? (
            <p className={styles.meta}>기록이 없습니다.</p>
          ) : (
            <div className={styles.historyTableWrap}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>슬롯</th>
                    <th>구분</th>
                    <th>라벨</th>
                    <th>variant</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((r) => (
                    <Fragment key={r.id}>
                      <tr>
                        <td className={styles.historyCellTime}>
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </td>
                        <td>{SLOT_LABELS[r.slot]}</td>
                        <td>{REVISION_ACTION_LABELS[r.action]}</td>
                        <td className={styles.historyCellLabel}>{r.label}</td>
                        <td className={styles.historyCellMono}>
                          {r.variant_id.slice(0, 8)}…
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() =>
                              setExpandedRevisionId((cur) =>
                                cur === r.id ? null : r.id
                              )
                            }
                          >
                            {expandedRevisionId === r.id ? "접기" : "본문"}
                          </button>
                        </td>
                      </tr>
                      {expandedRevisionId === r.id ? (
                        <tr className={styles.historyBodyRow}>
                          <td colSpan={6}>
                            <div
                              className={styles.htmlPreview}
                              dangerouslySetInnerHTML={{ __html: r.body }}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </div>
        </details>

        {edit && (
          <div className={styles.editBox}>
            <p className={styles.label}>
              편집: {SLOT_LABELS[edit.slot]} — {edit.id.slice(0, 8)}…
            </p>
            <input
              className={styles.input}
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
            />
            <PolicyRichEditor
              html={edit.body}
              onChange={(body) => setEdit({ ...edit, body })}
              placeholder="약관 본문을 입력하세요. 문단·굵기·크기·목록·링크가 HTML로 저장됩니다."
              disabled={loading}
            />
            <div className={styles.toolbar}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void saveEdit()}
                disabled={loading}
              >
                수정 저장
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEdit(null)}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {POLICY_SLOTS.map((slot) => (
          <section key={slot} className={styles.slotSection}>
            <h3 className={styles.slotTitle}>{SLOT_LABELS[slot]}</h3>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void importSlot(slot)}
              disabled={loading}
            >
              카페24에서 이 슬롯만 가져오기
            </button>

            <ul className={styles.variantList}>
              {bySlot[slot].map((v) => (
                <li key={v.id} className={styles.variantItem}>
                  <div className={styles.variantHead}>
                    <strong>{v.label}</strong>
                    <span className={styles.meta}>
                      {new Date(v.updated_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div
                    className={styles.htmlPreview}
                    dangerouslySetInnerHTML={{ __html: v.body }}
                  />
                  <div className={styles.toolbar}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() =>
                        setEdit({
                          slot,
                          id: v.id,
                          label: v.label,
                          body: v.body,
                        })
                      }
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => void delVariant(slot, v.id)}
                      disabled={loading}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.addBox}>
              <p className={styles.label}>새로 저장 (라벨 + 본문 에디터)</p>
              <input
                className={styles.input}
                placeholder="예: 2번, 가맹점용"
                value={newRows[slot].label}
                onChange={(e) =>
                  setNewRows((r) => ({
                    ...r,
                    [slot]: { ...r[slot], label: e.target.value },
                  }))
                }
              />
              <PolicyRichEditor
                html={newRows[slot].body}
                onChange={(body) =>
                  setNewRows((r) => ({
                    ...r,
                    [slot]: { ...r[slot], body },
                  }))
                }
                placeholder={`${SLOT_LABELS[slot]} 본문을 작성하세요.`}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void addVariant(slot)}
                disabled={loading}
              >
                이 슬롯에 추가
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
