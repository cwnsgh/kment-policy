"use client";

import styles from "./FullPageLoader.module.css";

export function FullPageLoader({ label = "로딩 중..." }: { label?: string }) {
  return (
    <div className={styles.pageCenter}>
      <div className={styles.inner}>
        <div className={styles.spinner} aria-hidden />
        <h2 className={styles.title}>{label}</h2>
      </div>
    </div>
  );
}
