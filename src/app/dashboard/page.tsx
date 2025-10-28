"use client";

import { useState, useEffect } from "react";
import {
  Search,
  FileText,
  BookOpen,
  TrendingUp,
  Users,
  BarChart3,
  Zap,
  Bell,
  Settings,
  Activity,
  Target,
  Award,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalPapers: number;
  totalReviews: number;
  totalProjects: number;
  recentActivity: Activity[];
  topKeywords: KeywordStats[];
  researchTrends: TrendData[];
}

interface Activity {
  id: string;
  type: "search" | "review" | "save" | "share";
  description: string;
  timestamp: string;
  userId: string;
}

interface KeywordStats {
  keyword: string;
  count: number;
  trend: "up" | "down" | "stable";
  change: number;
}

interface TrendData {
  date: string;
  value: number;
  category: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPapers: 0,
    totalReviews: 0,
    totalProjects: 0,
    recentActivity: [],
    topKeywords: [],
    researchTrends: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ダッシュボードデータを取得
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 実際の実装では API からデータを取得
      setStats({
        totalPapers: 1247,
        totalReviews: 23,
        totalProjects: 8,
        recentActivity: [
          {
            id: "1",
            type: "search",
            description: 'Searched for "machine learning in healthcare"',
            timestamp: "2024-01-15T10:30:00Z",
            userId: "user-123",
          },
          {
            id: "2",
            type: "review",
            description: 'Generated literature review on "AI ethics"',
            timestamp: "2024-01-15T09:15:00Z",
            userId: "user-123",
          },
          {
            id: "3",
            type: "save",
            description: 'Saved 5 papers to "AI Research" collection',
            timestamp: "2024-01-15T08:45:00Z",
            userId: "user-123",
          },
        ],
        topKeywords: [
          { keyword: "machine learning", count: 45, trend: "up", change: 12 },
          {
            keyword: "artificial intelligence",
            count: 38,
            trend: "up",
            change: 8,
          },
          { keyword: "deep learning", count: 32, trend: "stable", change: 0 },
          { keyword: "neural networks", count: 28, trend: "down", change: -5 },
          {
            keyword: "natural language processing",
            count: 24,
            trend: "up",
            change: 15,
          },
        ],
        researchTrends: [
          { date: "2024-01-01", value: 120, category: "Papers" },
          { date: "2024-01-02", value: 135, category: "Papers" },
          { date: "2024-01-03", value: 142, category: "Papers" },
          { date: "2024-01-04", value: 158, category: "Papers" },
          { date: "2024-01-05", value: 167, category: "Papers" },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ホームに戻る
            </Link>
            <span className="text-lg font-semibold text-slate-900">
              Dashboard
            </span>
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

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">研究概要</h2>
          <p className="mt-2 text-sm text-slate-600">
            保存した論文やレビュー生成状況をまとめています。
          </p>
        </div>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Total Papers
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {stats.totalPapers.toLocaleString()}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              +12% from last month
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Reviews Generated
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {stats.totalReviews}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              +3 this week
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Active Projects
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {stats.totalProjects}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
              <Activity className="h-3 w-3" />2 updated today
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Research Hours
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  47.5
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-600">
              <Award className="h-3 w-3" />
              This week
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Recent Activity
                </h3>
                <Link
                  href="/activity"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-4 text-sm text-slate-600">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                      {activity.type === "search" && (
                        <Search className="h-4 w-4" />
                      )}
                      {activity.type === "review" && (
                        <FileText className="h-4 w-4" />
                      )}
                      {activity.type === "save" && (
                        <BookOpen className="h-4 w-4" />
                      )}
                      {activity.type === "share" && (
                        <Users className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-800">
                        {activity.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Top Keywords
                </h3>
                <Link
                  href="/analytics"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                {stats.topKeywords.map((keyword, index) => (
                  <div
                    key={keyword.keyword}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">
                        #{index + 1}
                      </span>
                      {keyword.keyword}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {keyword.count}
                      <span
                        className={`font-semibold ${
                          keyword.trend === "up"
                            ? "text-emerald-600"
                            : keyword.trend === "down"
                            ? "text-red-500"
                            : "text-slate-500"
                        }`}
                      >
                        {keyword.change > 0 ? "+" : ""}
                        {keyword.change}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">
            Quick Actions
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/search"
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Search className="h-6 w-6 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">
                Search Papers
              </span>
              <span className="text-xs text-slate-600">
                Find relevant research
              </span>
            </Link>
            <Link
              href="/review"
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-6 w-6 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">
                Generate Review
              </span>
              <span className="text-xs text-slate-600">
                AI literature review
              </span>
            </Link>
            <Link
              href="/tools/citation-map"
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <BarChart3 className="h-6 w-6 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">
                Citation Map
              </span>
              <span className="text-xs text-slate-600">
                Visualize connections
              </span>
            </Link>
            <Link
              href="/tools/research-gap"
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Zap className="h-6 w-6 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">
                Find Gaps
              </span>
              <span className="text-xs text-slate-600">
                Research opportunities
              </span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
