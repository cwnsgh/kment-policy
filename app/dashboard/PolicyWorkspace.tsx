"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MANAGED_POLICY_SLOT,
  REVISION_ACTION_LABELS,
  SLOT_LABELS,
  type VariantRevisionRow,
} from "@/types/policyPreset";
import type { Cafe24PolicyPayload } from "@/lib/api/cafe24Policy";
import { PolicyRichEditor } from "./PolicyRichEditor";
import styles from "./PolicyWorkspace.module.css";

function slotBodyFromLive(p: Cafe24PolicyPayload): string {
  const v = p.terms_using_mall;
  return typeof v === "string" ? v : "";
}

function isDbSetupError(text: string) {
  return (
    /schema cache|policy_text_variants|policy_variant_revisions|PGRST106|PGRST205/i.test(
      text
    ) || text.includes("Could not find the table")
  );
}

function formatPolicyApiError(
  data: Record<string, unknown>,
  fallback: string
): string {
  const parts: string[] = [String(data.error ?? fallback)];
  if (typeof data.step === "string") parts.push(`단계: ${data.step}`);
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
  return parts.join(" — ");
}

type VariantRow = {
  id: string;
  label: string;
  body: string;
  updated_at: string;
};

type EditState = { id: string; label: string; body: string };

export function PolicyWorkspace({ mallId }: { mallId: string }) {
  const [termsVariants, setTermsVariants] = useState<VariantRow[]>([]);
  const [pickTermsId, setPickTermsId] = useState("");
  const [newRow, setNewRow] = useState({ label: "", body: "" });
  const [shopNo, setShopNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const [revisions, setRevisions] = useState<VariantRevisionRow[]>([]);
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
      setTermsVariants((data.variants || []) as VariantRow[]);
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
        throw new Error(formatPolicyApiError(data, res.statusText));
      }
      if (!data.policy) throw new Error("응답에 policy가 없습니다.");
      setLivePolicy(data.policy as Cafe24PolicyPayload);
      setMsg({
        type: "ok",
        text: `${SLOT_LABELS[MANAGED_POLICY_SLOT]}(카페24 현재값)을 불러왔습니다.`,
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
      const res = await fetch(`/api/policy/variant-revisions?${p}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setRevisions((data.revisions || []) as VariantRevisionRow[]);
    } catch (e) {
      setRevisions([]);
      setHistoryError(
        e instanceof Error ? e.message : "히스토리를 불러오지 못했습니다."
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [mallId]);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  const addVariant = async () => {
    const label = newRow.label.trim() || "1번";
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/policy/variants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mall_id: mallId,
          slot: MANAGED_POLICY_SLOT,
          label,
          body: newRow.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setNewRow({ label: "", body: "" });
      setMsg({
        type: "ok",
        text: `「${SLOT_LABELS[MANAGED_POLICY_SLOT]}」에 "${label}" 저장했습니다.`,
      });
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

  const importTermsFromCafe24 = async () => {
    const label = prompt(
      `${SLOT_LABELS[MANAGED_POLICY_SLOT]} — 저장할 라벨`,
      "카페24 원문"
    );
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
          slot: MANAGED_POLICY_SLOT,
          shop_no: shopNo,
          label: label || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg({ type: "ok", text: "카페24에서 이용약관만 가져왔습니다." });
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

  const delVariant = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/policy/variants/${id}?${q}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setPickTermsId((cur) => (cur === id ? "" : cur));
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
        "선택한 이용약관 variant를 카페24에 반영합니다. (선택 없음 = 지금 쇼핑몰 이용약관 유지) 개인정보·가입약관·철회는 건드리지 않습니다."
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
            terms_using_mall: pickTermsId || undefined,
          },
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(formatPolicyApiError(data, res.statusText));
      }
      setMsg({ type: "ok", text: "카페24에 이용약관을 반영했습니다." });
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
        <p className={styles.sidebarTitle}>카페24 반영</p>
        <p className={styles.meta}>
          {SLOT_LABELS[MANAGED_POLICY_SLOT]}만 바꿉니다. 나머지 약관은 쇼핑몰
          설정 그대로 둡니다.
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
        <div className={styles.field}>
          <label className={styles.label}>
            {SLOT_LABELS[MANAGED_POLICY_SLOT]}
          </label>
          <select
            className={styles.select}
            value={pickTermsId}
            onChange={(e) => setPickTermsId(e.target.value)}
          >
            <option value="">현재 쇼핑몰 유지 (GET)</option>
            {termsVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void applyCafe24()}
          disabled={loading}
        >
          이용약관만 카페24에 PUT
        </button>
      </aside>

      <div className={styles.main}>
        <h2 className={styles.heading}>
          {SLOT_LABELS[MANAGED_POLICY_SLOT]} · {mallId}
        </h2>

        <section className={styles.stepsPanel} aria-label="사용 순서">
          <p className={styles.stepsLead}>
            이 화면은 <strong>쇼핑몰 이용약관</strong>만 다룹니다.
          </p>
          <ol className={styles.stepsList}>
            <li>
              <strong>카페24에서 불러오기</strong> — 지금 게시 중인 이용약관
              HTML (GET)
            </li>
            <li>
              <strong>저장된 목록 불러오기</strong> — 이 앱 DB에 만든 버전
            </li>
            <li>
              아래에서 수정·추가 후, 왼쪽에서 variant 선택 →{" "}
              <strong>PUT</strong>
            </li>
          </ol>
          <div className={styles.stepActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void loadLiveFromCafe24()}
              disabled={loading}
            >
              카페24 현재 이용약관 (GET)
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void loadVariants()}
              disabled={loading}
            >
              저장된 목록 (DB)
            </button>
          </div>
        </section>

        <p className={styles.hint}>
          개인정보처리방침·회원가입 개인정보·청약철회는{" "}
          <strong>카페24 관리자에서 그대로</strong> 두고, 여기서는{" "}
          <strong>이용약관 HTML</strong>만 저장·히스토리·반영합니다.
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
              <li>저장 후 「저장된 목록 (DB)」 다시 시도</li>
            </ul>
          </div>
        ) : null}

        {livePolicy ? (
          <section
            className={styles.livePanel}
            aria-label="카페24 이용약관 미리보기"
          >
            <h3 className={styles.liveTitle}>
              지금 쇼핑몰의 {SLOT_LABELS[MANAGED_POLICY_SLOT]} (읽기 전용)
            </h3>
            <p className={styles.meta}>shop_no {livePolicy.shop_no}</p>
            <div
              className={styles.htmlPreview}
              dangerouslySetInnerHTML={{
                __html: slotBodyFromLive(livePolicy) || "<p>(비어 있음)</p>",
              }}
            />
          </section>
        ) : null}

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>
            이용약관 변경 히스토리 (펼치기)
          </summary>
          <div className={styles.historyDetailsBody}>
            <section className={styles.historySection}>
              <p className={styles.historyHint}>
                이용약관 저장본이 <strong>추가·수정·삭제</strong>될 때마다
                기록됩니다. &quot;수정 직전&quot;은 바뀌기{" "}
                <strong>이전</strong> 내용입니다.
              </p>
              {historyError ? (
                <p className={styles.msgErr}>{historyError}</p>
              ) : null}
              <div className={styles.historyToolbar}>
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
                              <td colSpan={5}>
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

        {edit ? (
          <div className={styles.editBox}>
            <p className={styles.label}>
              편집: {SLOT_LABELS[MANAGED_POLICY_SLOT]} — {edit.id.slice(0, 8)}…
            </p>
            <input
              className={styles.input}
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
            />
            <PolicyRichEditor
              html={edit.body}
              onChange={(body) => setEdit({ ...edit, body })}
              placeholder="이용약관 본문. 문단·굵기·크기·목록·링크가 HTML로 저장됩니다."
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
        ) : null}

        <section className={styles.slotSection}>
          <h3 className={styles.slotTitle}>
            {SLOT_LABELS[MANAGED_POLICY_SLOT]}
          </h3>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void importTermsFromCafe24()}
            disabled={loading}
          >
            카페24에서 이용약관만 가져오기
          </button>

          <ul className={styles.variantList}>
            {termsVariants.map((v) => (
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
                    onClick={() => void delVariant(v.id)}
                    disabled={loading}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.addBox}>
            <p className={styles.label}>새로 저장 (라벨 + 본문)</p>
            <input
              className={styles.input}
              placeholder="예: 2번, 가맹점용"
              value={newRow.label}
              onChange={(e) =>
                setNewRow((r) => ({ ...r, label: e.target.value }))
              }
            />
            <PolicyRichEditor
              html={newRow.body}
              onChange={(body) => setNewRow((r) => ({ ...r, body }))}
              placeholder="이용약관 본문을 작성하세요."
              disabled={loading}
            />
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void addVariant()}
              disabled={loading}
            >
              이용약관에 추가
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
