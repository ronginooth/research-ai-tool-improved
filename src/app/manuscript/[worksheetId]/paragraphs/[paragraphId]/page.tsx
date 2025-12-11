"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Edit, BookOpen, CheckSquare, Square, X } from "lucide-react";
import Header from "@/components/layout/Header";
import {
  generateFieldCode,
  insertFieldCode,
  extractFieldCodes,
  renderParagraphContent,
  renderCitationField,
  getInTextFormatForStyle,
  type CitationFieldCode,
} from "@/lib/manuscript/citation-field";
import {
  getStyleById,
  getDefaultStyle,
} from "@/lib/manuscript/citation-styles";
import { CitationSorter } from "@/lib/manuscript/citation-engine/Sorter";
import { PaperData } from "@/lib/manuscript/citation-engine/ReferenceRenderer";
import { Paper } from "@/types";

const DEFAULT_USER = "demo-user-123";

interface Paragraph {
  id: string;
  paragraph_number: string;
  section_type: string;
  title: string;
  description: string;
  content: string;
  status: string;
  word_count: number;
  worksheet_id: string;
  japanese_translation?: string;
}

interface Citation {
  id: string;
  paper_id: string;
  citation_context: string;
  citation_order: number;
  paper: {
    id: string;
    title: string;
    authors: string;
    year: number;
    venue: string;
    abstract: string;
    url: string;
  };
}

