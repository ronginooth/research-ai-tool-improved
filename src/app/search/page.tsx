"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // クエリパラメータを保持してトップページにリダイレクト
    const query = searchParams.get("q");
    const type = searchParams.get("type");
    const mode = searchParams.get("mode");
    const sources = searchParams.get("sources");

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("type", type);
    if (mode) params.set("mode", mode);
    if (sources) params.set("sources", sources);

    router.replace(`/?${params.toString()}`);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
        <p className="text-[var(--color-text-secondary)]">リダイレクト中...</p>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">読み込み中...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
