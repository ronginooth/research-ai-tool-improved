"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home, Search, BookOpen, Network } from "lucide-react";
import CitationMapVisualization from "@/components/tools/CitationMapVisualization";

function CitationMapPageContent() {
  const searchParams = useSearchParams();
  const [doi, setDoi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // URLパラメータからDOIを取得して自動的にCitation Mapを生成
  useEffect(() => {
    const doiParam = searchParams.get("doi");
    if (doiParam) {
      setDoi(doiParam);
      // 自動的にCitation Mapを生成
      handleGenerateWithDoi(doiParam);
    }
  }, [searchParams]);

  const handleGenerateWithDoi = async (doiValue: string) => {
    if (!doiValue.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/citation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperDOI: doiValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!doi.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/citation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperDOI: doi.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 text-slate-800 overflow-hidden">
      <header
        className="fixed top-0 left-0 right-0 z-[99999] border-b border-slate-200 bg-white shadow-sm"
        style={{ zIndex: 99999 }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-slate-900">
              Citation Map
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Home className="h-4 w-4" />
              <span>ホーム</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Search className="h-4 w-4" />
              <span>検索</span>
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <BookOpen className="h-4 w-4" />
              <span>ライブラリ</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8 pt-24 h-full overflow-y-auto">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mt-2 text-sm text-slate-600">
            DOI を入力すると引用関係の概要を表示できます。
          </p>

          <div className="mt-4 space-y-3">
            <label className="text-xs font-semibold text-slate-600">DOI</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-800 shadow-inner focus:border-slate-500 focus:outline-none"
              placeholder="10.1038/s41586-020-2649-2"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {loading ? "生成中..." : "生成"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              エラー: {error}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              {/* ネットワーク図 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  引用関係ネットワーク
                </h3>
                <div className="mb-3 text-sm text-slate-600">
                  ノード: {result.stats?.totalNodes} / エッジ:{" "}
                  {result.stats?.totalEdges}
                </div>
                <CitationMapVisualization data={result.citationMap} />
              </div>

              {/* 詳細データ */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  詳細データ
                </h3>
                <pre className="max-h-96 overflow-auto rounded-lg bg-white p-4 text-xs text-slate-700">
                  {JSON.stringify(result.citationMap, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function CitationMapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center">読み込み中...</div>}>
      <CitationMapPageContent />
    </Suspense>
  );
}
