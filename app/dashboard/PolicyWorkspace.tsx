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
  type PolicyPutSnapshotRow,
  type VariantRevisionRow,
} from "@/types/policyPreset";
import type { Cafe24PolicyPayload } from "@/lib/api/cafe24Policy";
import { PolicyRichEditor } from "./PolicyRichEditor";
import styles from "./PolicyWorkspace.module.css";

const LOG_PREFIX = "[kment-policy]";

function policyBodyLen(s: unknown): number {
  return typeof s === "string" ? s.length : 0;
}

/** 브라우저 콘솔용: 플래그 + 본문 길이만 표로 보기 */
function policyDebugSummary(p: Cafe24PolicyPayload) {
  return {
    shop_no: p.shop_no,
    use_privacy_join: p.use_privacy_join,
    use_withdrawal: p.use_withdrawal,
    required_withdrawal: p.required_withdrawal,
    len_privacy_all: policyBodyLen(p.privacy_all),
    len_terms_using_mall: policyBodyLen(p.terms_using_mall),
    len_privacy_join: policyBodyLen(p.privacy_join),
    len_withdrawal: policyBodyLen(p.withdrawal),
  };
}

function slotBodyFromLive(p: Cafe24PolicyPayload): string {
  const v = p.terms_using_mall;
  return typeof v === "string" ? v : "";
}

