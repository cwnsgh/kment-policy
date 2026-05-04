import styles from "./dashboard.module.css";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mall_id?: string }>;
}) {
  const { mall_id } = await searchParams;

  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>대시보드</h1>
        <p className={styles.lead}>
          인증이 끝난 뒤 여기서 정책/기능을 확장하면 됩니다.
        </p>
        <p className={styles.meta}>
          mall_id: <span className={styles.mono}>{mall_id || "(없음)"}</span>
        </p>
      </div>
    </div>
  );
}