export default function ParagraphDetailPage() {
  const params = useParams();
  const router = useRouter();
  const worksheetId = params.worksheetId as string;
  const paragraphId = params.paragraphId as string;

  const [paragraph, setParagraph] = useState<Paragraph | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCitationSearch, setShowCitationSearch] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [venueFilter, setVenueFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [savedPaperIds, setSavedPaperIds] = useState<Set<string>>(new Set());
  const [searchDetails, setSearchDetails] = useState<any>(null);
  const [showSearchDetails, setShowSearchDetails] = useState<boolean>(false);
  const [minCitations, setMinCitations] = useState<string>("");
  const [sortByCitations, setSortByCitations] = useState<boolean>(false);
  const [allParagraphs, setAllParagraphs] = useState<Paragraph[]>([]);
  const [viewMode, setViewMode] = useState<"edit" | "document">("edit");
  const [allCitations, setAllCitations] = useState<any[]>([]);
  const [citationFormat, setCitationFormat] = useState<string>("nature");
  const [citationOrder, setCitationOrder] = useState<
    "alphabetical" | "appearance"
  >("alphabetical");
  const [japaneseTranslation, setJapaneseTranslation] = useState<string>("");
  const [translating, setTranslating] = useState(false);
  const [translatingToEnglish, setTranslatingToEnglish] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );
  const [includeExistingContent, setIncludeExistingContent] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showSearchConfirmDialog, setShowSearchConfirmDialog] = useState(false);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState<boolean>(false);

  useEffect(() => {
    if (paragraphId) {
      fetchParagraph();
      fetchCitations();
      fetchAvailableTags();
      fetchSavedPaperIds();
      fetchAllParagraphs();
    }
  }, [paragraphId, worksheetId]);

  const fetchAllParagraphs = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs?worksheetId=${worksheetId}&userId=${DEFAULT_USER}`
      );
      if (response.ok) {
        const data = await response.json();
        setAllParagraphs(data.paragraphs || []);
        // デバッグ: methodsセクションのパラグラフのタイトルを確認
        const methodsParagraphs = (data.paragraphs || []).filter(
          (p: Paragraph) => p.section_type === "methods"
        );
        if (methodsParagraphs.length > 0) {
          console.log(
            "[Document View] Methods paragraphs with titles:",
            methodsParagraphs.map((p: Paragraph) => ({
              id: p.id,
              paragraph_number: p.paragraph_number,
              title: p.title,
              hasTitle: !!p.title && p.title.trim().length > 0,
              contentPreview: p.content?.substring(0, 50),
            }))
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch all paragraphs:", error);
    }
  };

  // 前後のパラグラフを取得する関数
  const getAdjacentParagraphs = () => {
    if (!paragraph || allParagraphs.length === 0) {
      return { prev: null, next: null };
    }

    // パラグラフ番号でソート
    const sortedParagraphs = [...allParagraphs].sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
      return numA - numB;
    });

    const currentIndex = sortedParagraphs.findIndex(
      (p) => p.id === paragraph.id
    );

    if (currentIndex === -1) {
      return { prev: null, next: null };
    }

    return {
      prev: currentIndex > 0 ? sortedParagraphs[currentIndex - 1] : null,
      next:
        currentIndex < sortedParagraphs.length - 1
          ? sortedParagraphs[currentIndex + 1]
          : null,
    };
  };

  const fetchSavedPaperIds = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/citations/search?userId=${DEFAULT_USER}`
      );
      if (response.ok) {
        const data = await response.json();
        const ids = new Set<string>((data.papers || []).map((p: Paper) => p.id));
        // 既存のsavedPaperIdsとマージ（上書きしない）
        setSavedPaperIds((prev) => new Set<string>([...prev, ...ids]));
      }
    } catch (error) {
      console.error("Failed to fetch saved paper IDs:", error);
    }
  };

  const fetchParagraph = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}?userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      setParagraph(data.paragraph);
      // 日本語訳があれば表示
      if (data.paragraph.japanese_translation) {
        setJapaneseTranslation(data.paragraph.japanese_translation);
      }
    } catch (error) {
      console.error("Failed to fetch paragraph:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCitations = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}/citations?userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      setCitations(data.citations || []);
    } catch (error) {
      console.error("Failed to fetch citations:", error);
    }
  };

  const fetchAllCitations = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/worksheets/${worksheetId}/citations?userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      setAllCitations(data.citations || []);
    } catch (error) {
      console.error("Failed to fetch all citations:", error);
    }
  };

  const handleSave = async () => {
    if (!paragraph) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: DEFAULT_USER,
            title: paragraph.title,
            content: paragraph.content,
            description: paragraph.description,
            status: paragraph.content ? "in_progress" : "pending",
            japanese_translation: japaneseTranslation || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("保存に失敗しました");
      }

      const data = await response.json();
      setParagraph(data.paragraph);
      setEditingTitle(false);
      setEditingDescription(false);
      // パラグラフ一覧を更新
      await fetchAllParagraphs();
      alert("保存しました");
    } catch (error) {
      console.error("Save error:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 英語→日本語翻訳
  const handleTranslateToJapanese = async () => {
    if (!paragraph?.content || !paragraph.content.trim()) {
      alert("翻訳する内容がありません");
      return;
    }

    setTranslating(true);
    try {
      const response = await fetch("/api/manuscript/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: paragraph.content,
          targetLanguage: "ja",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "翻訳に失敗しました");
      }

      const translatedText = data.translatedText;
      setJapaneseTranslation(translatedText);

      // 日本語訳を自動保存
      if (paragraph) {
        try {
          await fetch(`/api/manuscript/paragraphs/${paragraphId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: DEFAULT_USER,
              japanese_translation: translatedText,
            }),
          });
        } catch (saveError) {
          console.error("Failed to save translation:", saveError);
          // 保存エラーは警告のみ（翻訳は表示されている）
        }
      }
    } catch (error: any) {
      console.error("Translation error:", error);
      alert(error?.message || "翻訳に失敗しました");
    } finally {
      setTranslating(false);
    }
  };

  // 日本語→英語翻訳
  const handleTranslateToEnglish = async () => {
    if (!paragraph?.content || !paragraph.content.trim()) {
      alert("翻訳する内容がありません");
      return;
    }

    setTranslatingToEnglish(true);
    try {
      const response = await fetch("/api/manuscript/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: paragraph.content,
          targetLanguage: "en",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "翻訳に失敗しました");
      }

      // 翻訳結果をパラグラフ内容に設定
      setParagraph((prev) =>
        prev ? { ...prev, content: data.translatedText } : null
      );
      alert("英語に翻訳しました");
    } catch (error: any) {
      console.error("Translation error:", error);
      alert(error?.message || "翻訳に失敗しました");
    } finally {
      setTranslatingToEnglish(false);
    }
  };

  const handleGenerate = async () => {
    // AI生成前に現在のcontentを保存
    if (paragraph?.content) {
      setPreviousContent(paragraph.content);
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: DEFAULT_USER,
            includeExistingContent: includeExistingContent,
            citationStyle: "apa",
            language: "en",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "生成に失敗しました");
      }

      setParagraph((prev) =>
        prev ? { ...prev, content: data.content } : null
      );
      // パラグラフ一覧を更新
      await fetchAllParagraphs();
      alert("文章を生成しました");
    } catch (error: any) {
      console.error("Generate error:", error);
      const errorMessage =
        error?.message || error?.error || "生成に失敗しました";
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  // 元に戻す関数
  const handleRevert = () => {
    if (previousContent !== null && paragraph) {
      setParagraph((prev) =>
        prev ? { ...prev, content: previousContent } : null
      );
      setPreviousContent(null);
      alert("元の内容に戻しました");
    }
  };

  const handleAddCitation = async (paperIdOrPaper: string | Paper) => {
    try {
      let paperId: string;
      let paper: Paper | null = null; // paper変数を関数スコープで定義

      // 論文オブジェクトが渡された場合（Web検索結果など）
      if (typeof paperIdOrPaper === "object") {
        paper = paperIdOrPaper;
        console.log("[Add Citation] Processing paper:", paper);

        // paper.idがUUID形式（user_library.id）の場合は、既にlibraryに存在する論文と判断
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUUID = paper.id && uuidPattern.test(paper.id);

        if (isUUID) {
          // UUID形式のIDの場合は、既にlibraryに存在する論文として扱う
          console.log(
            "[Add Citation] Paper ID is UUID format, using existing library paper:",
            paper.id
          );
          paperId = paper.id;

          // savedPaperIdsに追加（次回のチェック用）
          setSavedPaperIds((prev) => new Set([...prev, paperId]));
        } else {
          // UUID形式でない場合は、既存のチェックロジックを実行
          const paperIdForCheck =
            paper.id || (paper as any).paperId || `web-${Date.now()}`;
          const isAlreadySaved = savedPaperIds.has(paper.id || paperIdForCheck);

          if (isAlreadySaved) {
            // 既に保存されている場合は、検索して既存のUUIDを取得
            console.log(
              "[Add Citation] Paper already saved, searching for existing UUID"
            );
            const searchResponse = await fetch(
              `/api/manuscript/citations/search?userId=${DEFAULT_USER}&query=${encodeURIComponent(
                paper.title
              )}`
            );

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              // タイトルで既存の論文を検索
              const existingPaper = searchData.papers?.find((p: Paper) => {
                if (!paper) return false;
                const titleMatch =
                  p.title === paper.title ||
                  (p.title &&
                    paper.title &&
                    p.title.toLowerCase() === paper.title.toLowerCase());
                // 著者と年も一致する場合はより確実
                const authorMatch =
                  !paper.authors || !p.authors || p.authors === paper.authors;
                const yearMatch =
                  !paper.year || !p.year || p.year === paper.year;
                return titleMatch && authorMatch && yearMatch;
              });

              if (existingPaper && existingPaper.id) {
                // 検索APIが返すidはuser_library.id（UUID）
                paperId = existingPaper.id;
                console.log(
                  "[Add Citation] Found existing paper ID (UUID) from search:",
                  paperId
                );
              } else {
                // 見つからない場合は、Library APIで既存の論文を確認
                if (!paper) {
                  throw new Error("Paper data is missing");
                }
                console.log(
                  "[Add Citation] Not found in search, checking via Library API"
                );
                const checkResponse = await fetch("/api/library", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    userId: DEFAULT_USER,
                    paper: {
                      paperId: paperIdForCheck,
                      title: paper.title,
                      authors: paper.authors,
                      year: paper.year,
                      abstract: (paper as any).abstract || "",
                      url: paper.url || "",
                      citationCount: paper.citationCount || 0,
                      venue: paper.venue || "",
                    },
                  }),
                });

                if (!checkResponse.ok) {
                  const errorData = await checkResponse.json();
                  if (errorData.paper && errorData.paper.id) {
                    paperId = errorData.paper.id;
                    console.log(
                      "[Add Citation] Found existing paper ID (UUID) from API error response:",
                      paperId
                    );
                  } else {
                    throw new Error("既存の論文のID取得に失敗しました");
                  }
                } else {
                  const checkData = await checkResponse.json();
                  paperId = checkData.paper?.id;
                  if (!paperId) {
                    throw new Error("既存の論文のID取得に失敗しました");
                  }
                  console.log(
                    "[Add Citation] Found existing paper ID (UUID) from API:",
                    paperId
                  );
                }
              }
            } else {
              throw new Error("既存の論文の検索に失敗しました");
            }
          } else {
            // 保存されていない場合は、Libraryに保存
            if (!paper) {
              throw new Error("Paper data is missing");
            }
            console.log("[Add Citation] Paper not saved, saving to library");
            const saveResponse = await fetch("/api/library", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: DEFAULT_USER,
                paper: {
                  paperId: paperIdForCheck,
                  title: paper.title,
                  authors: paper.authors,
                  year: paper.year,
                  abstract: paper.abstract || "",
                  url: paper.url || "",
                  citationCount: paper.citationCount || 0,
                  venue: paper.venue || "",
                },
              }),
            });

            if (!saveResponse.ok) {
              const errorData = await saveResponse.json();
              console.log("[Add Citation] Save response error:", errorData);

              // 既に保存されている場合はそのまま続行
              if (
                errorData.error?.includes("既に") ||
                errorData.error?.includes("保存されています") ||
                errorData.existing
              ) {
                // Library APIが既存の論文情報を返している場合
                if (errorData.paper && errorData.paper.id) {
                  paperId = errorData.paper.id; // user_library.id（UUID）
                  console.log(
                    "[Add Citation] Found existing paper ID (UUID) from API:",
                    paperId
                  );
                } else {
                  // 既存の論文を検索してuser_library.id（UUID）を取得
                  if (!paper) {
                    throw new Error("Paper data is missing");
                  }
                  const searchResponse = await fetch(
                    `/api/manuscript/citations/search?userId=${DEFAULT_USER}&query=${encodeURIComponent(
                      paper.title
                    )}`
                  );
                  if (searchResponse.ok) {
                    if (!paper) {
                      throw new Error("Paper data is missing");
                    }
                    const searchData = await searchResponse.json();
                    const existingPaper = searchData.papers?.find(
                      (p: Paper) =>
                        p.title === paper.title ||
                        (p.title &&
                          paper.title &&
                          p.title.toLowerCase() === paper.title.toLowerCase())
                    );
                    if (existingPaper && existingPaper.id) {
                      paperId = existingPaper.id;
                      console.log(
                        "[Add Citation] Found existing paper ID (UUID) from search:",
                        paperId
                      );
                    } else {
                      throw new Error(
                        "既存の論文が見つかりませんでした。再度保存してください。"
                      );
                    }
                  } else {
                    throw new Error("既存の論文の検索に失敗しました");
                  }
                }
              } else {
                throw new Error(errorData.error || "論文の保存に失敗しました");
              }
            } else {
              const saveData = await saveResponse.json();
              console.log("[Add Citation] Save response data:", saveData);
              const savedPaper = saveData.paper || saveData;
              paperId = savedPaper?.id;

              if (!paperId) {
                throw new Error("論文を保存しましたが、IDの取得に失敗しました");
              }

              console.log("[Add Citation] Saved paper ID (UUID):", paperId);
              // 保存済みIDを更新
              setSavedPaperIds((prev) => new Set([...prev, paperId]));
            }
          }
        }
      } else {
        // 文字列IDが渡された場合（既にLibraryに保存されている論文）
        paperId = paperIdOrPaper;

        // UUID形式かどうかをチェック（UUIDは36文字でハイフンを含む）
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(paperId)) {
          // UUID形式でない場合、user_libraryテーブルからUUIDを取得
          console.log(
            "[Add Citation] paperId is not UUID format, searching for UUID:",
            paperId
          );
          const searchResponse = await fetch(
            `/api/manuscript/citations/search?userId=${DEFAULT_USER}&query=${encodeURIComponent(
              paperId
            )}`
          );
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            // paper_idで検索するか、IDで直接検索
            const foundPaper = searchData.papers?.find(
              (p: Paper) => p.id === paperId || (p as any).paper_id === paperId
            );
            if (
              foundPaper &&
              foundPaper.id &&
              uuidPattern.test(foundPaper.id)
            ) {
              paperId = foundPaper.id;
              console.log("[Add Citation] Found UUID:", paperId);
            } else {
              throw new Error(
                `論文ID "${paperId}" に対応するUUIDが見つかりませんでした。`
              );
            }
          } else {
            throw new Error("論文の検索に失敗しました");
          }
        }
      }

      console.log(
        "[Add Citation] Adding citation with paperId (UUID):",
        paperId
      );

      // UUID形式の最終確認
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(paperId)) {
        throw new Error(
          `無効なUUID形式です: "${paperId}"。user_libraryテーブルのid（UUID）が必要です。`
        );
      }

      // 引用に追加
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}/citations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: DEFAULT_USER,
            paperId,
            citationContext: "",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Add Citation] Citation add error:", errorData);
        throw new Error(errorData.error || "引用の追加に失敗しました");
      }

      const citationData = await response.json();

      // 引用追加後に、追加した論文のIDをsavedPaperIdsに確実に追加
      const addedPaperId =
        citationData.citation?.paper?.id ||
        citationData.citation?.paper_id ||
        paperId;
      if (addedPaperId) {
        console.log(
          "[Add Citation] Adding paper ID to savedPaperIds:",
          addedPaperId
        );
        setSavedPaperIds((prev) => {
          const updated = new Set([...prev, addedPaperId]);
          console.log(
            "[Add Citation] Updated savedPaperIds:",
            Array.from(updated)
          );
          return updated;
        });
      }

      await fetchCitations();
      // fetchSavedPaperIdsは既存のIDとマージするように修正済み
      await fetchSavedPaperIds(); // 保存済みIDを更新（念のため）

      // フィールドコードを生成してパラグラフ内容に挿入
      if (citationData.citation && paragraph) {
        const citationId = citationData.citation.id;

        // 論文情報を取得（paper変数が利用可能な場合、またはcitationDataから取得）
        let paperInfo: {
          authors?: string;
          year?: number;
          title?: string;
        } | null = null;
        if (paper) {
          paperInfo = paper;
        } else if (citationData.citation.paper) {
          paperInfo = citationData.citation.paper;
        }

        const displayText = paperInfo?.authors
          ? `(${paperInfo.authors.split(",")[0]?.trim() || "Author"}, ${
              paperInfo.year || ""
            })`
          : `(${paperInfo?.title?.substring(0, 30) || "Citation"}...)`;

        const fieldCode = generateFieldCode(citationId, paperId, displayText);

        // パラグラフ内容の末尾にフィールドコードを挿入
        const currentContent = paragraph.content || "";
        const newContent = currentContent
          ? `${currentContent} ${fieldCode}`
          : fieldCode;

        setParagraph((prev) =>
          prev ? { ...prev, content: newContent } : null
        );
      }

      // 引用追加後も検索結果を保持して、保存済み表示を更新できるようにする
      // setShowCitationSearch(false);
      // setSearchQuery("");
      // setSearchResults([]);
      setSelectedCandidates(new Set());

      // 検索結果の保存済み状態を更新するため、検索結果を再レンダリング
      // savedPaperIdsが更新されたので、検索結果の表示も自動的に更新される
    } catch (error: any) {
      console.error("[Add Citation] Error:", error);
      alert(error?.message || "引用論文の追加に失敗しました");
    }
  };

  // 複数の引用候補をまとめて追加
  const handleAddMultipleCitations = async () => {
    if (selectedCandidates.size === 0) {
      alert("引用に追加する論文を選択してください");
      return;
    }

    try {
      const selectedPapers = searchResults.filter((paper, index) => {
        const paperId = paper.id || `web-${index}-${Date.now()}`;
        return selectedCandidates.has(paperId);
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const paper of selectedPapers) {
        try {
          await handleAddCitation(paper);
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(
            `${paper.title}: ${error?.message || "追加に失敗しました"}`
          );
        }
      }

      // 選択をクリア
      setSelectedCandidates(new Set());

      // 結果を表示
      if (errorCount === 0) {
        alert(`${successCount}件の引用論文を追加しました`);
      } else {
        alert(
          `${successCount}件の引用論文を追加しました。\n${errorCount}件の追加に失敗しました:\n${errors.join(
            "\n"
          )}`
        );
      }
    } catch (error: any) {
      console.error("[Add Multiple Citations] Error:", error);
      alert(error?.message || "引用論文の一括追加に失敗しました");
    }
  };

  // 引用候補の選択をトグル
  const handleToggleCandidateSelection = (paperId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  };

  // すべての引用候補を選択/解除
  const handleSelectAllCandidates = () => {
    if (selectedCandidates.size === searchResults.length) {
      setSelectedCandidates(new Set());
    } else {
      const allIds = new Set(
        searchResults.map(
          (paper, index) => paper.id || `web-${index}-${Date.now()}`
        )
      );
      setSelectedCandidates(allIds);
    }
  };

  const handleRemoveCitation = async (citationId: string) => {
    // 削除する引用論文の情報を取得
    const citationToRemove = citations.find((c) => c.id === citationId);
    const paperTitle = citationToRemove?.paper?.title || "この引用論文";

    if (!confirm(`${paperTitle}\n\nこの引用論文を削除しますか？`)) return;

    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${paragraphId}/citations/${citationId}?userId=${DEFAULT_USER}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "削除に失敗しました");
      }

      await fetchCitations();

      // 成功メッセージ（オプション）
      // alert("引用論文を削除しました");
    } catch (error: any) {
      console.error("Remove citation error:", error);
      alert(error?.message || "引用論文の削除に失敗しました");
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await fetch(`/api/library/tags?userId=${DEFAULT_USER}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      if (useWebSearch) {
        // 引用論文検索: Semantic ScholarとPubMedの両方で検索
        // 検索クエリを生成（引用論文として適切な論文を見つけるためのクエリ最適化）
        let searchQueryText = "";

        // 優先順位: 検索窓の入力 > トピックセンテンス > タイトル
        if (searchQuery.trim()) {
          searchQueryText = searchQuery.trim();
        } else if (paragraph?.description) {
          searchQueryText = paragraph.description;
        } else if (paragraph?.title) {
          searchQueryText = paragraph.title;
        }

        // 検索クエリが空の場合はエラー
        if (!searchQueryText || searchQueryText.trim().length === 0) {
          alert(
            "検索クエリを入力するか、トピックセンテンスを設定してください。"
          );
          return;
        }

        console.log("[Citation Search] Using query:", searchQueryText);
        console.log("[Citation Search] Paragraph info:", {
          title: paragraph?.title,
          description: paragraph?.description,
          searchQuery: searchQuery,
        });

        // 高度な検索モードの場合は/api/ai-searchを使用
        const endpoint = useAdvancedSearch
          ? "/api/ai-search"
          : "/api/search-simple";
        const requestBody = useAdvancedSearch
          ? {
              topic: searchQueryText,
              maxPapers: 20, // フィルター前により多くの論文を取得
              sources: ["semantic_scholar", "pubmed"], // Semantic ScholarとPubMedの両方で検索
              provider: "gemini",
            }
          : {
              query: searchQueryText,
              limit: 20, // フィルター前により多くの論文を取得
              sources: ["semantic_scholar", "pubmed"], // Semantic ScholarとPubMedの両方で検索
            };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error("Web検索に失敗しました");
        }

        const data = await response.json();
        console.log("[Citation Search] Search response:", data);

        // 検索詳細情報を保存
        setSearchDetails({
          query: searchQueryText,
          paragraphTitle: paragraph?.title,
          paragraphDescription: paragraph?.description,
          searchLogic: data.searchLogic,
          sourceStats: data.sourceStats,
          totalFound: data.total,
        });

        // 検索結果を処理
        let papers = data.papers || [];

        // 年フィルター適用
        if (yearFilter) {
          const year = parseInt(yearFilter);
          papers = papers.filter((p: Paper) => p.year === year);
        }

        // ジャーナルフィルター適用
        if (venueFilter) {
          const filterLower = venueFilter.toLowerCase();
          papers = papers.filter((p: Paper) =>
            p.venue?.toLowerCase().includes(filterLower)
          );
        }

        // 被引用数フィルター適用
        if (minCitations) {
          const min = parseInt(minCitations);
          papers = papers.filter((p: Paper) => (p.citationCount || 0) >= min);
        }

        // 被引用数でソート
        if (sortByCitations) {
          papers = papers.sort(
            (a: Paper, b: Paper) =>
              (b.citationCount || 0) - (a.citationCount || 0)
          );
        }

        // 最大10件に制限
        papers = papers.slice(0, 10);

        // 既に引用に追加されている論文を除外
        const citedPaperIds = new Set(
          citations
            .map((citation) => citation.paper?.id || citation.paper_id)
            .filter(Boolean)
        );
        papers = papers.filter((p: Paper) => !citedPaperIds.has(p.id));

        setSearchResults(papers);
        // 保存済み論文IDを更新
        await fetchSavedPaperIds();
      } else {
        // 通常のライブラリ検索
        const params = new URLSearchParams({
          userId: DEFAULT_USER,
        });

        if (searchQuery.trim()) {
          params.append("query", searchQuery);
        }
        if (yearFilter) {
          params.append("year", yearFilter);
        }
        if (venueFilter) {
          params.append("venue", venueFilter);
        }
        if (selectedTags.length > 0) {
          params.append("tags", selectedTags.join(","));
        }
        if (dateFrom) {
          params.append("dateFrom", dateFrom);
        }
        if (dateTo) {
          params.append("dateTo", dateTo);
        }

        const response = await fetch(
          `/api/manuscript/citations/search?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error("検索に失敗しました");
        }

        const data = await response.json();
        const allLibraryPapers = data.papers || [];

        // library検索結果のIDをsavedPaperIdsに追加（重複保存を防ぐため）
        // フィルタリング前の全論文のIDを追加する
        const libraryPaperIds = new Set(
          allLibraryPapers
            .map((p: Paper) => p.id)
            .filter((id: string | undefined): id is string => !!id)
        );
        setSavedPaperIds((prev) => new Set([...prev, ...libraryPaperIds]));

        // 既に引用に追加されている論文を除外
        const citedPaperIds = new Set(
          citations
            .map((citation) => citation.paper?.id || citation.paper_id)
            .filter(Boolean)
        );
        const libraryPapers = allLibraryPapers.filter(
          (p: Paper) => !citedPaperIds.has(p.id)
        );

        setSearchResults(libraryPapers);
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveToLibrary = async (paper: Paper) => {
    try {
      // リンク情報を準備
      const linkedFrom = {
        type: "manuscript",
        worksheetId: worksheetId as string,
        paragraphId: paragraphId as string,
      };

      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEFAULT_USER,
          paper: {
            paperId: paper.id || `web-${Date.now()}`,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            abstract: paper.abstract || "",
            url: paper.url || "",
            citationCount: paper.citationCount || 0,
            venue: paper.venue || "",
          },
          linkedFrom: linkedFrom,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // 既に保存されている場合は成功として扱う
        if (errorData.error?.includes("既に") || errorData.existing) {
          const paperId =
            errorData.paper?.id ||
            errorData.paper?.paper_id ||
            paper.id ||
            `web-${Date.now()}`;
          setSavedPaperIds((prev) => new Set([...prev, paperId]));

          // 個別ページへのリンクを表示
          const libraryId =
            errorData.paper?.id || errorData.paper?.paper_id || paper.id;
          if (libraryId) {
            const goToLibrary = confirm(
              "この論文は既にMy Libraryに保存されています。\n個別ページを開きますか？"
            );
            if (goToLibrary) {
              window.open(`/library?paperId=${libraryId}`, "_blank");
            }
          } else {
            alert("この論文は既にMy Libraryに保存されています");
          }
          return;
        }
        throw new Error(errorData.error || "保存に失敗しました");
      }

      const data = await response.json();
      const savedPaperId = data.paper?.id || data.paper?.paper_id || paper.id;
      if (savedPaperId) {
        setSavedPaperIds((prev) => new Set([...prev, savedPaperId]));
      }

      // 個別ページへのリンクを表示
      const libraryId = data.paper?.id || data.paper?.paper_id || savedPaperId;
      if (libraryId) {
        const goToLibrary = confirm(
          "My Libraryに保存しました。\n個別ページを開きますか？"
        );
        if (goToLibrary) {
          window.open(`/library?paperId=${libraryId}`, "_blank");
        }
      } else {
        alert("My Libraryに保存しました");
      }
    } catch (error: any) {
      console.error("Save to library error:", error);
      alert(error?.message || "保存に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[var(--color-text)]">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!paragraph) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[var(--color-text)]">
          パラグラフが見つかりません
        </div>
      </div>
    );
  }

  // パラグラフを番号順にソート
  const sortedParagraphs = [...allParagraphs].sort((a, b) => {
    const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
    const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
    return numA - numB;
  });

  return (
    <div className="h-screen bg-[var(--color-background)] flex flex-col overflow-hidden">
      {/* 全画面レイアウト: 左側パラグラフ一覧、中央エディタ、右側引用論文 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側: パラグラフ一覧 */}
        <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <button
              onClick={() => router.push(`/manuscript/${worksheetId}`)}
              className="text-sm text-[var(--color-primary)] hover:underline mb-2"
            >
              ← 一覧に戻る
            </button>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              パラグラフ一覧
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sortedParagraphs.map((p) => (
              <Link
                key={p.id}
                href={`/manuscript/${worksheetId}/paragraphs/${p.id}`}
                className={`block p-3 mb-2 rounded-lg border transition-colors ${
                  p.id === paragraphId
                    ? "bg-[var(--color-primary)] text-[var(--color-surface)] border-[var(--color-primary)]"
                    : "bg-[var(--color-background)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                }`}
              >
                <div className="text-sm font-semibold mb-1">
                  {p.paragraph_number}
                </div>
                <div className="text-xs line-clamp-2">
                  {p.title || "タイトル未設定"}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 中央: メインエディタ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto">
            <div className="mb-6">
              {/* 前後のパラグラフナビゲーション */}
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-4">
                  {(() => {
                    const { prev, next } = getAdjacentParagraphs();
                    return (
                      <>
                        {prev ? (
                          <Link
                            href={`/manuscript/${worksheetId}/paragraphs/${prev.id}`}
                            className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
                          >
                            ← {prev.paragraph_number}: {prev.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            ← 前のパラグラフなし
                          </span>
                        )}
                        {next ? (
                          <Link
                            href={`/manuscript/${worksheetId}/paragraphs/${next.id}`}
                            className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
                          >
                            {next.paragraph_number}: {next.title} →
                          </Link>
                        ) : (
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            次のパラグラフなし →
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {/* タイトル編集 */}
              <div className="mb-4">
                {editingTitle ? (
                  <div className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={paragraph.title || ""}
                      onChange={(e) =>
                        setParagraph((prev) =>
                          prev ? { ...prev, title: e.target.value } : null
                        )
                      }
                      className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] text-2xl font-bold placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      placeholder="タイトルを入力してください..."
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[var(--color-primary)] text-[var(--color-surface)] px-3 py-1 rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingTitle(false);
                          // 元の値に戻す
                          fetchParagraph();
                        }}
                        className="bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)] px-3 py-1 rounded text-sm hover:bg-[var(--color-surface)]"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <h1 className="text-2xl font-bold text-[var(--color-text)] flex-1">
                      {paragraph.paragraph_number}:{" "}
                      {paragraph.title || "タイトル未設定"}
                    </h1>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="text-[var(--color-primary)] hover:opacity-80 text-sm px-2 py-1 border border-[var(--color-primary)] rounded hover:bg-[var(--color-background)]"
                    >
                      タイトル編集
                    </button>
                  </div>
                )}
              </div>
              {/* 段落の意味合い・役割（description）編集 */}
              <div className="mt-2">
                {editingDescription ? (
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={paragraph.description || ""}
                      onChange={(e) =>
                        setParagraph((prev) =>
                          prev ? { ...prev, description: e.target.value } : null
                        )
                      }
                      className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      placeholder="段落の意味合い・役割を一般化した記述を入力してください..."
                      rows={3}
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[var(--color-primary)] text-[var(--color-surface)] px-3 py-1 rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingDescription(false);
                          // 元の値に戻す
                          fetchParagraph();
                        }}
                        className="bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)] px-3 py-1 rounded text-sm hover:bg-[var(--color-surface)]"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                        段落の意味合い・役割（AI生成時に利用されます）
                      </p>
                      <p className="text-[var(--color-text-secondary)]">
                        {paragraph.description ||
                          "段落の意味合い・役割が設定されていません"}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingDescription(true)}
                      className="text-[var(--color-primary)] hover:opacity-80 text-sm px-2 py-1 border border-[var(--color-primary)] rounded hover:bg-[var(--color-background)]"
                    >
                      編集
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ビューモード切り替えタブ */}
            <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
              <button
                onClick={() => setViewMode("edit")}
                className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                  viewMode === "edit"
                    ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                <Edit className="h-4 w-4" />
                編集
              </button>
              <button
                onClick={() => setViewMode("document")}
                className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                  viewMode === "document"
                    ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                <FileText className="h-4 w-4" />
                論文ビュー
              </button>
            </div>

            {viewMode === "edit" ? (
              <div className="flex-1">
                <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      パラグラフ内容
                    </h2>
                    <div className="flex gap-2 items-center">
                      {paragraph?.content &&
                        paragraph.content.trim().length > 0 && (
                          <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeExistingContent}
                              onChange={(e) =>
                                setIncludeExistingContent(e.target.checked)
                              }
                              className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-[var(--color-primary)]"
                            />
                            <span className="text-xs">
                              既存の内容を参考にする
                            </span>
                          </label>
                        )}
                      <button
                        onClick={handleTranslateToEnglish}
                        disabled={translatingToEnglish || !paragraph?.content}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="日本語の内容を英語に翻訳します"
                      >
                        {translatingToEnglish ? "翻訳中..." : "日本語→英語"}
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          citations.length === 0
                            ? "引用論文がなくても、トピックセンテンスから生成できます"
                            : ""
                        }
                      >
                        {generating ? "生成中..." : "AI生成"}
                      </button>
                      {previousContent !== null && (
                        <button
                          onClick={handleRevert}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="AI生成前の内容に戻します"
                        >
                          元に戻す
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[var(--color-primary)] text-[var(--color-surface)] px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={paragraph.content || ""}
                    onChange={(e) =>
                      setParagraph((prev) =>
                        prev ? { ...prev, content: e.target.value } : null
                      )
                    }
                    onMouseUp={(e) => {
                      const textarea = e.currentTarget;
                      const selected = textarea.value
                        .substring(
                          textarea.selectionStart,
                          textarea.selectionEnd
                        )
                        .trim();

                      // 選択されたテキストが2文字以上の場合、検索語として使うか確認
                      if (selected.length >= 2) {
                        setSelectedText(selected);
                        setShowSearchConfirmDialog(true);
                      }
                    }}
                    className="w-full h-96 p-4 border border-[var(--color-border)] rounded-lg font-mono text-sm bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="パラグラフの内容を入力してください..."
                  />

                  <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    文字数: {paragraph.content?.length || 0} / 単語数:{" "}
                    {paragraph.word_count || 0}
                  </div>

                  {/* テキスト選択時の検索確認ダイアログ */}
                  {showSearchConfirmDialog && selectedText && (
                    <div className="mt-4 p-4 bg-[var(--color-background)] border border-[var(--color-primary)] rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                            選択したテキストを検索語として使用しますか？
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface)] p-2 rounded border border-[var(--color-border)] font-mono break-words">
                            "{selectedText}"
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowSearchConfirmDialog(false);
                            setSelectedText(null);
                          }}
                          className="ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSearchQuery(selectedText);
                            setShowCitationSearch(true);
                            setShowSearchConfirmDialog(false);
                            setSelectedText(null);
                          }}
                          className="flex-1 bg-[var(--color-primary)] text-[var(--color-surface)] px-4 py-2 rounded text-sm hover:opacity-90 flex items-center justify-center gap-2"
                        >
                          <CheckSquare className="h-4 w-4" />
                          検索する
                        </button>
                        <button
                          onClick={() => {
                            setShowSearchConfirmDialog(false);
                            setSelectedText(null);
                          }}
                          className="px-4 py-2 border border-[var(--color-border)] rounded text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 日本語訳表示エリア */}
                  <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">
                        日本語訳
                      </h3>
                      <button
                        onClick={handleTranslateToJapanese}
                        disabled={translating || !paragraph?.content}
                        className="text-xs bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)] px-3 py-1 rounded hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {translating ? "翻訳中..." : "英語→日本語"}
                      </button>
                    </div>
                    {japaneseTranslation ? (
                      <div className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text)] leading-relaxed">
                        {japaneseTranslation}
                      </div>
                    ) : (
                      <div className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text-secondary)] italic">
                        翻訳ボタンをクリックして日本語訳を表示
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* 論文ビュー */
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-[var(--color-text)] leading-relaxed">
                      {(() => {
                        const sections = [
                          "introduction",
                          "methods",
                          "results",
                          "discussion",
                        ];
                        const getSectionName = (sectionType: string) => {
                          const names: Record<string, string> = {
                            introduction: "Introduction",
                            methods: "Methods",
                            results: "Results",
                            discussion: "Discussion",
                          };
                          return names[sectionType] || sectionType;
                        };

                        const content: JSX.Element[] = [];

                        sections.forEach((sectionType) => {
                          const sectionParagraphs = allParagraphs
                            .filter(
                              (p) => p.section_type === sectionType && p.content
                            )
                            .sort((a, b) => {
                              const numA =
                                parseInt(a.paragraph_number.replace("P", "")) ||
                                0;
                              const numB =
                                parseInt(b.paragraph_number.replace("P", "")) ||
                                0;
                              return numA - numB;
                            });

                          if (sectionParagraphs.length > 0) {
                            content.push(
                              <h2
                                key={sectionType}
                                className="text-2xl font-bold mt-8 mb-4 text-[var(--color-text)]"
                              >
                                {getSectionName(sectionType)}
                              </h2>
                            );

                            sectionParagraphs.forEach((p) => {
                              // フィールドコードを抽出
                              const fieldCodes = extractFieldCodes(
                                p.content || ""
                              );

                              // 引用スタイルを取得
                              const style =
                                getStyleById(citationFormat) ||
                                getDefaultStyle();

                              // 引用マップを作成
                              const citationMap = new Map<string, any>();
                              allCitations.forEach((citation) => {
                                if (citation.paragraph_id === p.id) {
                                  citationMap.set(citation.id, {
                                    paper: citation.paper,
                                    citationId: citation.id,
                                  });
                                }
                              });

                              // 引用番号マップを作成
                              const citationNumberMap = new Map<
                                string,
                                number
                              >();
                              if (citationOrder === "appearance") {
                                // 出現順の場合、引用をソートして番号を割り当て
                                const sortedCitations = [...allCitations]
                                  .filter((c) => c.paper && c.paper.id)
                                  .sort((a, b) => {
                                    const paraA = allParagraphs.find(
                                      (p) => p.id === a.paragraph_id
                                    );
                                    const paraB = allParagraphs.find(
                                      (p) => p.id === b.paragraph_id
                                    );
                                    if (!paraA || !paraB) return 0;
                                    const numA =
                                      parseInt(
                                        paraA.paragraph_number.replace("P", "")
                                      ) || 0;
                                    const numB =
                                      parseInt(
                                        paraB.paragraph_number.replace("P", "")
                                      ) || 0;
                                    if (numA !== numB) return numA - numB;
                                    return (
                                      (a.citation_order || 0) -
                                      (b.citation_order || 0)
                                    );
                                  });

                                // 同一論文は同じ番号を割り当て
                                const paperIdToNumber = new Map<
                                  string,
                                  number
                                >();
                                let currentNumber = 1;
                                sortedCitations.forEach((citation) => {
                                  const paperId = citation.paper?.id;
                                  if (
                                    paperId &&
                                    !paperIdToNumber.has(paperId)
                                  ) {
                                    paperIdToNumber.set(paperId, currentNumber);
                                    currentNumber++;
                                  }
                                  if (paperId) {
                                    citationNumberMap.set(
                                      citation.id,
                                      paperIdToNumber.get(paperId)!
                                    );
                                  }
                                });
                              } else {
                                // アルファベット順の場合、著者名でソート
                                const sortedCitations = [...allCitations]
                                  .filter((c) => c.paper && c.paper.id)
                                  .sort((a, b) => {
                                    const authorA =
                                      (a.paper?.authors || "")
                                        .split(",")[0]
                                        ?.trim() || "";
                                    const authorB =
                                      (b.paper?.authors || "")
                                        .split(",")[0]
                                        ?.trim() || "";
                                    return authorA.localeCompare(authorB);
                                  });

                                // 同一論文は同じ番号を割り当て
                                const paperIdToNumber = new Map<
                                  string,
                                  number
                                >();
                                let currentNumber = 1;
                                sortedCitations.forEach((citation) => {
                                  const paperId = citation.paper?.id;
                                  if (
                                    paperId &&
                                    !paperIdToNumber.has(paperId)
                                  ) {
                                    paperIdToNumber.set(paperId, currentNumber);
                                    currentNumber++;
                                  }
                                  if (paperId) {
                                    citationNumberMap.set(
                                      citation.id,
                                      paperIdToNumber.get(paperId)!
                                    );
                                  }
                                });
                              }

                              // フィールドコードをレンダリング
                              const config = getInTextFormatForStyle(
                                citationFormat,
                                citationOrder
                              );
                              let renderedContent = p.content || "";

                              // フィールドコードを後ろから前に処理（インデックスがずれないように）
                              const sortedFieldCodes = [...fieldCodes].sort(
                                (a, b) => b.startIndex - a.startIndex
                              );

                              sortedFieldCodes.forEach((fieldCode) => {
                                const citation = citationMap.get(
                                  fieldCode.citationId
                                );
                                if (citation) {
                                  // paperIdを取得して番号を取得
                                  const citationObj = allCitations.find(
                                    (c) => c.id === fieldCode.citationId
                                  );
                                  const paperId =
                                    citationObj?.paper?.id ||
                                    citationObj?.paper_id ||
                                    fieldCode.paperId;
                                  const number = citationNumberMap.get(paperId);
                                  const rendered = renderCitationField(
                                    fieldCode,
                                    citation.paper,
                                    style,
                                    number,
                                    config
                                  );

                                  // フィールドコードをレンダリング結果で置き換え
                                  renderedContent =
                                    renderedContent.substring(
                                      0,
                                      fieldCode.startIndex
                                    ) +
                                    rendered +
                                    renderedContent.substring(
                                      fieldCode.endIndex
                                    );
                                }
                              });

                              content.push(
                                <div
                                  key={`para-${p.id}`}
                                  className="mb-4 text-[var(--color-text)] leading-7"
                                >
                                  {renderedContent.trim()}
                                </div>
                              );
                            });
                          }
                        });

                        if (content.length === 0) {
                          return (
                            <div className="text-center py-12 text-[var(--color-text-secondary)]">
                              パラグラフ内容がありません
                            </div>
                          );
                        }

                        return content;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 右側: 引用論文 */}
            <div className="w-96 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    引用論文 ({citations.length})
                  </h2>
                  <button
                    onClick={() => setShowCitationSearch(!showCitationSearch)}
                    className="bg-[var(--color-primary)] text-[var(--color-surface)] px-3 py-1 rounded text-sm hover:opacity-90"
                  >
                    + 追加
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {/* 引用論文コンテンツ */}
                <div className="space-y-4">
                  {showCitationSearch && (
                    <div className="mb-4 p-3 bg-[var(--color-background)] rounded border border-[var(--color-border)]">
                      {/* 検索バー */}
                      <div className="mb-3">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) =>
                              e.key === "Enter" && handleSearch()
                            }
                            placeholder="論文を検索（タイトル、著者、要約）..."
                            className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            disabled={searching}
                          />
                          <button
                            onClick={handleSearch}
                            disabled={searching}
                            className="bg-[var(--color-primary)] text-[var(--color-surface)] px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {searching && (
                              <svg
                                className="animate-spin h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            )}
                            {searching ? "検索中..." : "検索"}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={useWebSearch}
                              onChange={(e) =>
                                setUseWebSearch(e.target.checked)
                              }
                              className="w-4 h-4"
                              disabled={searching}
                            />
                            <span>web（セマンティック検索）</span>
                          </label>
                          {useWebSearch && (
                            <div className="space-y-2 pl-6">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={useAdvancedSearch}
                                  onChange={(e) =>
                                    setUseAdvancedSearch(e.target.checked)
                                  }
                                  className="w-3 h-3"
                                  disabled={searching}
                                />
                                <span className="font-medium">
                                  高度な検索モード
                                </span>
                                <span className="text-[var(--color-text-secondary)] text-xs">
                                  （多層検索・AIランキング）
                                </span>
                              </label>
                              <div>
                                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                                  最小被引用数:
                                </label>
                                <input
                                  type="number"
                                  value={minCitations}
                                  onChange={(e) =>
                                    setMinCitations(e.target.value)
                                  }
                                  placeholder="例: 10"
                                  className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                  disabled={searching}
                                  min="0"
                                />
                              </div>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={sortByCitations}
                                  onChange={(e) =>
                                    setSortByCitations(e.target.checked)
                                  }
                                  className="w-3 h-3"
                                  disabled={searching}
                                />
                                <span>被引用数が多い順にソート</span>
                              </label>
                            </div>
                          )}
                        </div>
                        {searching && (
                          <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                            <svg
                              className="animate-spin h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            <span>検索中...</span>
                          </div>
                        )}
                      </div>

                      {/* フィルター */}
                      <div className="space-y-2 mb-3">
                        {/* 年フィルター */}
                        <div>
                          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                            年:
                          </label>
                          <input
                            type="number"
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            placeholder="例: 2020"
                            className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>

                        {/* ジャーナルフィルター */}
                        <div>
                          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                            ジャーナル:
                          </label>
                          <input
                            type="text"
                            value={venueFilter}
                            onChange={(e) => setVenueFilter(e.target.value)}
                            placeholder="例: Nature"
                            className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>

                        {/* 作成日時フィルター */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                              作成日（開始）:
                            </label>
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                              作成日（終了）:
                            </label>
                            <input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                        </div>

                        {/* タグフィルター */}
                        {availableTags.length > 0 && (
                          <div>
                            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                              タグ:
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {availableTags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => toggleTag(tag)}
                                  className={`px-2 py-1 rounded text-xs ${
                                    selectedTags.includes(tag)
                                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                                      : "bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)]"
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 検索結果 */}
                      {searching && searchResults.length === 0 && (
                        <div className="mt-2 p-4 border border-[var(--color-border)] rounded bg-[var(--color-background)] flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5 text-[var(--color-primary)]"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            検索中...
                          </span>
                        </div>
                      )}
                      {!searching && useWebSearch && searchDetails && (
                        <div className="mt-2 mb-2">
                          <button
                            onClick={() =>
                              setShowSearchDetails(!showSearchDetails)
                            }
                            className="text-xs text-[var(--color-primary)] hover:opacity-80 underline"
                          >
                            {showSearchDetails
                              ? "検索詳細を隠す"
                              : "検索詳細を表示"}
                          </button>
                          {showSearchDetails && (
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-[var(--color-text)]">
                              <div className="font-semibold mb-2">
                                検索詳細情報
                              </div>
                              <div className="space-y-1 mb-2">
                                <div>
                                  <span className="font-semibold">
                                    使用したトピック:
                                  </span>{" "}
                                  {searchDetails.topic}
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    パラグラフタイトル:
                                  </span>{" "}
                                  {searchDetails.paragraphTitle || "なし"}
                                </div>
                                {searchDetails.paragraphDescription && (
                                  <div>
                                    <span className="font-semibold">
                                      トピックセンテンス:
                                    </span>{" "}
                                    {searchDetails.paragraphDescription}
                                  </div>
                                )}
                                {searchDetails.paragraphContent && (
                                  <div>
                                    <span className="font-semibold">
                                      パラグラフ内容（一部）:
                                    </span>{" "}
                                    {searchDetails.paragraphContent}...
                                  </div>
                                )}
                              </div>
                              {searchDetails.searchPlan && (
                                <div className="mt-2 pt-2 border-t border-blue-300">
                                  <div className="font-semibold mb-1">
                                    検索プラン:
                                  </div>
                                  <div className="space-y-1">
                                    {searchDetails.searchPlan.coreKeywords &&
                                      searchDetails.searchPlan.coreKeywords
                                        .length > 0 && (
                                        <div>
                                          <span className="font-semibold">
                                            コアキーワード:
                                          </span>{" "}
                                          {searchDetails.searchPlan.coreKeywords.join(
                                            ", "
                                          )}
                                        </div>
                                      )}
                                    {searchDetails.searchPlan
                                      .recommendedQueries &&
                                      searchDetails.searchPlan
                                        .recommendedQueries.length > 0 && (
                                        <div>
                                          <span className="font-semibold">
                                            推奨クエリ:
                                          </span>
                                          <ul className="list-disc list-inside ml-2">
                                            {searchDetails.searchPlan.recommendedQueries.map(
                                              (q: string, i: number) => (
                                                <li key={i}>{q}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {searchDetails.searchPlan.reasoning && (
                                      <div>
                                        <span className="font-semibold">
                                          検索戦略の理由:
                                        </span>{" "}
                                        {searchDetails.searchPlan.reasoning}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-blue-300">
                                <div>
                                  <span className="font-semibold">
                                    検索方法:
                                  </span>{" "}
                                  {searchDetails.searchMethod || "不明"}
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    プロバイダー:
                                  </span>{" "}
                                  {searchDetails.provider || "不明"}
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    見つかった論文数:
                                  </span>{" "}
                                  {searchDetails.totalFound || 0}件
                                </div>
                                {minCitations && (
                                  <div>
                                    <span className="font-semibold">
                                      最小被引用数フィルター:
                                    </span>{" "}
                                    {minCitations}以上
                                  </div>
                                )}
                                {sortByCitations && (
                                  <div>
                                    <span className="font-semibold">
                                      ソート:
                                    </span>{" "}
                                    被引用数が多い順
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {!searching && searchResults.length > 0 && (
                        <div className="mt-2 max-h-60 overflow-y-auto border border-[var(--color-border)] rounded p-2 bg-[var(--color-surface)]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {searchResults.length}件の論文が見つかりました
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleSelectAllCandidates}
                                className="text-xs text-[var(--color-primary)] hover:underline"
                              >
                                {selectedCandidates.size ===
                                searchResults.length
                                  ? "すべて解除"
                                  : "すべて選択"}
                              </button>
                              {selectedCandidates.size > 0 && (
                                <button
                                  onClick={handleAddMultipleCitations}
                                  className="text-xs bg-[var(--color-primary)] text-[var(--color-surface)] px-2 py-1 rounded hover:opacity-90"
                                >
                                  選択した{selectedCandidates.size}
                                  件を引用に追加
                                </button>
                              )}
                            </div>
                          </div>
                          {searchResults.map((paper, index) => {
                            const paperId =
                              paper.id || `web-${index}-${Date.now()}`;
                            const isSaved = savedPaperIds.has(
                              paper.id || paperId
                            );
                            const isSelected = selectedCandidates.has(paperId);
                            return (
                              <div
                                key={`${paper.id || "web"}-${index}`}
                                className={`relative p-2 border border-[var(--color-border)] rounded mb-2 hover:bg-[var(--color-background)] ${
                                  isSaved
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : "bg-transparent"
                                } ${
                                  isSelected
                                    ? "ring-2 ring-[var(--color-primary)]"
                                    : ""
                                }`}
                              >
                                {/* チェックボックス */}
                                <div className="absolute top-2 left-2 z-10">
                                  <button
                                    onClick={() =>
                                      handleToggleCandidateSelection(paperId)
                                    }
                                    className="flex items-center justify-center w-5 h-5 rounded border border-[var(--color-border)] hover:bg-[var(--color-background)] transition-colors"
                                    title={isSelected ? "選択解除" : "選択"}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
                                    ) : (
                                      <Square className="h-4 w-4 text-[var(--color-text-secondary)]" />
                                    )}
                                  </button>
                                </div>
                                {/* 保存済みラベルとソースラベル */}
                                <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                                  {paper.source && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ${
                                        paper.source === "semantic_scholar"
                                          ? "bg-blue-600"
                                          : paper.source === "pubmed"
                                          ? "bg-green-600"
                                          : paper.source === "google_scholar"
                                          ? "bg-orange-600"
                                          : "bg-gray-600"
                                      }`}
                                    >
                                      {paper.source === "semantic_scholar"
                                        ? "Semantic Scholar"
                                        : paper.source === "pubmed"
                                        ? "PubMed"
                                        : paper.source === "google_scholar"
                                        ? "Google Scholar"
                                        : paper.source}
                                    </span>
                                  )}
                                  {isSaved && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      <BookOpen className="h-2.5 w-2.5" />
                                      保存済み
                                    </span>
                                  )}
                                </div>
                                <div className="font-semibold text-sm text-[var(--color-text)] pr-16 pl-7">
                                  {paper.title}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)] pl-7">
                                  {paper.authors} ({paper.year})
                                </div>
                                {paper.venue && (
                                  <div className="text-xs text-[var(--color-text-secondary)] pl-7">
                                    {paper.venue}
                                  </div>
                                )}
                                {paper.citationCount !== undefined && (
                                  <div className="text-xs text-[var(--color-primary)] font-semibold mt-1 pl-7">
                                    被引用数: {paper.citationCount}
                                  </div>
                                )}
                                {(paper as any).tags &&
                                  (paper as any).tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 pl-7">
                                      {(paper as any).tags.map(
                                        (tag: string) => (
                                          <span
                                            key={tag}
                                            className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                                          >
                                            {tag}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  )}
                                <div className="flex gap-2 mt-1 pl-7">
                                  <button
                                    onClick={() => handleAddCitation(paper)}
                                    className="text-[var(--color-primary)] text-xs hover:underline"
                                  >
                                    引用に追加
                                  </button>
                                  {!isSaved && (
                                    <button
                                      onClick={() => handleSaveToLibrary(paper)}
                                      className="text-green-600 dark:text-green-400 text-xs hover:underline"
                                    >
                                      Libraryに保存
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {citations.length === 0 ? (
                    <div className="text-sm text-[var(--color-text-secondary)] text-center py-4">
                      引用論文がありません
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {citations.map((citation) => {
                        // My Libraryに保存されているかチェック
                        const isSaved = savedPaperIds.has(citation.paper.id);
                        const libraryId = citation.paper.id; // user_library.id（UUID）

                        return (
                          <div
                            key={citation.id}
                            className="relative p-3 border border-[var(--color-border)] rounded hover:bg-[var(--color-background)] bg-transparent"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-[var(--color-text)]">
                                  {citation.paper.title}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)]">
                                  {citation.paper.authors} (
                                  {citation.paper.year})
                                </div>
                                {citation.paper.venue && (
                                  <div className="text-xs text-[var(--color-text-secondary)]">
                                    {citation.paper.venue}
                                  </div>
                                )}
                                {/* リンクと保存済みラベル */}
                                <div className="flex items-center gap-2 mt-2">
                                  {citation.paper.url && (
                                    <a
                                      href={citation.paper.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-[var(--color-primary)] hover:underline"
                                    >
                                      Web
                                    </a>
                                  )}
                                  {libraryId && (
                                    <a
                                      href={`/library?paperId=${libraryId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-green-600 dark:text-green-400 hover:underline"
                                    >
                                      Library
                                    </a>
                                  )}
                                  {/* 保存済みラベルをリンクの右に表示 */}
                                  {isSaved && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      <BookOpen className="h-2.5 w-2.5" />
                                      保存済み
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* 3点メニュー */}
                              <div className="relative group ml-2">
                                <button
                                  className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)] rounded transition-colors"
                                  title="メニュー"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                    />
                                  </svg>
                                </button>
                                {/* ホバーメニュー */}
                                <div className="absolute right-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
                                    <button
                                      onClick={() =>
                                        handleRemoveCitation(citation.id)
                                      }
                                      className="w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      引用から削除する
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 情報 */}
                <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
                  <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
                    情報
                  </h2>
                  <div className="space-y-2 text-sm text-[var(--color-text)]">
                    <div>
                      <span className="font-semibold">ステータス:</span>{" "}
                      {paragraph.status}
                    </div>
                    <div>
                      <span className="font-semibold">セクション:</span>{" "}
                      {paragraph.section_type}
                    </div>
                    <div>
                      <span className="font-semibold">単語数:</span>{" "}
                      {paragraph.word_count}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
