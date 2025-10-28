"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  BookOpen,
  Map,
  Lightbulb,
  Upload,
  Settings,
  Bell,
  TrendingUp,
  Users,
  BarChart3,
  Zap,
} from "lucide-react";
import Link from "next/link";

const SOURCE_OPTIONS = [
  { key: "papers", label: "Papers" },
  { key: "internet", label: "Web" },
  { key: "library", label: "Library" },
];

const QUICK_LINKS = [
  {
    href: "/search",
    icon: Search,
    title: "Search Papers",
    description: "高度な AI 検索で関連論文を素早く発見",
    color: "text-sky-600",
  },
  {
    href: "/review",
    icon: FileText,
    title: "Generate Reviews",
    description: "落合方式レビューを自動作成",
    color: "text-emerald-600",
  },
  {
    href: "/library",
    icon: BookOpen,
    title: "My Library",
    description: "保存済みの論文・AI 解説を管理",
    color: "text-indigo-600",
  },
  {
    href: "/dashboard",
    icon: BarChart3,
    title: "Dashboard",
    description: "研究アクティビティと指標を俯瞰",
    color: "text-amber-600",
  },
];

const TOOL_LINKS = [
  {
    href: "/tools/citation-map",
    icon: Map,
    title: "Citation Map",
    description: "引用ネットワークを視覚化",
  },
  {
    href: "/project-integration",
    icon: Lightbulb,
    title: "Project Integration",
    description: "研究プロジェクトと連携した論文執筆ツール",
  },
  {
    href: "/tools/research-gap",
    icon: Lightbulb,
    title: "Research Gap Finder",
    description: "未解決課題を抽出",
  },
  {
    href: "/tools/pdf-chat",
    icon: FileText,
    title: "PDF Chat",
    description: "PDF と対話しながら理解",
  },
  {
    href: "/tools/writer",
    icon: Zap,
    title: "AI Writer",
    description: "文章生成と校正をサポート",
  },
];

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<
    "auto" | "literature" | "deep-dive"
  >("auto");
  const [searchMode, setSearchMode] = useState<"lite" | "pro">("lite");
  const [sources, setSources] = useState<string[]>(["papers"]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const params = new URLSearchParams({
      q: searchQuery.trim(),
      type: searchType,
      mode: searchMode,
      sources: sources.join(","),
    });
    router.push(`/search?${params.toString()}`);
  };

  const toggleSource = (key: string) => {
    setSources((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-semibold text-slate-800">
              AnswerThis
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
              <Link href="/search" className="hover:text-slate-900">
                検索
              </Link>
              <Link href="/review" className="hover:text-slate-900">
                レビュー
              </Link>
              <Link href="/library" className="hover:text-slate-900">
                ライブラリ
              </Link>
              <Link href="/tools" className="hover:text-slate-900">
                ツール
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-full bg-slate-300" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center">
            <h1 className="text-3xl font-semibold text-slate-900">
              研究を加速するインテリジェンスハブ
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              AI
              による検索・レビュー・ギャップ抽出・ライブラリ管理をひとつの画面から。落ち着いた操作体験で、論文探索に集中できます。
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="relative flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="研究テーマや疑問を入力 (例: KIF6 polymorphism cardiovascular risk)"
                className="flex-1 border-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-900"
              >
                検索する
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">
                  検索タイプ
                </p>
                <div className="flex items-center gap-2">
                  {[
                    { key: "auto", label: "標準" },
                    { key: "literature", label: "レビュー" },
                    { key: "deep-dive", label: "深掘り" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() =>
                        setSearchType(item.key as typeof searchType)
                      }
                      className={`flex-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                        searchType === item.key
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">検索対象</p>
                <div className="flex items-center gap-2">
                  {SOURCE_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => toggleSource(item.key)}
                      className={`flex-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                        sources.includes(item.key)
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">モード</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSearchMode("lite")}
                    className={`flex-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                      searchMode === "lite"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Lite
                  </button>
                  <button
                    onClick={() => setSearchMode("pro")}
                    className={`flex-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                      searchMode === "pro"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Pro
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <Settings className="mr-1 inline h-3.5 w-3.5" />
                    詳細設定
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
              <Upload className="h-4 w-4" />
              <span>
                PDF
                やメモを直接検索対象に加えたい場合は、ライブラリからアップロードしてください。
              </span>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              おすすめツール
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              研究ワークフローを支援する専用ツール群です。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {TOOL_LINKS.map(({ href, icon: Icon, title, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-200 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              ワークフローの可視化
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Search className="mt-1 h-4 w-4 text-slate-500" />
                <p>
                  <span className="font-semibold text-slate-700">
                    ステップ 1:
                  </span>
                  AI 検索で関連論文を発見し、必要に応じて Pro
                  モードで引用ネットワークを追跡。
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <BookOpen className="mt-1 h-4 w-4 text-slate-500" />
                <p>
                  <span className="font-semibold text-slate-700">
                    ステップ 2:
                  </span>
                  気になる論文をライブラリに保存し、PDF プレビューや AI
                  解説で理解を深めます。
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <FileText className="mt-1 h-4 w-4 text-slate-500" />
                <p>
                  <span className="font-semibold text-slate-700">
                    ステップ 3:
                  </span>
                  レビュー生成ツールで落合方式のまとめを出力し、研究ギャップ分析に繋げましょう。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-800">
            クイックアクセス
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map(
              ({ href, icon: Icon, title, description, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"
                >
                  <Icon className={`h-8 w-8 ${color}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </Link>
              )
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} AnswerThis Research Platform</span>
          <div className="flex items-center gap-3">
            <Link href="/tools" className="hover:text-slate-700">
              ツール一覧
            </Link>
            <Link href="/library" className="hover:text-slate-700">
              ライブラリ
            </Link>
            <Link href="/review" className="hover:text-slate-700">
              レビュー作成
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
