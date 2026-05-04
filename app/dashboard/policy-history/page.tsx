import { Suspense } from "react";
import { Noto_Sans_KR } from "next/font/google";
import { PolicyHistoryClient } from "./PolicyHistoryClient";

const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

function HistoryFallback() {
  return (
    <div
      className={sans.className}
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background: "#f2f4f6",
        color: "#4e5968",
        fontSize: "15px",
      }}
    >
      불러오는 중…
    </div>
  );
}

export default function PolicyHistoryPage() {
  return (
    <div className={sans.className}>
      <Suspense fallback={<HistoryFallback />}>
        <PolicyHistoryClient />
      </Suspense>
    </div>
  );
}
