"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";
import { Home } from "lucide-react";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] mb-4"
          >
            <Home className="h-5 w-5" />
            <span>ホームに戻る</span>
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
            Research AI Tool
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            学術論文検索とAIレビュー生成
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}






