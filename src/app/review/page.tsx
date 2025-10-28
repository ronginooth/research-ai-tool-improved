"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Bell, FileText, Settings, Eye, Edit3, Save } from "lucide-react";
import { Paper, AIProvider } from "@/types";
import ReviewForm from "@/components/review/ReviewForm";
import ReviewDisplay from "@/components/review/ReviewDisplay";
import MarkdownRenderer from "@/components/library/MarkdownRenderer";

export default function ReviewPage() {
  const [topic, setTopic] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [review, setReview] =
    useState(`# KIF6遺伝子多型と心血管リスクに関する研究レビュー

## 概要

**KIF6** (Kinesin Family Member 6) 遺伝子の多型は、心血管疾患のリスク因子として注目されている。本レビューでは、KIF6遺伝子多型と心血管リスクに関する最新の研究動向をまとめる。

## 主要な知見

### 1. KIF6遺伝子の機能

KIF6は *kinesin* ファミリーに属するタンパク質で、以下の機能を持つ：

- 細胞内輸送の調節
- 有糸分裂の制御
- 神経細胞の軸索輸送

### 2. 遺伝子多型の影響

研究により、以下の多型が特定されている：

1. **rs20455** - 最も研究されている多型
2. **rs9462535** - 機能的多型
3. **rs9471077** - 新たに発見された多型

### 3. 心血管リスクとの関連

> 複数の大規模コホート研究により、KIF6遺伝子多型が心血管イベントのリスクと関連することが示されている。

#### メタアナリシス結果

以下の研究が重要な知見を提供している：

- Smith et al. (2020) - 大規模コホート研究
- Johnson et al. (2021) - メタアナリシス
- Brown et al. (2022) - 機能解析

### 4. 臨床的意義

\`\`\`python
# KIF6遺伝子型のリスク計算例
def calculate_risk(genotype):
    if genotype == "AA":
        return 1.0  # 基準リスク
    elif genotype == "AG":
        return 1.3  # 中等度リスク
    elif genotype == "GG":
        return 1.8  # 高リスク
    else:
        return None
\`\`\`

## 今後の研究方向

### 未解決の課題

- 遺伝子-環境相互作用の解明
- 個別化医療への応用
- 薬剤反応性との関連

### 研究ギャップ

1. **機序の解明**: KIF6が心血管リスクに影響する分子機序
2. **個別化医療**: 遺伝子型に基づく治療戦略
3. **予防医学**: リスク予測モデルの構築

---

## 結論

KIF6遺伝子多型は心血管リスクの重要な予測因子として注目されている。今後の研究により、より詳細な機序解明と臨床応用が期待される。

### 参考文献

- [1] Smith, J. et al. (2020). "KIF6 polymorphism and cardiovascular risk"
- [2] Johnson, M. et al. (2021). "Meta-analysis of KIF6 studies"
- [3] Brown, K. et al. (2022). "Functional analysis of KIF6 variants"

詳細は [PubMed](https://pubmed.ncbi.nlm.nih.gov/) で検索してください。`);
  const [generating, setGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<AIProvider>("gemini");
  const [searchMode, setSearchMode] = useState<"auto" | "manual">("auto");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">(
    "edit"
  );
  const [saving, setSaving] = useState(false);

  const handleSaveReview = async () => {
    if (!topic || !review) {
      toast.error("保存に必要な情報が不足しています");
      return;
    }

    setSaving(true);
    try {
      const reviewResponse = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${topic}に関する文献レビュー`,
          topic,
          content: review,
          paperIds: papers?.map((paper) => paper.paperId) || [],
        }),
      });

      if (!reviewResponse.ok) {
        throw new Error("レビューの保存に失敗しました");
      }

      if (papers && papers.length > 0) {
        const results = await Promise.all(
          papers.map(async (paper) => {
            const response = await fetch("/api/library", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paperId: paper.paperId,
                title: paper.title,
                authors: paper.authors,
                year: paper.year,
                abstract: paper.abstract,
                url: paper.url,
                citationCount: paper.citationCount,
                venue: paper.venue,
                tags: ["レビュー引用"],
              }),
            });
            return response.ok;
          })
        );

        const successCount = results.filter(Boolean).length;
        if (successCount > 0) {
          toast.success(
            `レビューを保存し、${successCount}件の文献をライブラリーに追加しました`
          );
        } else {
          toast.success("レビューを保存しました");
        }
      } else {
        toast.success("レビューを保存しました");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("レビューの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (
    provider: AIProvider,
    mode: "auto" | "manual",
    filters: any
  ) => {
    if (!topic.trim()) {
      toast.error("研究トピックを入力してください");
      return;
    }

    if (mode === "manual" && papers.length === 0) {
      toast.error("関連論文を選択してください");
      return;
    }

    setGenerating(true);
    setSelectedProvider(provider);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          papers,
          provider,
          filters,
          searchMode: mode,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "レビュー生成に失敗しました");
      }

      setReview(data.review);
      setSearchMode(mode);

      if (data.papers?.length) {
        setPapers(data.papers);
      }

      toast.success("レビューを生成しました");
    } catch (error) {
      console.error("Review generation error:", error);
      toast.error("レビュー生成中にエラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

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
              レビュー生成
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
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-slate-900">
                AI Literature Review Generator
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                研究トピックと関連論文をもとに、落合方式のレビューを生成します。
              </p>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    Review Settings
                  </h2>
                </div>
                <ReviewForm
                  topic={topic}
                  setTopic={setTopic}
                  papers={papers}
                  setPapers={setPapers}
                  generating={generating}
                  onGenerate={handleGenerate}
                  userId="demo-user-123"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Generated Review
                  </h2>
                  <div className="flex items-center gap-2">
                    {review && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        ✓ 完了
                      </span>
                    )}
                    {review && (
                      <div className="flex rounded-lg border border-slate-200">
                        <button
                          onClick={() => setViewMode("edit")}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                            viewMode === "edit"
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Edit3 className="h-3 w-3" />
                          編集
                        </button>
                        <button
                          onClick={() => setViewMode("preview")}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                            viewMode === "preview"
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          プレビュー
                        </button>
                        <button
                          onClick={() => setViewMode("split")}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                            viewMode === "split"
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <FileText className="h-3 w-3" />
                          分割
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {review ? (
                  <div className="space-y-4">
                    {viewMode === "edit" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          レビュー内容を編集
                        </label>
                        <textarea
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                          className="w-full h-96 p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="レビュー内容をMarkdown形式で編集してください..."
                        />
                      </div>
                    )}

                    {viewMode === "preview" && (
                      <div className="prose max-w-none">
                        <MarkdownRenderer
                          content={review}
                          papers={papers || []}
                          onPaperClick={(paper) => {
                            console.log("Paper clicked:", paper);
                          }}
                        />
                      </div>
                    )}

                    {viewMode === "split" && (
                      <div className="grid grid-cols-2 gap-4 h-96">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            編集
                          </label>
                          <textarea
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            className="w-full h-full p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="レビュー内容をMarkdown形式で編集してください..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            プレビュー
                          </label>
                          <div className="h-full p-4 border border-slate-300 rounded-lg overflow-y-auto">
                            <MarkdownRenderer
                              content={review}
                              papers={papers || []}
                              onPaperClick={(paper) => {
                                console.log("Paper clicked:", paper);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <div className="text-sm text-slate-500">
                        {review.length} 文字
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveReview}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {saving ? "保存中..." : "保存"}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(review);
                              toast.success(
                                "レビューをクリップボードにコピーしました"
                              );
                            } catch (error) {
                              toast.error("コピーに失敗しました");
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          コピー
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([review], {
                              type: "text/plain;charset=utf-8",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "literature-review.txt";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            toast.success("レビューをダウンロードしました");
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          ダウンロード
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-slate-400 mb-4">
                      <FileText className="h-16 w-16 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                      レビューが生成されていません
                    </h3>
                    <p className="text-slate-600">
                      研究トピックと関連論文を入力して、文献レビューを生成してください。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {!review && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-center text-lg font-semibold text-slate-900">
                おすすめの研究トピック例
              </h3>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-3 text-sm text-slate-600">
                  <h4 className="text-sm font-semibold text-slate-700">
                    トピック例
                  </h4>
                  <ul className="space-y-2">
                    <li>機械学習による自然言語処理の最新動向</li>
                    <li>深層学習を用いた画像認識技術の発展</li>
                    <li>ブロックチェーン技術の金融分野への応用</li>
                    <li>カルシウムが神経細胞中で微小管解体を促進する仕組み</li>
                  </ul>
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  <h4 className="text-sm font-semibold text-slate-700">
                    キーワード例
                  </h4>
                  <ul className="space-y-2">
                    <li>"machine learning natural language processing"</li>
                    <li>"deep learning image recognition"</li>
                    <li>"blockchain finance risk management"</li>
                    <li>"microtubule calcium signaling"</li>
                  </ul>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
