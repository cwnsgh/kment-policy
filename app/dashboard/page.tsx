import { getServerSession } from "@/lib/auth/server-session";
import { PolicyWorkspace } from "./PolicyWorkspace";
import styles from "./dashboard.module.css";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mall_id?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession();
  const mallId = sp.mall_id ?? session?.mall_id ?? "";

  return (
    <div className={styles.shell}>
      {!mallId ? (
        <div className={styles.inner}>
          <h1 className={styles.heading}>대시보드</h1>
          <p className={styles.lead}>
            세션에 몰 정보가 없습니다. 앱을 다시 실행하거나 URL에{" "}
            <code className={styles.mono}>?mall_id=</code>를 붙여 주세요.
          </p>
        </div>
      ) : (
        <PolicyWorkspace mallId={mallId} />
      )}
    </div>
  );
}
