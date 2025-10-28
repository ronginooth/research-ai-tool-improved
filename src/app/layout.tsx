import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Research AI Tool - Improved",
  description: "Advanced AI-powered research assistance platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-100 text-slate-800">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
