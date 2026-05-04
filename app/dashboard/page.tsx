import { Suspense } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { Noto_Sans_KR } from "next/font/google";
import { PolicyWorkspace } from "./PolicyWorkspace";
import styles from "./dashboard.module.css";

const dashboardSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

function DashboardPolicyFallback({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={`${styles.shell} ${className ?? ""}`.trim()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
        color: "#4e5968",
        fontSize: "15px",
      }}
    >
      대시보드 불러오는 중…
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mall_id?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession();
  const mallId = sp.mall_id ?? session?.mall_id ?? "";

  return (
    <div className={`${styles.shell} ${dashboardSans.className}`}>
      {!mallId ? (
        <div className={styles.inner}>
          <h1 className={styles.heading}>대시보드</h1>
          <p className={styles.lead}>
            세션에 몰 정보가 없습니다. 앱을 다시 실행하거나 URL에{" "}
            <code className={styles.mono}>?mall_id=</code>를 붙여 주세요.
          </p>
        </div>
      ) : (
        <Suspense
          fallback={<DashboardPolicyFallback className={dashboardSans.className} />}
        >
          <PolicyWorkspace key={mallId} mallId={mallId} />
        </Suspense>
      )}
    </div>
  );
}
