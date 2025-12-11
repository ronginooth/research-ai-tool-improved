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
  const [libraryPapers, setLibraryPapers] = useState<Set<string>>(new Set());

  // ライブラリの論文を先に取得（Citation Map表示前に実行）
  useEffect(() => {
    const fetchLibraryPapers = async () => {
      try {
        const response = await fetch("/api/library?userId=demo-user-123");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.papers) {
            // paper_id（Semantic Scholar ID）を取得
            // 注意: p.idはUUID、p.paper_idまたはp.paperIdがSemantic Scholar ID
            const paperIds = new Set<string>(
              data.papers
                .map((p: any) => {
                  // paper_idまたはpaperIdを優先（Semantic Scholar ID）
                  const semanticId = p.paper_id || p.paperId;
                  return semanticId ? String(semanticId) : null;
                })
                .filter(Boolean)
            );
            console.log("Fetched library papers (parent, Semantic Scholar IDs):", Array.from(paperIds));
            console.log("Sample paper from library (parent):", data.papers[0] ? {
              id: data.papers[0].id, // UUID
              paper_id: data.papers[0].paper_id, // Semantic Scholar ID
              paperId: data.papers[0].paperId, // マッピングされたSemantic Scholar ID
              title: data.papers[0].title?.substring(0, 50)
            } : "No papers");
            setLibraryPapers(paperIds);
          }
        }
      } catch (error) {
        console.error("Failed to fetch library papers:", error);
      }
    };

    fetchLibraryPapers();
  }, []);

  // URLパラメータからDOI、HTML URL、paperId、または検索クエリを取得して自動的にCitation Mapを生成
  useEffect(() => {
    const doiParam = searchParams.get("doi");
    const htmlParam = searchParams.get("html");
    const paperIdParam = searchParams.get("paperId");
    const searchParam = searchParams.get("search");
    
    if (paperIdParam) {
      // paperIdから直接Citation Mapを生成
      handleGenerateWithPaperId(paperIdParam);
    } else if (doiParam) {
      setDoi(doiParam);
      // 自動的にCitation Mapを生成
      handleGenerateWithDoi(doiParam);
    } else if (htmlParam) {
      // HTML URLからDOIを抽出するか、HTML URLで直接検索
      handleGenerateWithHtml(htmlParam);
    } else if (searchParam) {
      // 検索クエリから論文を検索してCitation Mapを生成
      handleGenerateWithSearch(searchParam);
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

  const handleGenerateWithHtml = async (htmlUrl: string) => {
    if (!htmlUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/citation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperHTML: htmlUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setResult(data);
      // DOIが取得できた場合は表示用に設定
      if (data.doi) {
        setDoi(data.doi);
      }
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/citation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperSearch: searchQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setResult(data);
      // DOIが取得できた場合は表示用に設定
      if (data.doi) {
        setDoi(data.doi);
      }
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithPaperId = async (paperId: string) => {
    if (!paperId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/citation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: paperId.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        let errorMsg = data.error || "Failed";
        if (data.suggestion) {
          errorMsg += `\n\n${data.suggestion}`;
        }
        throw new Error(errorMsg);
      }
      setResult(data);
      // DOIが取得できた場合は表示用に設定
      if (data.doi) {
        setDoi(data.doi);
      }
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
                <CitationMapVisualization 
                  data={result.citationMap} 
                  initialLibraryPapers={libraryPapers}
                />
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
