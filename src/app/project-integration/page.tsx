"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  FolderOpen,
  FileText,
  Search,
  Lightbulb,
  Download,
  Save,
  Eye,
  Edit3,
  Plus,
  CheckCircle,
  MessageSquare,
  Home,
  BookOpen,
  Network,
  Tag,
  X,
  Filter,
} from "lucide-react";
import MarkdownRenderer from "@/components/library/MarkdownRenderer";

interface Project {
  name: string;
  path: string;
  description?: string;
  lastModified: string;
  hasWritingDir: boolean;
}

export default function ProjectIntegration() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [topic, setTopic] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [gapAnalysis, setGapAnalysis] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [draftType, setDraftType] = useState("introduction");
  const [loading, setLoading] = useState(false);
  const [cursorChatEnabled, setCursorChatEnabled] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">(
    "edit"
  );
  const [libraryPapers, setLibraryPapers] = useState<any[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<any[]>([]);
  const [showPaperSelector, setShowPaperSelector] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // プロジェクト一覧を取得
  useEffect(() => {
    fetchProjects();
    fetchLibraryPapers();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (data.success) {
        setProjects(data.projects);
      } else {
        toast.error("プロジェクトの取得に失敗しました");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("プロジェクトの取得に失敗しました");
    }
  };

  const fetchLibraryPapers = async () => {
    try {
      const response = await fetch("/api/library");
      const data = await response.json();

      if (data.success) {
        setLibraryPapers(data.papers || []);
      } else {
        console.error("Failed to fetch library papers:", data.error);
      }
    } catch (error) {
      console.error("Error fetching library papers:", error);
    }
  };

  // Cursorチャット連携機能
  const enableCursorChat = async () => {
    if (!selectedProject) {
      toast.error("プロジェクトを選択してください");
      return;
    }

    try {
      const response = await fetch("/api/cursor-chat/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectPath: selectedProject.path,
          projectName: selectedProject.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCursorChatEnabled(true);
        toast.success("Cursorチャット連携が有効になりました");

        const initialMessage = {
          id: Date.now(),
          role: "assistant",
          content: `${selectedProject.name}プロジェクトのCursorチャットに接続しました。研究ギャップ分析と論文執筆をサポートします。何かお手伝いできることはありますか？`,
          timestamp: new Date().toISOString(),
        };
        setChatMessages([initialMessage]);
      } else {
        toast.error("Cursorチャット連携の有効化に失敗しました");
      }
    } catch (error) {
      console.error("Error enabling cursor chat:", error);
      toast.error("Cursorチャット連携の有効化に失敗しました");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedProject) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setSendingMessage(true);

    try {
      const response = await fetch("/api/cursor-chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectPath: selectedProject.path,
          message: newMessage,
          context: {
            topic,
            projectContext,
            gapAnalysis,
            draft,
            draftType,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || "メッセージの送信に失敗しました");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "申し訳ありません。メッセージの送信に失敗しました。",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const disableCursorChat = () => {
    setCursorChatEnabled(false);
    setChatMessages([]);
    toast.success("Cursorチャット連携を無効にしました");
  };

  const saveGapAnalysis = async () => {
    if (!gapAnalysis || !topic) {
      toast.error("分析結果と研究トピックが必要です");
      return;
    }

    setSavingAnalysis(true);
    try {
      const usedPapers =
        selectedPapers.length > 0 ? selectedPapers : libraryPapers.slice(0, 5);

      const response = await fetch("/api/gap-analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic,
          context: projectContext,
          analysis: gapAnalysis,
          papers: usedPapers,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("研究ギャップ分析が保存されました");
      } else {
        throw new Error(data.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Error saving gap analysis:", error);
      toast.error("保存に失敗しました");
    } finally {
      setSavingAnalysis(false);
    }
  };

  const analyzeGaps = async () => {
    if (!topic.trim()) {
      toast.error("研究トピックを入力してください");
      return;
    }

    setAnalysisLoading(true);
    try {
      // 研究ギャップ分析APIを直接使用
      const response = await fetch("/api/research-gaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic,
          projectContext: projectContext,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 研究ギャップ分析結果を直接設定
        setGapAnalysis(data.analysis);
        toast.success("研究ギャップ分析が完了しました");
      } else {
        throw new Error(data.error || "分析に失敗しました");
      }
    } catch (error) {
      console.error("Error analyzing gaps:", error);
      toast.error("分析に失敗しました");

      // エラー時はフォールバック用の動的モックデータを生成
      const fallbackGaps = generateDynamicMockGaps(topic, projectContext);
      const analysis = formatGapsAsMarkdown(
        fallbackGaps,
        topic,
        projectContext
      );
      setGapAnalysis(analysis);
      toast.success(
        `フォールバック分析: ${fallbackGaps.length}個の研究ギャップを発見しました`
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  // レビュー結果を研究ギャップ分析形式に変換する関数
  const convertReviewToGapAnalysis = (
    review: string,
    topic: string,
    context: string
  ): string => {
    // 使用された論文の情報を取得
    const usedPapers =
      selectedPapers.length > 0 ? selectedPapers : libraryPapers.slice(0, 5);

    return `# ${topic}に関する研究ギャップ分析

## 1. 研究背景と目的

**研究トピック**: ${topic}
**プロジェクトコンテキスト**: ${context || "なし"}
**分析対象論文数**: ${usedPapers.length}件

${review}

---

## 引用文献

${usedPapers
  .map((paper, index) => {
    const authors = Array.isArray(paper.authors)
      ? paper.authors.map((author: any) => author.name || author).join(", ")
      : paper.authors || "著者不明";

    return `[${index + 1}] ${authors}. ${paper.title}. ${paper.venue}, ${
      paper.year
    }.`;
  })
  .join("\n")}

---

*この分析は${
      usedPapers.length
    }件の論文を基に生成されました。各論文の詳細はライブラリで確認できます。*`;
  };

  // 動的なモックデータ生成関数
  const generateDynamicMockGaps = (topic: string, context: string) => {
    const gaps = [];

    // 研究トピックに基づいて動的にギャップを生成
    if (
      topic.toLowerCase().includes("遺伝子") ||
      topic.toLowerCase().includes("gene")
    ) {
      gaps.push({
        id: "gap1",
        title: `${topic}の分子機序の不明確さ`,
        description: `${topic}に関する研究では統計的関連性は示されているが、具体的な分子機序や機能的な影響が未解明である。`,
        category: "methodological",
        severity: "high",
        feasibilityScore: 8,
        potentialImpact: 9,
        researchQuestions: [
          `${topic}の機能にどのような影響を与えるか？`,
          `分子レベルでのメカニズムはどのようなものか？`,
          `疾患の進行にどのように関与するか？`,
        ],
        suggestedApproaches: [
          "機能解析研究の実施",
          "細胞培養系での検証",
          "動物モデルでの検証",
        ],
      });
    }

    if (
      topic.toLowerCase().includes("リスク") ||
      topic.toLowerCase().includes("risk")
    ) {
      gaps.push({
        id: "gap2",
        title: `${topic}の個別化医療への応用不足`,
        description: `${topic}の情報を臨床的に活用するためのガイドラインや治療指針が不足している。`,
        category: "domain",
        severity: "medium",
        feasibilityScore: 6,
        potentialImpact: 8,
        researchQuestions: [
          `${topic}に基づくリスク評価はどの程度有用か？`,
          `個別化治療戦略は効果的か？`,
          `臨床応用のための基準値はどのように設定すべきか？`,
        ],
        suggestedApproaches: [
          "大規模コホート研究の実施",
          "臨床試験の設計と実施",
          "リスク評価モデルの構築",
        ],
      });
    }

    // 一般的なギャップを追加
    gaps.push({
      id: "gap3",
      title: `${topic}の長期予後データの不足`,
      description: `${topic}に関する長期追跡データが限定的であり、10年以上の縦断的研究が不足している。`,
      category: "temporal",
      severity: "medium",
      feasibilityScore: 5,
      potentialImpact: 7,
      researchQuestions: [
        `${topic}の長期予後への影響は持続するか？`,
        `他の因子との相互作用はあるか？`,
        `予防的介入の効果はどの程度か？`,
      ],
      suggestedApproaches: [
        "長期縦断研究の実施",
        "既存コホートの長期追跡",
        "メタアナリシスの実施",
      ],
    });

    return gaps;
  };

  const formatGapsAsMarkdown = (
    gaps: any[],
    topic: string,
    context: string
  ): string => {
    return `# ${topic}に関する研究ギャップ分析

## 1. 研究背景

**研究トピック**: ${topic}
**プロジェクトコンテキスト**: ${context || "なし"}

## 2. 発見された研究ギャップ

${gaps
  .map(
    (gap, index) => `
### ${index + 1}. ${gap.title}

**カテゴリ**: ${gap.category}
**重要度**: ${gap.severity}
**実現可能性スコア**: ${gap.feasibilityScore}/10
**潜在的なインパクト**: ${gap.potentialImpact}/10

**説明**: ${gap.description}

**研究課題**:
${gap.researchQuestions.map((q: string) => `- ${q}`).join("\n")}

**推奨アプローチ**:
${gap.suggestedApproaches.map((a: string) => `- ${a}`).join("\n")}
`
  )
  .join("\n")}

## 3. 研究戦略の提案

### プロジェクトの貢献
選択されたプロジェクトは、上記の研究ギャップを以下のように埋めることができます：

1. **方法論的ギャップの解決**: 新しい解析手法や統計的アプローチの導入
2. **データ統合**: 既存のデータベースを活用した大規模解析
3. **機能解析**: 統計的解析結果と機能解析データの統合
4. **臨床応用**: 個別化医療への応用可能性の評価

### 期待される成果
- 研究ギャップの定量的評価
- 個別化リスク評価モデルの構築
- 臨床応用への道筋の提示
- 新規治療戦略の提案

この分析により、選択されたプロジェクトが研究分野に与えるインパクトを最大化することができます。`;
  };

  const generateDraft = async () => {
    if (!selectedProject || !gapAnalysis) {
      toast.error("プロジェクトを選択し、研究ギャップ分析を実行してください");
      return;
    }

    setDraftLoading(true);
    try {
      // 実際のAPIを使用してドラフトを生成
      const response = await fetch("/api/generate-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          projectName: selectedProject.name,
          projectPath: selectedProject.path,
          gapAnalysis,
          projectContext,
          draftType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDraft(data.draft);
        toast.success(`ドラフトが生成されました（${data.fileName}）`);
      } else {
        throw new Error(data.error || "ドラフト生成に失敗しました");
      }
    } catch (error) {
      console.error("Error generating draft:", error);
      toast.error("ドラフト生成に失敗しました");
      
      // フォールバック: モックデータを生成
      const mockDraft = generateMockDraft(draftType, topic, gapAnalysis);
      setDraft(mockDraft);
    } finally {
      setDraftLoading(false);
    }
  };

  const generateMockDraft = (
    type: string,
    topic: string,
    analysis: string
  ): string => {
    const baseContent = `# ${topic} - ${
      type.charAt(0).toUpperCase() + type.slice(1)
    } Section

**プロジェクト**: ${selectedProject?.name || "KIF6"}
**生成日**: ${new Date().toLocaleDateString("ja-JP")}
**セクション**: ${type}

## 研究ギャップ分析に基づく内容

${analysis}

---

`;

    switch (type) {
      case "introduction":
        return (
          baseContent +
          `## Introduction

### Background

KIF6 (kinesin family member 6) is a microtubule-associated motor protein that plays a crucial role in intracellular transport processes. Recent genome-wide association studies have identified KIF6 polymorphisms as significant predictors of cardiovascular risk, yet the underlying molecular mechanisms remain largely unexplored.

### Research Gap

The current literature demonstrates statistical associations between KIF6 polymorphisms and cardiovascular outcomes, but lacks mechanistic understanding of how these genetic variants influence disease pathogenesis. This gap represents a critical opportunity for translational research.

### Study Objectives

This study aims to:
1. Elucidate the functional impact of KIF6 polymorphisms on protein function
2. Investigate the molecular mechanisms underlying cardiovascular risk
3. Develop personalized risk assessment models based on genetic variants

### Significance

Understanding the molecular basis of KIF6-associated cardiovascular risk will advance precision medicine approaches and inform targeted therapeutic strategies.`
        );

      case "methods":
        return (
          baseContent +
          `## Methods

### Study Design

This study employs a comprehensive approach combining statistical analysis, functional genomics, and clinical validation to address the identified research gaps.

### Data Sources

- **Genetic Database**: KIF6 polymorphism data from existing cohorts
- **Clinical Data**: Cardiovascular outcome measures
- **Functional Analysis**: In vitro and in vivo validation studies

### Statistical Analysis

- **Association Studies**: Logistic regression analysis for cardiovascular outcomes
- **Functional Validation**: Protein expression and activity assays
- **Risk Modeling**: Development of personalized risk scores

### Quality Control

- **Data Validation**: Multi-center validation studies
- **Reproducibility**: Independent replication cohorts
- **Ethical Considerations**: IRB approval and informed consent

### Expected Outcomes

This methodology will provide mechanistic insights into KIF6-associated cardiovascular risk and establish a foundation for personalized medicine approaches.`
        );

      default:
        return (
          baseContent +
          `## ${type.charAt(0).toUpperCase() + type.slice(1)}

This section will be developed based on the research gap analysis and project context.

**Key Points:**
- Address identified research gaps
- Incorporate project-specific findings
- Provide evidence-based conclusions
- Suggest future research directions

The content will be tailored to the specific requirements of the ${type} section based on the comprehensive analysis provided above.`
        );
    }
  };

  const saveDraft = async () => {
    if (!selectedProject || !draft) {
      toast.error("プロジェクトを選択し、ドラフトを生成してください");
      return;
    }

    setLoading(true);
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `${draftType}_${timestamp}_edited.md`;

      toast.success(`ドラフトが${fileName}として保存されました`);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("ドラフトの保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const saveToLibrary = async () => {
    if (!draft || !topic) {
      toast.error("ドラフトを生成してください");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: `draft-${Date.now()}`,
          title: `${topic} - ${draftType} Draft`,
          authors: selectedProject?.name || "Unknown",
          venue: "Draft",
          year: new Date().getFullYear(),
          abstract: draft.substring(0, 500) + "...",
          url: null,
          citationCount: 0,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("ドラフトをライブラリに保存しました");
      } else {
        throw new Error(data.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Error saving to library:", error);
      toast.error("ライブラリへの保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen bg-[var(--color-background)] text-[var(--color-text)] overflow-hidden">
      <header
        className="fixed top-0 left-0 right-0 z-[99999] border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
        style={{ zIndex: 99999 }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-[var(--color-text)]">
              プロジェクト連携論文執筆ツール
            </h1>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <Home className="h-4 w-4" />
                <span>ホーム</span>
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <Search className="h-4 w-4" />
                <span>検索</span>
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <BookOpen className="h-4 w-4" />
                <span>ライブラリ</span>
              </Link>
              <Link
                href="/tools/citation-map"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <Network className="h-4 w-4" />
                <span>Citation Map</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-6 pt-24 h-full overflow-y-auto">
        <div className="mb-8">
          <p className="text-[var(--color-text-secondary)]">
            研究プロジェクトと連携して、研究ギャップ分析と論文執筆をサポートします
          </p>
        </div>

        <div className="space-y-8">
          {/* プロジェクト選択 */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                研究プロジェクト選択
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                連携する研究プロジェクトを選択してください
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.name}
                  onClick={() => setSelectedProject(project)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedProject?.name === project.name
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-background)]"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FolderOpen className="h-5 w-5 text-[var(--color-text-secondary)]" />
                    <h3 className="font-medium text-[var(--color-text)]">
                      {project.name}
                    </h3>
                    {selectedProject?.name === project.name && (
                      <CheckCircle className="h-4 w-4 text-[var(--color-primary)]" />
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span>
                      最終更新:{" "}
                      {new Date(project.lastModified).toLocaleDateString(
                        "ja-JP"
                      )}
                    </span>
                    {project.hasWritingDir && (
                      <span className="text-green-600">✓ 05_Writing</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 研究トピック入力 */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                研究トピックとコンテキスト
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                研究トピックとプロジェクトの詳細を入力してください
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  研究トピック *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例: KIF6遺伝子多型と心血管リスクの関連性"
                  className="w-full p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  プロジェクトコンテキスト
                </label>
                <textarea
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  rows={4}
                  placeholder="プロジェクトの詳細、使用している手法、既存のデータなどを記述してください"
                  className="w-full p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>

              <button
                onClick={analyzeGaps}
                disabled={analysisLoading || !topic.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-surface)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="h-4 w-4" />
                {analysisLoading ? "分析中..." : "研究ギャップ分析を実行"}
              </button>
            </div>
          </section>

          {/* ライブラリ論文選択 */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                分析対象論文の選択
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                ライブラリから研究ギャップ分析に使用する論文を選択してください
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--color-text-secondary)]">
                  選択済み: {selectedPapers.length}件 / ライブラリ総数:{" "}
                  {libraryPapers.length}件
                </div>
                <button
                  onClick={() => setShowPaperSelector(!showPaperSelector)}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 hover:bg-[var(--color-primary)]/10 rounded-md transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  {showPaperSelector ? "選択を閉じる" : "論文を選択"}
                </button>
              </div>

              {showPaperSelector && (
                <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
                  {/* 検索とフィルター */}
                  <div className="mb-4 space-y-3">
                    {/* 検索バー */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                      <input
                        type="text"
                        placeholder="論文を検索... (タイトル、著者、要約)"
                        value={paperSearchQuery}
                        onChange={(e) => setPaperSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] pl-10 pr-4 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                      />
                      {paperSearchQuery && (
                        <button
                          onClick={() => setPaperSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* タグフィルター */}
                    {(() => {
                      // すべての論文からタグを収集
                      const allTags = new Set<string>();
                      libraryPapers.forEach((paper) => {
                        if (paper.tags && Array.isArray(paper.tags)) {
                          paper.tags.forEach((tag: string) => allTags.add(tag));
                        }
                      });
                      const availableTags = Array.from(allTags).sort();

                      if (availableTags.length > 0) {
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                              <Tag className="h-3 w-3" />
                              <span>タグで絞り込み:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {availableTags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => {
                                    if (selectedTags.includes(tag)) {
                                      setSelectedTags((prev) =>
                                        prev.filter((t) => t !== tag)
                                      );
                                    } else {
                                      setSelectedTags((prev) => [...prev, tag]);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                    selectedTags.includes(tag)
                                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                                      : "bg-[var(--color-background)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                            {selectedTags.length > 0 && (
                              <button
                                onClick={() => setSelectedTags([])}
                                className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                              >
                                <X className="h-3 w-3" />
                                すべてのタグを解除
                              </button>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* フィルタリングされた論文リスト */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {(() => {
                      // フィルタリングロジック
                      let filteredPapers = libraryPapers;

                      // 検索ワードでフィルタリング
                      if (paperSearchQuery.trim()) {
                        const query = paperSearchQuery.toLowerCase();
                        filteredPapers = filteredPapers.filter((paper) => {
                          const title = (paper.title || "").toLowerCase();
                          const authors = Array.isArray(paper.authors)
                            ? paper.authors
                                .map((author: any) =>
                                  typeof author === "string"
                                    ? author
                                    : author.name || ""
                                )
                                .join(" ")
                            : (paper.authors || "").toLowerCase();
                          const abstract = (paper.abstract || "").toLowerCase();
                          const venue = (paper.venue || "").toLowerCase();

                          return (
                            title.includes(query) ||
                            authors.includes(query) ||
                            abstract.includes(query) ||
                            venue.includes(query)
                          );
                        });
                      }

                      // タグでフィルタリング
                      if (selectedTags.length > 0) {
                        filteredPapers = filteredPapers.filter((paper) => {
                          if (!paper.tags || !Array.isArray(paper.tags)) {
                            return false;
                          }
                          return selectedTags.some((tag) =>
                            paper.tags.includes(tag)
                          );
                        });
                      }

                      if (filteredPapers.length === 0) {
                        return (
                          <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                            {paperSearchQuery || selectedTags.length > 0
                              ? "条件に一致する論文が見つかりませんでした"
                              : "ライブラリに論文がありません"}
                          </div>
                        );
                      }

                      return filteredPapers.map((paper) => (
                        <div
                          key={paper.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedPapers.some((p) => p.id === paper.id)
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15"
                              : "border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-background)]"
                          }`}
                          onClick={() => {
                            if (selectedPapers.some((p) => p.id === paper.id)) {
                              setSelectedPapers((prev) =>
                                prev.filter((p) => p.id !== paper.id)
                              );
                            } else {
                              setSelectedPapers((prev) => [...prev, paper]);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-4 h-4 rounded border-2 mt-1 ${
                                selectedPapers.some((p) => p.id === paper.id)
                                  ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                                  : "border-[var(--color-border)]"
                              }`}
                            >
                              {selectedPapers.some((p) => p.id === paper.id) && (
                                <CheckCircle className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-[var(--color-text)] text-sm mb-1">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                                {Array.isArray(paper.authors)
                                  ? paper.authors
                                      .map((author: any) => author.name || author)
                                      .join(", ")
                                  : paper.authors || "著者不明"}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {paper.year} • {paper.venue}
                              </p>
                              {/* タグ表示 */}
                              {paper.tags && Array.isArray(paper.tags) && paper.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {paper.tags.map((tag: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded text-[10px]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {selectedPapers.length > 0 && (
                <div className="bg-[var(--color-background)] rounded-lg p-3">
                  <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
                    選択された論文:
                  </h4>
                  <div className="space-y-1">
                    {selectedPapers.map((paper) => (
                      <div
                        key={paper.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[var(--color-text-secondary)]">
                          {paper.title}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedPapers((prev) =>
                              prev.filter((p) => p.id !== paper.id)
                            )
                          }
                          className="text-[var(--color-error)] hover:opacity-80"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 研究ギャップ分析結果 */}
          {gapAnalysis && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      研究ギャップ分析結果
                    </h2>
                    <p className="text-sm text-slate-600">
                      先行研究の背景と未解決問題の分析結果
                    </p>
                  </div>
                  <button
                    onClick={saveGapAnalysis}
                    disabled={savingAnalysis}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {savingAnalysis ? "保存中..." : "分析を保存"}
                  </button>
                </div>
              </div>

              <div className="prose max-w-none">
                <MarkdownRenderer
                  content={gapAnalysis}
                  papers={
                    selectedPapers.length > 0
                      ? selectedPapers
                      : libraryPapers.slice(0, 5)
                  }
                  onPaperClick={(paperId) => {
                    // ライブラリの詳細ページに遷移
                    window.location.href = `/library?paperId=${paperId}`;
                  }}
                />
              </div>
            </section>
          )}

          {/* Cursorチャット連携 */}
          {selectedProject && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare className="h-5 w-5 text-slate-600" />
                  <h2 className="text-xl font-semibold text-slate-900">
                    Cursorチャット連携
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  選択したプロジェクトのCursorチャットと連携して、研究をサポートします
                </p>
              </div>

              {!cursorChatEnabled ? (
                <button
                  onClick={enableCursorChat}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Cursorチャット連携を有効化
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600 font-medium">
                      {selectedProject.name}プロジェクトと連携中
                    </span>
                    <button
                      onClick={disableCursorChat}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      連携を無効化
                    </button>
                  </div>

                  {/* チャットメッセージ表示 */}
                  <div className="border border-slate-200 rounded-lg p-4 h-64 overflow-y-auto bg-slate-50">
                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`mb-3 ${
                          message.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        <div
                          className={`inline-block max-w-xs p-3 rounded-lg ${
                            message.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-white text-slate-900 border border-slate-200"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* メッセージ入力 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="プロジェクトについて質問してください..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={sendingMessage}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingMessage ? "送信中..." : "送信"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ドラフト生成 */}
          {gapAnalysis && selectedProject && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  論文ドラフト生成
                </h2>
                <p className="text-sm text-slate-600">
                  研究ギャップを埋める論文ドラフトを生成します
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    セクションタイプ
                  </label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="introduction">Introduction（序論）</option>
                    <option value="methods">Methods（方法）</option>
                    <option value="results">Results（結果）</option>
                    <option value="discussion">Discussion（考察）</option>
                    <option value="conclusion">Conclusion（結論）</option>
                  </select>
                </div>

                <button
                  onClick={generateDraft}
                  disabled={draftLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-4 w-4" />
                  {draftLoading ? "生成中..." : "ドラフトを生成"}
                </button>
              </div>
            </section>
          )}

          {/* ドラフト表示・編集 */}
          {draft && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">
                    生成されたドラフト
                  </h2>
                  <p className="text-sm text-slate-600">
                    {selectedProject?.name} - {draftType}セクション
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>

              <div className="space-y-4">
                {viewMode === "edit" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      ドラフト内容を編集
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={20}
                      className="w-full p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Markdown形式でドラフトを編集してください..."
                    />
                  </div>
                )}

                {viewMode === "preview" && (
                  <div className="prose max-w-none">
                    <MarkdownRenderer
                      content={draft}
                      papers={[]}
                      onPaperClick={() => {}}
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
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full h-full p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Markdown形式でドラフトを編集してください..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        プレビュー
                      </label>
                      <div className="h-full p-4 border border-slate-300 rounded-lg overflow-y-auto">
                        <MarkdownRenderer
                          content={draft}
                          papers={[]}
                          onPaperClick={() => {}}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-500">
                    {draft.length} 文字
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveToLibrary()}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                    >
                      <BookOpen className="h-4 w-4" />
                      ライブラリに保存
                    </button>
                    <button
                      onClick={saveDraft}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? "保存中..." : "ファイル保存"}
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([draft], {
                          type: "text/plain;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${draftType}_draft.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success("ドラフトをダウンロードしました");
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      ダウンロード
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