function isDbSetupError(text: string) {
  return (
    /schema cache|policy_text_variants|policy_variant_revisions|policy_put_snapshots|PGRST106|PGRST205/i.test(
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

/** PUT 422 등 카페24 본문을 보고 화면용 문구 보강 */
function extraHintForPutFailure(data: Record<string, unknown>): string {
  const status = Number(data.cafe24_status);
  if (status !== 422 || data.cafe24 == null) return "";
  let msg = "";
  try {
    const root = data.cafe24 as { error?: { message?: string } };
    msg = root?.error?.message ?? "";
  } catch {
    return "";
  }
  if (/Cancellation Policy|use_withdrawal|required_withdrawal/i.test(msg)) {
    return (
      " | 콘솔에 방금 GET으로 받은 policy와 비교해 보세요. " +
      "관리자에서 청약철회(취소) 정책을 켠 뒤 GET이 T로 바뀌는지 확인하거나, 카페24에 문의 시 이 메시지를 첨부하세요."
    );
  }
  return "";
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
  const [termsDraft, setTermsDraft] = useState("");
  const [putSnapshots, setPutSnapshots] = useState<PolicyPutSnapshotRow[]>([]);
  const [putHistoryLoading, setPutHistoryLoading] = useState(false);
  const [putHistoryError, setPutHistoryError] = useState<string | null>(null);
  const [expandedPutId, setExpandedPutId] = useState<string | null>(null);

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
        console.error(`${LOG_PREFIX} Cafe24 GET /api/policy/cafe24 실패`, {
          mallId,
          shopNo,
          httpStatus: res.status,
          body: data,
        });
        throw new Error(formatPolicyApiError(data, res.statusText));
      }
      if (!data.policy) throw new Error("응답에 policy가 없습니다.");
      const policy = data.policy as Cafe24PolicyPayload;
      setLivePolicy(policy);
      setTermsDraft(slotBodyFromLive(policy));
      console.log(
        `%c${LOG_PREFIX} Cafe24 GET — 원본 policy 객체 (아래 펼쳐서 확인)`,
        "color:#1d4ed8;font-weight:bold",
        policy
      );
      console.table(policyDebugSummary(policy));
      setMsg({
        type: "ok",
        text: `${SLOT_LABELS[MANAGED_POLICY_SLOT]}(카페24 현재값)을 불러왔습니다. (브라우저 콘솔에 GET policy 출력됨)`,
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

  const loadPutSnapshots = useCallback(async () => {
    setPutHistoryLoading(true);
    setPutHistoryError(null);
    try {
      const p = new URLSearchParams({ mall_id: mallId, limit: "100" });
      const res = await fetch(`/api/policy/put-snapshots?${p}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setPutSnapshots((data.snapshots || []) as PolicyPutSnapshotRow[]);
    } catch (e) {
      setPutSnapshots([]);
      setPutHistoryError(
        e instanceof Error ? e.message : "반영 기록을 불러오지 못했습니다."
      );
    } finally {
      setPutHistoryLoading(false);
    }
  }, [mallId]);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  useEffect(() => {
    void loadPutSnapshots();
  }, [loadPutSnapshots]);

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
      const savedId = edit.id;
      const savedBody = edit.body;
      setEdit(null);
      if (pickTermsId === savedId) {
        setTermsDraft(savedBody);
      }
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

  const quickSaveDraftToDb = async () => {
    if (!termsDraft.trim()) {
      setMsg({
        type: "err",
        text: "편집기에 저장할 이용약관 내용이 없습니다.",
      });
      return;
    }
    const label = prompt(`${SLOT_LABELS[MANAGED_POLICY_SLOT]} — 저장본 라벨`, "편집기 저장");
    if (label === null) return;
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
          label: label.trim() || "1번",
          body: termsDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg({ type: "ok", text: "편집기 내용을 저장본(DB)에 추가했습니다." });
      await loadVariants();
      void loadRevisions();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "저장 실패",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyCafe24 = async () => {
    if (!termsDraft.trim()) {
      setMsg({
        type: "err",
        text: "이용약관 본문이 비어 있습니다. 카페24에서 불러오거나 저장본을 선택해 편집기에 불러오세요.",
      });
      return;
    }
    if (
      !confirm(
        "아래 편집기에 있는 이용약관 HTML을 카페24에 반영합니다. (저장본을 고르면 기록에만 참고 라벨이 남습니다.) 개인정보·가입약관·철회는 건드리지 않습니다."
      )
    ) {
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const putBody = {
        mall_id: mallId,
        shop_no: shopNo,
        terms_using_mall_html: termsDraft,
        picks: {
          terms_using_mall: pickTermsId || undefined,
        },
      };
      console.log(
        `%c${LOG_PREFIX} Cafe24 PUT 요청(우리 앱 → /api/policy/cafe24)`,
        "color:#047857;font-weight:bold",
        putBody
      );
      const res = await fetch("/api/policy/cafe24", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        console.error(`${LOG_PREFIX} Cafe24 PUT 실패 — 서버 응답`, {
          httpStatus: res.status,
          body: data,
        });
        const base = formatPolicyApiError(data, res.statusText);
        throw new Error(base + extraHintForPutFailure(data));
      }
      console.log(
        `%c${LOG_PREFIX} Cafe24 PUT 성공 — 응답 policy`,
        "color:#047857;font-weight:bold",
        data.policy
      );
      if (data.policy) {
        const policy = data.policy as Cafe24PolicyPayload;
        setLivePolicy(policy);
        setTermsDraft(slotBodyFromLive(policy));
      }
      void loadPutSnapshots();
      setMsg({
        type: "ok",
        text: "카페24에 이용약관을 반영했습니다. 반영 기록에 스냅샷이 남습니다.",
      });
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
          반영되는 본문은 <strong>가운데 편집기</strong> 내용입니다. 저장본을
          고르면 편집기에 불러오며, PUT 기록에 참고용 라벨만 남습니다.
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
            저장본 불러오기 (편집기로)
          </label>
          <select
            className={styles.select}
            value={pickTermsId}
            onChange={(e) => {
              const v = e.target.value;
              setPickTermsId(v);
              if (v) {
                const row = termsVariants.find((t) => t.id === v);
                if (row) setTermsDraft(row.body);
              }
            }}
          >
            <option value="">선택 안 함</option>
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
          편집기 내용 → 카페24 PUT
        </button>
      </aside>

      <div className={styles.main}>
        <h2 className={styles.heading}>
          {SLOT_LABELS[MANAGED_POLICY_SLOT]} · {mallId}
        </h2>

        <section className={styles.stepsPanel} aria-label="빠른 안내">
          <p className={styles.stepsLead}>
            <strong>쇼핑몰 이용약관</strong>만 — 카페24 GET → 바로 편집 → PUT
          </p>
          <div className={styles.stepActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void loadLiveFromCafe24()}
              disabled={loading}
            >
              카페24에서 불러오기
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void loadVariants()}
              disabled={loading}
            >
              저장본 목록 새로고침
            </button>
          </div>
        </section>

        <p className={styles.hint}>
          개인정보·가입 개인정보·철회는 카페24 관리자 그대로 두고, 여기서는{" "}
          <strong>이용약관 HTML</strong>만 다룹니다.
        </p>

        <section className={styles.editorPanel} aria-label="이용약관 편집">
          <div className={styles.editorPanelHead}>
            <h3 className={styles.editorPanelTitle}>
              {SLOT_LABELS[MANAGED_POLICY_SLOT]} — 바로 편집
            </h3>
            {livePolicy ? (
              <span className={styles.editorBadge}>
                shop_no {livePolicy.shop_no} · 카페24에서 불러온 뒤 수정 가능
              </span>
            ) : (
              <span className={styles.editorBadgeMuted}>
                먼저 「카페24에서 불러오기」 또는 왼쪽 저장본을 선택하세요
              </span>
            )}
          </div>
          <PolicyRichEditor
            html={termsDraft}
            onChange={setTermsDraft}
            placeholder="여기에서 문단·굵기·목록·링크를 편집합니다. 카페24 GET 후 바로 고칠 수 있습니다."
            disabled={loading}
          />
          <div className={styles.editorToolbar}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void quickSaveDraftToDb()}
              disabled={loading}
            >
              편집기 내용 → 저장본(DB)에 추가
            </button>
          </div>
        </section>

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
                실행 (저장본 변경 기록)
              </li>
              <li>
                <code className={styles.codeInline}>
                  supabase/policy_put_snapshots.sql
                </code>{" "}
                실행 (카페24 PUT 반영 스냅샷)
              </li>
              <li>
                Supabase <strong>Project Settings → Data API → Exposed schemas</strong>
                에 <code className={styles.codeInline}>policy</code> 추가
              </li>
              <li>저장 후 「저장된 목록 (DB)」 다시 시도</li>
            </ul>
          </div>
        ) : null}

        <details className={styles.putHistoryDetails} open>
          <summary className={styles.putHistorySummary}>
            카페24 반영 기록 (PUT할 때마다)
          </summary>
          <div className={styles.putHistoryBody}>
            <p className={styles.historyHint}>
              카페24에 <strong>이용약관 PUT이 성공</strong>할 때마다, 그때
              반영된 HTML이 여기에 남습니다. (저장본을 고쳤다가 PUT한 것과
              별개로, &quot;실제로 몰에 올라간 내용&quot; 기준입니다.)
            </p>
            {putHistoryError ? (
              <p className={styles.msgErr}>{putHistoryError}</p>
            ) : null}
            <div className={styles.historyToolbar}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void loadPutSnapshots()}
                disabled={putHistoryLoading}
              >
                새로고침
              </button>
            </div>
            {putHistoryLoading && putSnapshots.length === 0 ? (
              <p className={styles.meta}>불러오는 중…</p>
            ) : putSnapshots.length === 0 ? (
              <p className={styles.meta}>아직 반영 기록이 없습니다.</p>
            ) : (
              <div className={styles.historyTableWrap}>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>shop</th>
                      <th>참고 저장본</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {putSnapshots.map((s) => (
                      <Fragment key={s.id}>
                        <tr>
                          <td className={styles.historyCellTime}>
                            {new Date(s.created_at).toLocaleString("ko-KR")}
                          </td>
                          <td>{s.shop_no}</td>
                          <td className={styles.historyCellLabel}>
                            {s.variant_label ?? "—"}
                            {s.variant_id ? (
                              <span className={styles.meta}>
                                {" "}
                                ({s.variant_id.slice(0, 8)}…)
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={() =>
                                setExpandedPutId((cur) =>
                                  cur === s.id ? null : s.id
                                )
                              }
                            >
                              {expandedPutId === s.id ? "접기" : "본문"}
                            </button>
                          </td>
                        </tr>
                        {expandedPutId === s.id ? (
                          <tr className={styles.historyBodyRow}>
                            <td colSpan={4}>
                              <div
                                className={styles.htmlPreviewLg}
                                dangerouslySetInnerHTML={{
                                  __html: s.terms_body || "<p>(비어 있음)</p>",
                                }}
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
          </div>
        </details>

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>
            저장본(DB) 변경 기록 — 추가·수정·삭제
          </summary>
          <div className={styles.historyDetailsBody}>
            <section className={styles.historySection}>
              <p className={styles.historyHint}>
                이 앱 DB에 있는 <strong>저장본(variant)</strong>이 바뀔 때의
                기록입니다. &quot;수정 직전&quot;은 저장하기{" "}
                <strong>이전</strong> 스냅샷입니다. (위의「카페24 반영 기록」과
                용도가 다릅니다.)
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
                  새로고침
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
                    onClick={() => setTermsDraft(v.body)}
                  >
                    편집기로
                  </button>
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
                    라벨·본문 수정
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
