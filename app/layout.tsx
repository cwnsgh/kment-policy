import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kment Policy",
  description: "카페24 앱 인증 스타터",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
