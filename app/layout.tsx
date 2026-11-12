import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SameStory · 같은 사건, 다른 보도를 한눈에",
  description: "MinHash와 LSH로 비슷한 영어 뉴스 제목을 묶고, 사건별 공통 내용과 수치 차이를 탐색하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
