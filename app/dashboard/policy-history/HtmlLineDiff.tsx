"use client";

import { diffLines } from "diff";
import { useMemo } from "react";
import styles from "./policy-history.module.css";

type Row = { key: number; kind: "add" | "remove" | "same"; text: string };

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

/** 줄 단위로 펼쳐 VS Code unified diff 스타일로 그릴 행 목록 */
function expandLineDiff(before: string, after: string): Row[] {
  const parts = diffLines(normalizeNewlines(before), normalizeNewlines(after));
  const rows: Row[] = [];
  let key = 0;
  for (const part of parts) {
    const kind: Row["kind"] = part.added
      ? "add"
      : part.removed
        ? "remove"
        : "same";
    const val = normalizeNewlines(part.value);
    if (val === "") continue;
    const lines = val.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const isLast = i === lines.length - 1;
      if (isLast && lines[i] === "" && val.endsWith("\n")) continue;
      if (isLast && lines[i] === "" && !val.endsWith("\n") && lines.length > 1) {
        continue;
      }
      rows.push({ key: key++, kind, text: lines[i] });
    }
  }
  return rows;
}

export function HtmlLineDiff({
  before,
  after,
}: {
  before: string | null;
  after: string;
}) {
  const rows = useMemo(
    () => expandLineDiff(before ?? "", after ?? ""),
    [before, after]
  );

  const hasChange = useMemo(
    () => rows.some((r) => r.kind !== "same"),
    [rows]
  );

  if (rows.length === 0) {
    return (
      <p className={styles.diffNoChange}>비교할 HTML이 없습니다.</p>
    );
  }

  if (!hasChange) {
    return (
      <p className={styles.diffNoChange}>
        이 반영에서는 줄 단위로는 변경이 없습니다. (이전과 이후 HTML이 동일)
      </p>
    );
  }

  return (
    <div className={styles.diffRoot} role="region" aria-label="HTML 줄 단위 변경">
      <div className={styles.diffInner}>
        {rows.map((row) => (
          <div
            key={row.key}
            className={
              row.kind === "add"
                ? styles.diffRowAdd
                : row.kind === "remove"
                  ? styles.diffRowDel
                  : styles.diffRowSame
            }
          >
            <span className={styles.diffGutter} aria-hidden>
              {row.kind === "add" ? "+" : row.kind === "remove" ? "-" : " "}
            </span>
            <code className={styles.diffCode}>{row.text}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
