import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "전실 AI - 전기기사 실기 AI 튜터",
  description: "AI가 당신의 전기기사 실기 합격을 책임집니다. 사진 한 장으로 문제 풀이부터 KEC 규정 검증까지.",
  keywords: ["전기기사", "실기", "AI", "튜터", "문제풀이", "KEC"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
