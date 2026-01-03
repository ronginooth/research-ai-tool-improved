import { NextRequest, NextResponse } from "next/server";
import { Paper, SearchResult, SearchOptions } from "@/types";
import { isRateLimited } from "@/lib/rate-limit";
import { callGemini } from "@/lib/gemini";
import { advancedSearchEngine } from "@/lib/advanced-search-engine";
import { generateSearchPlan } from "@/lib/topic-planner";
import { aiProviderManager } from "@/lib/ai-provider-manager";
import { s2Headers } from "@/lib/semantic-scholar";

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      limit = 20,
      // FORCE REBUILD
      sources = ["semantic_scholar", "pubmed"],
      useAdvancedSearch = false, // 高度な検索モード（オプション）
      reviewOnly = false, // Review論文のみ検索（オプション）
    } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    // 高度な検索モードが有効な場合
    if (useAdvancedSearch) {
      try {
        const rateKey = `ai-search:${query.trim().toLowerCase()}`;
        const rate = isRateLimited(rateKey, "ai");
        if (rate.limited) {
          const retrySeconds = Math.ceil((rate.retryAfter ?? 0) / 1000);
          return NextResponse.json(
            {
              papers: [],
              total: 0,
              error:
                "高度な検索の利用リクエストが短時間に集中しています。少し時間を空けて再試行してください。",
              retryAfter: retrySeconds,
            },
            {
              status: 429,
              headers: { "Retry-After": String(retrySeconds) },
            }
          );
        }

        // 検索プランを生成
        let plan;
        try {
          plan = await generateSearchPlan({
            topic: query.trim(),
            language: "ja",
          });
        } catch (plannerError) {
          console.warn(
            "[Search Simple] Topic planner failed, proceeding without plan:",
            plannerError
          );
        }

        // ソースの配列を正規化
        const requestedSources = Array.isArray(sources)
          ? sources.map((s) => s.toLowerCase().replace(/\s+/g, "_"))
          : ["semantic_scholar", "pubmed"];

        // 高度な検索エンジンを使用
        const searchOptions: SearchOptions = {
          query: query.trim(),
          limit: limit,
          filters: {
            dateRange: {
              start: "2010-01-01",
              end: new Date().toISOString().split("T")[0],
            },
            minCitations: 0,
            journalQuality: "all",
            studyTypes: reviewOnly ? ["review"] : [],
            methodologies: [],
            disciplines: [],
            authors: [],
            institutions: [],
            fundingSources: [],
            includeUserLibrary: false,
            excludeUserLibrary: false,
            specificCollections: [],
            databases: requestedSources.filter((s) =>
              ["semantic_scholar", "pubmed"].includes(s)
            ), // Semantic ScholarとPubMedのみサポート
            internetFilter: "all",
          },
          plan,
        };

        // 多層検索を実行（recommendedQueries優先、フォールバック処理も含む）
        let papers = await advancedSearchEngine.multilayerSearch(
          query.trim(),
          searchOptions
        );

        // AIランキングを実行
        let rankedPapers = papers;
        if (papers.length > 0) {
          try {
            const ranking = await aiProviderManager.rankPapers(
              query.trim(),
              papers,
              "gemini" // デフォルトでGeminiを使用
            );
            if (ranking.length > 0) {
              rankedPapers = ranking
                .map((index) => papers[index - 1])
                .filter(Boolean);
              const remainingPapers = papers.filter(
                (_, index) => !ranking.includes(index + 1)
              );
              rankedPapers = [...rankedPapers, ...remainingPapers];
            }
          } catch (error) {
            console.warn(
              "[Search Simple] AI ranking failed, using default ranking:",
              error
            );
            // 引用数でソート
            rankedPapers = papers.sort(
              (a, b) => (b.citationCount || 0) - (a.citationCount || 0)
            );
          }
        }

        // 結果を制限
        const selectedPapers = rankedPapers.slice(0, limit);

        // ソース統計を計算（元のpapersではなくrankedPapersを使用）
        const sourceStats = [
          {
            source: "semantic_scholar",
            fetched: rankedPapers.filter((p) => p.source === "semantic_scholar")
              .length,
            displayed: selectedPapers.filter(
              (p) => p.source === "semantic_scholar"
            ).length,
          },
          {
            source: "pubmed",
            fetched: rankedPapers.filter((p) => p.source === "pubmed").length,
            displayed: selectedPapers.filter((p) => p.source === "pubmed")
              .length,
          },
        ];

        const result: SearchResult = {
          papers: selectedPapers,
          total: selectedPapers.length,
          searchMethod: "advanced_multilayer",
          success: selectedPapers.length > 0,
          message:
            selectedPapers.length > 0
              ? `高度な検索で${selectedPapers.length}件の関連論文を発見しました`
              : "関連する論文が見つかりませんでした。検索条件を変更してお試しください。",
          sourceStats: sourceStats,
          searchLogic: {
            originalQuery: query.trim(),
            translatedQuery: query.trim(), // 高度な検索では内部で翻訳される
            translationMethod: "none",
            searchedSources: requestedSources.filter((s) =>
              ["semantic_scholar", "pubmed"].includes(s)
            ),
          },
        };

        return NextResponse.json(result);
      } catch (error) {
        console.error("[Search Simple] Advanced search error:", error);
        // エラー時は通常の検索にフォールバック
        console.log("[Search Simple] Falling back to simple search");
      }
    }

    const rateKey = `search:${query.trim().toLowerCase()}`;
    const rate = isRateLimited(rateKey, "search");
    if (rate.limited) {
      return NextResponse.json(
        {
          papers: [],
          total: 0,
          error:
            "短時間に検索が集中しています。少し時間を空けて再試行してください。",
          retryAfter: Math.ceil((rate.retryAfter ?? 0) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rate.retryAfter ?? 0) / 1000)),
          },
        }
      );
    }

    // 日本語クエリを英語に変換（Gemini APIを使用、フォールバック付き）
    const originalQuery = query.trim();
    let translatedQuery: string;
    let translationMethod: "gemini" | "fallback" | "none" = "none";
    const queryProcessingSteps: Array<{
      step: string;
      description: string;
      query?: string;
      details?: any;
    }> = [];

    // ステップ1: ユーザーの意図を分析
    let userIntent: UserIntent | undefined;
    queryProcessingSteps.push({
      step: "1",
      description: "ユーザーの検索意図を分析中",
      query: originalQuery,
    });
    try {
      userIntent = await analyzeUserIntent(originalQuery);
      console.log("[Search Simple] User intent analyzed:", {
        mainConcepts: userIntent.mainConcepts,
        compoundTerms: userIntent.compoundTerms,
        searchPurpose: userIntent.searchPurpose,
        keyPhrases: userIntent.keyPhrases,
      });
      queryProcessingSteps.push({
        step: "1",
        description: "意図分析完了",
        details: {
          mainConcepts: userIntent.mainConcepts,
          compoundTerms: userIntent.compoundTerms,
          searchPurpose: userIntent.searchPurpose,
          keyPhrases: userIntent.keyPhrases,
        },
      });
    } catch (error) {
      console.warn(
        "[Search Simple] Intent analysis failed, proceeding without intent:",
        error
      );
      queryProcessingSteps.push({
        step: "1",
        description: "意図分析スキップ（エラー）",
      });
    }

    // ステップ2: 検索クエリを生成（意図分析結果を活用）
    queryProcessingSteps.push({
      step: "2",
      description: "検索クエリを生成中",
    });
    // 日本語が含まれていない場合は翻訳不要（英語のみ、またはその他の言語のみ）
    if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalQuery)) {
      // 英語クエリが文形式（動詞や助動詞を含む）かどうかを判定
      const hasVerbs =
        /\b(are|is|was|were|be|been|being|have|has|had|having|do|does|did|doing|can|could|will|would|should|may|might|must|exhibiting|composed|containing|showing|demonstrating|indicating|suggesting|revealing|displaying)\b/i.test(
          originalQuery
        );

      if (hasVerbs) {
        // 文形式の場合はキーワードを抽出
        try {
          queryProcessingSteps.push({
            step: "2",
            description: "英語文からキーワードを抽出中",
            query: originalQuery,
          });

          const keywordPrompt = `以下の学術的な文章から、検索に有効なキーワードのみを抽出してください。

【ルール】
- 名詞、専門用語、複合語のみを抽出（動詞、助動詞、前置詞、冠詞は除外）
- 複合語や専門用語は引用符で囲む（例: "motile cilia", "9+2 microtubule arrangement"）
- 10-12語程度に収める
- スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: motile cilia are composed of a highly organized axoneme, typically exhibiting a 9+2 microtubule arrangement
出力: "motile cilia" axoneme "9+2 microtubule arrangement" microtubule

【入力】
${originalQuery}

【出力】
キーワード:`;

          const extracted = await callGemini(keywordPrompt);
          const cleaned = extracted
            .trim()
            .replace(/^キーワード:\s*/i, "")
            .trim();

          if (cleaned && /[A-Za-z]/.test(cleaned)) {
            translatedQuery = cleaned;
            translationMethod = "gemini"; // キーワード抽出もGemini APIを使用
            queryProcessingSteps.push({
              step: "2",
              description: "キーワード抽出完了",
              query: translatedQuery,
            });
          } else {
            // 抽出に失敗した場合は元のクエリを使用（引用符処理のみ）
            translatedQuery = originalQuery;
            translationMethod = "none";
            queryProcessingSteps.push({
              step: "2",
              description: "キーワード抽出失敗、元のクエリを使用",
              query: translatedQuery,
            });
            // 引用符処理を適用
            const beforePhrasePreservation = translatedQuery;
            translatedQuery = preservePhrases(
              translatedQuery,
              userIntent?.keyPhrases
            );
            if (beforePhrasePreservation !== translatedQuery) {
              queryProcessingSteps.push({
                step: "2",
                description: "引用符処理を適用",
                query: translatedQuery,
              });
            }
          }
        } catch (error) {
          console.warn("[Search Simple] Keyword extraction failed:", error);
          // エラー時は元のクエリを使用（引用符処理のみ）
          translatedQuery = originalQuery;
          translationMethod = "none";
          queryProcessingSteps.push({
            step: "2",
            description: "キーワード抽出エラー、元のクエリを使用",
            query: translatedQuery,
          });
          // 引用符処理を適用
          const beforePhrasePreservation = translatedQuery;
          translatedQuery = preservePhrases(
            translatedQuery,
            userIntent?.keyPhrases
          );
          if (beforePhrasePreservation !== translatedQuery) {
            queryProcessingSteps.push({
              step: "2",
              description: "引用符処理を適用",
              query: translatedQuery,
            });
          }
        }
      } else {
        // キーワード形式の場合はそのまま使用（引用符処理のみ）
        translatedQuery = originalQuery;
        translationMethod = "none";
        queryProcessingSteps.push({
          step: "2",
          description: "英語クエリのため翻訳不要",
          query: translatedQuery,
        });
        // 英語クエリでも引用符処理を適用
        const beforePhrasePreservation = translatedQuery;
        translatedQuery = preservePhrases(
          translatedQuery,
          userIntent?.keyPhrases
        );
        if (beforePhrasePreservation !== translatedQuery) {
          queryProcessingSteps.push({
            step: "2",
            description: "引用符処理を適用",
            query: translatedQuery,
          });
        }
      }
    } else {
      // 日本語が含まれている場合は、英語と混在していても翻訳を実行
      try {
        queryProcessingSteps.push({
          step: "2",
          description: "Gemini APIで翻訳中",
          query: originalQuery,
        });
        translatedQuery = await translateQueryToEnglish(
          originalQuery,
          userIntent
        );
        // 翻訳が成功した場合、元のクエリと異なるか確認
        if (
          translatedQuery !== originalQuery &&
          /[A-Za-z]/.test(translatedQuery)
        ) {
          translationMethod = "gemini";
          queryProcessingSteps.push({
            step: "2",
            description: "Gemini API翻訳完了",
            query: translatedQuery,
          });
          // 引用符処理を適用
          const beforePhrasePreservation = translatedQuery;
          translatedQuery = preservePhrases(
            translatedQuery,
            userIntent?.keyPhrases
          );
          if (beforePhrasePreservation !== translatedQuery) {
            queryProcessingSteps.push({
              step: "2",
              description: "引用符処理を適用",
              query: translatedQuery,
            });
          }

          // 不適切な引用符を削除（サニタイズ）
          const beforeSanitize = translatedQuery;
          translatedQuery = sanitizeQuotes(translatedQuery);
          if (beforeSanitize !== translatedQuery) {
            queryProcessingSteps.push({
              step: "2",
              description: "引用符サニタイズ適用",
              query: translatedQuery,
            });
          }
        } else {
          // 翻訳されていない場合はフォールバックを使用
          queryProcessingSteps.push({
            step: "2",
            description: "翻訳結果が無効なためフォールバックを使用",
          });
          translatedQuery = translateQueryToEnglishFallback(originalQuery);
          translationMethod = "fallback";
          queryProcessingSteps.push({
            step: "2",
            description: "フォールバック翻訳完了",
            query: translatedQuery,
          });
          // フォールバックでも引用符処理を適用
          const beforePhrasePreservation = translatedQuery;
          translatedQuery = preservePhrases(
            translatedQuery,
            userIntent?.keyPhrases
          );
          if (beforePhrasePreservation !== translatedQuery) {
            queryProcessingSteps.push({
              step: "2",
              description: "引用符処理を適用",
              query: translatedQuery,
            });
          }

        }

      } catch (error) {
        console.warn(
          "[Search Simple] Translation failed, using fallback:",
          error
        );
        queryProcessingSteps.push({
          step: "2",
          description: "翻訳エラーのためフォールバックを使用",
        });
        // 翻訳に失敗した場合はフォールバックを使用
        translatedQuery = translateQueryToEnglishFallback(originalQuery);
        translationMethod = "fallback";
        queryProcessingSteps.push({
          step: "2",
          description: "フォールバック翻訳完了",
          query: translatedQuery,
        });
        // フォールバックでも引用符処理を適用
        const beforePhrasePreservation = translatedQuery;
        translatedQuery = preservePhrases(
          translatedQuery,
          userIntent?.keyPhrases
        );
        if (beforePhrasePreservation !== translatedQuery) {
          queryProcessingSteps.push({
            step: "2",
            description: "引用符処理を適用",
            query: translatedQuery,
          });
        }

        // 不適切な引用符を削除（サニタイズ）
        const beforeSanitize = translatedQuery;
        translatedQuery = sanitizeQuotes(translatedQuery);
        if (beforeSanitize !== translatedQuery) {
          queryProcessingSteps.push({
            step: "2",
            description: "引用符サニタイズ適用",
            query: translatedQuery,
          });
        }
      }

    }


    // 最終的なクエリに対してサニタイズを実行（全パス共通）
    const beforeGlobalSanitize = translatedQuery;
    translatedQuery = sanitizeQuotes(translatedQuery);
    if (beforeGlobalSanitize !== translatedQuery) {
      queryProcessingSteps.push({
        step: "2",
        description: "最終サニタイズ適用",
        query: translatedQuery,
      });
    }

    // ユーザーが選択したソースから検索
    // Google Scholarは環境変数で有効化可能（デフォルトは無効 - CORSやbot対策のため）
    const enableGoogleScholar = process.env.ENABLE_GOOGLE_SCHOLAR === "true";

    // ソースの配列を正規化（小文字に統一、スペースをアンダースコアに）
    const requestedSources = Array.isArray(sources)
      ? sources.map((s) => s.toLowerCase().replace(/\s+/g, "_"))
      : ["semantic_scholar", "pubmed"];

    console.log("[Search Simple] Requested sources:", requestedSources);
    console.log("[Search Simple] Google Scholar enabled:", enableGoogleScholar);

    const searchedSources: string[] = [];
    const searchPromises: Promise<Paper[]>[] = [];

    // Semantic Scholar
    if (requestedSources.includes("semantic_scholar")) {
      searchedSources.push("semantic_scholar");
      searchPromises.push(searchSemanticScholar(translatedQuery, limit));
    }

    // PubMed
    if (requestedSources.includes("pubmed")) {
      searchedSources.push("pubmed");
      searchPromises.push(searchPubMed(translatedQuery, limit));
    }

    // Google Scholar（環境変数で有効化されている場合のみ）
    if (requestedSources.includes("google_scholar") && enableGoogleScholar) {
      searchedSources.push("google_scholar");
      searchPromises.push(searchGoogleScholar(translatedQuery, limit));
    } else if (
      requestedSources.includes("google_scholar") &&
      !enableGoogleScholar
    ) {
      console.warn(
        "[Search Simple] Google Scholar is requested but not enabled (ENABLE_GOOGLE_SCHOLAR=false)"
      );
    }

    // ソースが1つも選択されていない場合はデフォルトでSemantic ScholarとPubMedを使用
    // ただし、Google Scholarだけが選択されていて無効な場合はエラーを返す
    if (searchedSources.length === 0) {
      if (requestedSources.includes("google_scholar") && !enableGoogleScholar) {
        // Google Scholarだけが選択されていて無効な場合
        return NextResponse.json(
          {
            papers: [],
            total: 0,
            error:
              "Google Scholarは現在無効です。環境変数ENABLE_GOOGLE_SCHOLAR=trueを設定してください。",
          },
          { status: 400 }
        );
      }
      // その他の場合はデフォルトでSemantic ScholarとPubMedを使用
      searchedSources.push("semantic_scholar", "pubmed");
      searchPromises.push(searchSemanticScholar(translatedQuery, limit));
      searchPromises.push(searchPubMed(translatedQuery, limit));
    }

    console.log("[Search Simple] Actually searching sources:", searchedSources);

    const results = await Promise.allSettled(searchPromises);

    console.log("[Search Simple] Number of results:", results.length);
    console.log(
      "[Search Simple] Results status:",
      results.map((r, i) => ({
        index: i,
        status: r.status,
        hasValue:
          r.status === "fulfilled" && Array.isArray(r.value)
            ? r.value.length
            : 0,
      }))
    );

    // 結果をソースごとにマッピング
    let resultIndex = 0;
    const semanticScholarResults = searchedSources.includes("semantic_scholar")
      ? results[resultIndex++]
      : { status: "fulfilled" as const, value: [] as Paper[] };
    const pubmedResults = searchedSources.includes("pubmed")
      ? results[resultIndex++]
      : { status: "fulfilled" as const, value: [] as Paper[] };
    const googleScholarResults = searchedSources.includes("google_scholar")
      ? results[resultIndex++]
      : undefined;

    console.log("[Search Simple] Result mapping:", {
      semanticScholar: searchedSources.includes("semantic_scholar")
        ? "mapped"
        : "skipped",
      pubmed: searchedSources.includes("pubmed") ? "mapped" : "skipped",
      googleScholar: searchedSources.includes("google_scholar")
        ? "mapped"
        : "skipped",
      resultIndex,
    });

    // 結果を統合
    const allPapers: Paper[] = [];

    // Semantic Scholarの結果を追加
    if (
      semanticScholarResults.status === "fulfilled" &&
      semanticScholarResults.value
    ) {
      console.log(
        `[Search Simple] Semantic Scholar returned ${semanticScholarResults.value.length} papers`
      );
      allPapers.push(...semanticScholarResults.value);
    } else {
      const errorReason =
        semanticScholarResults.status === "rejected"
          ? semanticScholarResults.reason
          : "Unknown error";
      console.error(
        "[Search Simple] Semantic Scholar search failed:",
        errorReason
      );
      if (errorReason instanceof Error) {
        console.error(
          "[Search Simple] Semantic Scholar error details:",
          errorReason.message,
          errorReason.stack
        );
      }
    }

    // PubMedの結果を追加
    if (pubmedResults.status === "fulfilled" && pubmedResults.value) {
      console.log(
        `[Search Simple] PubMed returned ${pubmedResults.value.length} papers`
      );
      allPapers.push(...pubmedResults.value);
    } else {
      const errorReason =
        pubmedResults.status === "rejected"
          ? pubmedResults.reason
          : "Unknown error";
      console.warn("[Search Simple] PubMed search failed:", errorReason);
      if (errorReason instanceof Error) {
        console.error(
          "[Search Simple] PubMed error details:",
          errorReason.message,
          errorReason.stack
        );
      }
    }

    // Google Scholarの結果を追加（選択されている場合のみ）
    if (googleScholarResults) {
      if (
        googleScholarResults.status === "fulfilled" &&
        googleScholarResults.value
      ) {
        console.log(
          `[Search Simple] Google Scholar returned ${googleScholarResults.value.length} papers`
        );
        allPapers.push(...googleScholarResults.value);
      } else {
        const errorReason =
          googleScholarResults.status === "rejected"
            ? googleScholarResults.reason
            : "Unknown error";
        console.warn(
          "[Search Simple] Google Scholar search failed:",
          errorReason
        );
        if (errorReason instanceof Error) {
          console.error(
            "[Search Simple] Google Scholar error details:",
            errorReason.message,
            errorReason.stack
          );
        }
      }
    }

    console.log(
      `[Search Simple] Total papers before deduplication: ${allPapers.length
      } (Semantic Scholar: ${semanticScholarResults.status === "fulfilled" &&
        semanticScholarResults.value
        ? semanticScholarResults.value.length
        : 0
      }, PubMed: ${pubmedResults.status === "fulfilled" && pubmedResults.value
        ? pubmedResults.value.length
        : 0
      })`
    );

    // Review論文のみフィルタリング
    let filteredPapers = allPapers;
    if (reviewOnly) {
      filteredPapers = allPapers.filter((paper) => {
        const titleLower = (paper.title || "").toLowerCase();
        const abstractLower = (paper.abstract || "").toLowerCase();
        const venueLower = (paper.venue || "").toLowerCase();
        // タイトル、abstract、venueに"review"が含まれているかチェック
        return (
          titleLower.includes("review") ||
          abstractLower.includes("review") ||
          venueLower.includes("review")
        );
      });
      console.log(
        `[Search Simple] Filtered ${filteredPapers.length} review papers from ${allPapers.length} total papers`
      );
    }

    // 重複除去（タイトルベース）
    const uniquePapers = filteredPapers.filter(
      (paper, index, self) =>
        index ===
        self.findIndex(
          (p) => p.title.toLowerCase() === paper.title.toLowerCase()
        )
    );

    console.log(
      `[Search Simple] Total papers after deduplication: ${uniquePapers.length}`
    );

    // 各ソースの残存数を確認
    const semanticCount = uniquePapers.filter(
      (p) => p.source === "semantic_scholar"
    ).length;
    const pubmedCount = uniquePapers.filter(
      (p) => p.source === "pubmed"
    ).length;
    const googleCount = uniquePapers.filter(
      (p) => p.source === "google_scholar"
    ).length;
    console.log(
      `[Search Simple] After deduplication - Semantic Scholar: ${semanticCount}, PubMed: ${pubmedCount}, Google Scholar: ${googleCount}`
    );

    // 各ソースごとに引用数でソート
    const semanticPapers = uniquePapers
      .filter((p) => p.source === "semantic_scholar")
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    const pubmedPapers = uniquePapers
      .filter((p) => p.source === "pubmed")
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    const googlePapers = uniquePapers
      .filter((p) => p.source === "google_scholar")
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));

    // 各ソースから均等に取得（ラウンドロビン方式）
    const balancedPapers: Paper[] = [];

    // 利用可能なソースのリストを作成（論文が存在するソースのみ）
    const availableSources: Array<{ papers: Paper[]; name: string }> = [];
    if (semanticPapers.length > 0) {
      availableSources.push({
        papers: semanticPapers,
        name: "semantic_scholar",
      });
    }
    if (pubmedPapers.length > 0) {
      availableSources.push({ papers: pubmedPapers, name: "pubmed" });
    }
    if (googlePapers.length > 0) {
      availableSources.push({ papers: googlePapers, name: "google_scholar" });
    }

    // 各ソースから交互に取得（ラウンドロビン方式）
    let sourceIndex = 0;
    while (balancedPapers.length < limit && availableSources.length > 0) {
      const currentSource =
        availableSources[sourceIndex % availableSources.length];

      if (currentSource.papers.length > 0) {
        balancedPapers.push(currentSource.papers.shift()!);
        sourceIndex++;
      } else {
        // このソースの論文がなくなったらリストから削除
        availableSources.splice(sourceIndex % availableSources.length, 1);
        if (availableSources.length === 0) break;
        // sourceIndexを調整（削除された要素のインデックスを考慮）
        if (sourceIndex >= availableSources.length) {
          sourceIndex = 0;
        }
      }
    }

    // 残りの論文を追加（上限に達していない場合）
    const remainingPapers = [
      ...semanticPapers,
      ...pubmedPapers,
      ...googlePapers,
    ].sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));

    while (balancedPapers.length < limit && remainingPapers.length > 0) {
      balancedPapers.push(remainingPapers.shift()!);
    }

    const finalPapers = balancedPapers.slice(0, limit);
    const semanticDisplayed = finalPapers.filter(
      (p) => p.source === "semantic_scholar"
    ).length;
    const pubmedDisplayed = finalPapers.filter(
      (p) => p.source === "pubmed"
    ).length;
    const googleDisplayed = finalPapers.filter(
      (p) => p.source === "google_scholar"
    ).length;

    console.log(
      `[Search Simple] Final result - Semantic Scholar: ${semanticDisplayed}, PubMed: ${pubmedDisplayed}, Google Scholar: ${googleDisplayed}`
    );

    // 各ソースの統計情報を取得
    const semanticFetched =
      semanticScholarResults.status === "fulfilled" &&
        semanticScholarResults.value
        ? semanticScholarResults.value.length
        : 0;
    const pubmedFetched =
      pubmedResults.status === "fulfilled" && pubmedResults.value
        ? pubmedResults.value.length
        : 0;
    const googleFetched =
      enableGoogleScholar &&
        googleScholarResults &&
        googleScholarResults.status === "fulfilled" &&
        googleScholarResults.value
        ? googleScholarResults.value.length
        : 0;

    const sourceStats: Array<{
      source: string;
      fetched: number;
      displayed: number;
    }> = [];
    if (semanticFetched > 0 || semanticDisplayed > 0) {
      sourceStats.push({
        source: "semantic_scholar",
        fetched: semanticFetched,
        displayed: semanticDisplayed,
      });
    }
    if (pubmedFetched > 0 || pubmedDisplayed > 0) {
      sourceStats.push({
        source: "pubmed",
        fetched: pubmedFetched,
        displayed: pubmedDisplayed,
      });
    }
    if (googleFetched > 0 || googleDisplayed > 0) {
      sourceStats.push({
        source: "google_scholar",
        fetched: googleFetched,
        displayed: googleDisplayed,
      });
    }

    const result: SearchResult = {
      papers: finalPapers,
      total: uniquePapers.length,
      searchMethod: "semantic_scholar_pubmed_and_google_scholar",
      success: true,
      sourceStats: sourceStats,
      searchLogic: {
        originalQuery: originalQuery,
        translatedQuery: translatedQuery,
        translationMethod: translationMethod,
        searchedSources: searchedSources,
        userIntent: userIntent
          ? {
            mainConcepts: userIntent.mainConcepts,
            compoundTerms: userIntent.compoundTerms,
            searchPurpose: userIntent.searchPurpose,
            keyPhrases: userIntent.keyPhrases,
          }
          : undefined,
        processingSteps: queryProcessingSteps,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        papers: [],
        total: 0,
        error: "論文検索に失敗しました",
        success: false,
      },
      { status: 500 }
    );
  }
}

// ユーザーの意図を分析する関数
interface UserIntent {
  mainConcepts: string[]; // 主要な概念（タンパク質名、遺伝子名など）
  compoundTerms: string[]; // 複合語やフレーズ
  searchPurpose: string; // 検索の目的（メカニズム、機能、調節など）
  keyPhrases: string[]; // 引用符で囲むべきフレーズ
}

async function analyzeUserIntent(query: string): Promise<UserIntent> {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query);

  try {
    const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、検索の意図を明確にしてください。

【分析タスク】
1. 主要な概念を特定（タンパク質名、遺伝子名、プロセス名、細胞小器官など）
2. 複合語やフレーズを特定（例: "adenylate kinase", "motor protein", "intraflagellar transport"）
3. 検索の目的を特定（メカニズム、機能、調節、相互作用、疾患との関係など）
3. 検索の目的を特定（メカニズム、機能、調節、相互作用、疾患との関係など）
4. 引用符で囲むべき重要なフレーズを特定
   - **ルール**: 固有名詞、特定のタンパク質・遺伝子名、確立された複合語（"motor protein"など）のみを含める
   - **除外**: 一般的な説明語（dysfunction, disorder, mechanism, developmentなど）は含めない

【出力形式】
以下のJSON形式で出力してください：
{
  "mainConcepts": ["概念1", "概念2"],
  "compoundTerms": ["複合語1", "複合語2"],
  "searchPurpose": "検索の目的を1文で",
  "keyPhrases": ["引用符で囲むべきフレーズ1", "引用符で囲むべきフレーズ2"]
}

【例】
クエリ: "繊毛病の種類とAdenylate kinase タンパク質"
出力:
{
  "mainConcepts": ["ciliopathy", "adenylate kinase", "protein"],
  "compoundTerms": ["adenylate kinase", "ciliary dysfunction"],
  "searchPurpose": "adenylate kinaseタンパク質と繊毛病の関係、特にadenylate kinaseの欠損が繊毛機能に与える影響を探している",
  "keyPhrases": ["adenylate kinase"]
}

【クエリ】
"${query}"

【出力】
JSON形式:`;

    const response = await callGemini(prompt);
    const cleaned = response.trim();

    // JSONを抽出（```json や ``` で囲まれている場合がある）
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    // JSON解析に失敗した場合のフォールバック
    const fallback = {
      mainConcepts: [],
      compoundTerms: [],
      searchPurpose: "研究論文を検索",
      keyPhrases: [],
    };

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as UserIntent;

        // 強制フィルタリング: 一般的な用語が含まれていたら除外または引用符削除
        if (parsed.keyPhrases && Array.isArray(parsed.keyPhrases)) {
          const generalTerms = [
            "disorder", "disorders",
            "disease", "diseases",
            "syndrome", "syndromes",
            "function", "functions",
            "mechanism", "mechanisms",
            "regulation", "regulations",
            "development", "developments",
            "effect", "effects",
            "influence", "influences",
            "role", "roles"
          ];

          parsed.keyPhrases = parsed.keyPhrases.filter(phrase => {
            const lower = phrase.toLowerCase();
            // 一般用語そのもの、または一般用語で終わるフレーズ（例: "developmental disorders"）を除外
            // ただし、特定の固有名詞（例: "Down syndrome"）は除外したくない場合はホワイトリストが必要だが、
            // ここでは安全側に倒して「一般用語で終わるもの」は引用符をつけない（＝keyPhrasesから外す）ことにする
            const endsWithGeneralTerm = generalTerms.some(term => lower.endsWith(term));
            return !endsWithGeneralTerm;
          });
        }

        return parsed;
      } catch (e) {
        console.warn("[Search Simple] JSON parse failed:", e);
        return fallback;
      }
    }

    return fallback;
  } catch (error) {
    console.warn("[Search Simple] Intent analysis failed:", error);
    // エラー時は空の意図を返す
    return {
      mainConcepts: [],
      compoundTerms: [],
      searchPurpose: "研究論文を検索",
      keyPhrases: [],
    };
  }
}

// 複合語やタンパク質名を引用符で囲む関数
function preservePhrases(query: string, keyPhrases?: string[]): string {
  // 既に引用符で囲まれている場合はそのまま返す
  if (query.includes('"')) {
    return query;
  }

  // keyPhrasesが指定されている場合は、それらを優先的に引用符で囲む
  if (keyPhrases && keyPhrases.length > 0) {
    let result = query;
    keyPhrases.forEach((phrase) => {
      const regex = new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi"
      );
      result = result.replace(regex, (match) => {
        // 既に引用符で囲まれている場合はスキップ
        if (result.includes(`"${match}"`)) {
          return match;
        }
        return `"${match}"`;
      });
    });
    query = result; // 処理済みのクエリを更新
  }

  // 既知の複合語パターン（タンパク質名、専門用語など）
  const phrasePatterns = [
    // タンパク質名・酵素名
    /\badenylate\s+kinase\b/gi,
    /\bATP\s+synthase\b/gi,
    /\bmotor\s+protein\b/gi,
    /\bprotein\s+kinase\b/gi,
    /\bDNA\s+polymerase\b/gi,
    /\bRNA\s+polymerase\b/gi,
    /\btranscription\s+factor\b/gi,
    /\bcell\s+cycle\b/gi,
    /\bcell\s+death\b/gi,
    /\bcell\s+division\b/gi,

    // 専門用語の組み合わせ
    /\bintraflagellar\s+transport\b/gi,
    /\bciliary\s+function\b/gi,
    /\bciliary\s+dysfunction\b/gi,
    /\benergy\s+homeostasis\b/gi,
    /\bATP\s+metabolism\b/gi,
    /\bmitochondrial\s+dysfunction\b/gi,
    /\bnuclear\s+reshaping\b/gi,
    /\btail\s+formation\b/gi,
    /\bmicrotubule\s+transport\b/gi,
    /\bprimary\s+cilia\b/gi,

    // 一般的な複合語パターン（タンパク質名のパターン）
    /\b[A-Z][a-z]+\s+kinase\b/g, // 例: Adenylate kinase, Protein kinase
    /\b[A-Z][a-z]+\s+protein\b/g, // 例: Motor protein, Ciliary protein
    /\b[A-Z][a-z]+\s+synthase\b/g, // 例: ATP synthase
    /\b[A-Z][a-z]+\s+transport\b/g, // 例: Intraflagellar transport
  ];

  let result = query;
  const processedPhrases = new Set<string>();

  // 各パターンに対して、引用符で囲む
  phrasePatterns.forEach((pattern) => {
    result = result.replace(pattern, (match) => {
      const lowerMatch = match.toLowerCase();
      // 既に処理済みの場合はスキップ
      if (processedPhrases.has(lowerMatch)) {
        return match;
      }
      processedPhrases.add(lowerMatch);

      // 既に引用符で囲まれている場合はスキップ
      if (result.includes(`"${match}"`)) {
        return match;
      }

      // 引用符で囲む
      return `"${match}"`;
    });
  });

  return result;
}

// Gemini APIを使用した日本語→英語変換（パターン4: 意図理解ベース）
async function translateQueryToEnglishPattern4(
  query: string,
  userIntent?: UserIntent
): Promise<string> {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query);
  const isLongSentence = query.split(/\s+/).length > 5; // 論文タイトルなどの長い文章かどうか
  const isEnglishKeywords = !hasJapanese && query.split(/\s+/).length <= 5; // 英語のキーワードのみかどうか

  // 英語のキーワードのみの場合: 元のキーワードを核として最小限の拡張のみ
  if (isEnglishKeywords) {
    try {
      const prompt = `以下の英語の学術検索キーワードを、元のキーワードを核として、最小限の関連語（2-3語）のみを追加して拡張してください。

【ルール】
- 元のキーワードを必ずすべて含める
- 関連する専門用語を2-3語のみ追加（例: motor protein, function, mechanism）
- **複合語やタンパク質名は引用符で囲む**（例: "adenylate kinase", "motor protein", "ATP synthase"）
  - ただし、一般的な語句（example: function, mechanism, disorder, development）は**引用符で囲まない**こと
- 合計で10-12語程度に収める
- スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: kinesin cilia effect
出力: kinesin "motor protein" cilia "ciliary function" effect mechanism

【入力】
${query}

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        // キーワード数をチェック（15語を超える場合は元のクエリを返す）
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount > 15) {
          console.warn(
            `[Search Simple] Generated query too long (${wordCount} words), using original`
          );
          return preservePhrases(query);
        }
        // 引用符処理を適用（userIntentのkeyPhrasesを使用）
        return preservePhrases(cleaned, userIntent?.keyPhrases);
      }
      return preservePhrases(query, userIntent?.keyPhrases); // 拡張に失敗した場合は元のクエリを返す（引用符処理付き）
    } catch (error) {
      console.warn("[Search Simple] English keyword expansion failed:", error);
      return preservePhrases(query, userIntent?.keyPhrases); // エラー時は元のクエリを返す（引用符処理付き）
    }
  }

  // 論文タイトルの場合: 主要キーワードを抽出して拡張を最小限に
  if (isLongSentence && !hasJapanese) {
    try {
      const prompt = `以下の論文タイトルまたは長い文章から、主要な学術検索キーワードを抽出してください。

【ルール】
- 重要な専門用語、遺伝子名、種名、プロセス名を優先的に含める
- **複合語やタンパク質名は引用符で囲む**（例: "nuclear reshaping", "tail formation"）
  - ただし、一般的な語句（example: function, mechanism, disorder, development, spermiogenesis）は**引用符で囲まない**こと
- 10-12語程度に収める
- スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: Expression Dynamics Indicate Potential Roles of KIF17 for Nuclear Reshaping and Tail Formation during Spermiogenesis in Phascolosoma esculenta
出力: KIF17 kinesin "nuclear reshaping" "tail formation" spermiogenesis "Phascolosoma esculenta" expression dynamics

【入力】
${query}

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount > 15) {
          console.warn(
            `[Search Simple] Generated query too long (${wordCount} words), using original`
          );
          return preservePhrases(query);
        }
        // 引用符処理を適用（userIntentのkeyPhrasesを使用）
        return preservePhrases(cleaned, userIntent?.keyPhrases);
      }
      return preservePhrases(query, userIntent?.keyPhrases);
    } catch (error) {
      console.warn("[Search Simple] Title extraction failed:", error);
      return preservePhrases(query, userIntent?.keyPhrases);
    }
  }

  // 日本語が含まれている場合: 意図理解ベースの翻訳と拡張
  if (hasJapanese) {
    try {
      // userIntentが提供されている場合は、それを活用
      const intentContext = userIntent
        ? `\n【ユーザーの意図分析結果】
- 主要な概念: ${userIntent.mainConcepts.join(", ")}
- 複合語: ${userIntent.compoundTerms.join(", ")}
- 検索の目的: ${userIntent.searchPurpose}
- 重要なフレーズ: ${userIntent.keyPhrases.join(", ")}
\n上記の分析結果を踏まえて、以下のクエリから検索キーワードを生成してください。`
        : "";

      const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードを生成してください。
${intentContext}
【分析ステップ】
1. ユーザーが探している研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード生成ルール】
- 必須概念を必ず含める（例: kinesin, cilia）
- 関連する専門用語を追加（例: motor protein, ciliary function, intraflagellar transport）
- **複合語やタンパク質名は引用符で囲む**（例: "adenylate kinase", "motor protein", "intraflagellar transport"）
  - ただし、一般的な語句（example: function, mechanism, disorder, development, regulation）は**引用符で囲まない**こと
- 研究の文脈に応じた概念を含める（例: regulation, mechanism, transport）
- **10-12語程度で、スペース区切りで出力**（重要: 15語を超えないこと）
- 余計な説明や記号は不要

【例】
クエリ: "キネシンの繊毛への影響"
分析: キネシン（モータータンパク質）と繊毛（細胞小器官）の関係、機能、調節メカニズムを探している
出力: kinesin "motor protein" cilia "ciliary function" regulation mechanism "microtubule transport"

【クエリ】
"${query}"

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        // キーワード数をチェック（15語を超える場合は警告して切り詰める）
        const words = cleaned.split(/\s+/);
        if (words.length > 15) {
          console.warn(
            `[Search Simple] Generated query too long (${words.length} words), truncating to 12 words`
          );
          const truncated = words.slice(0, 12).join(" ");
          // 引用符処理を適用（userIntentのkeyPhrasesを使用）
          return preservePhrases(truncated, userIntent?.keyPhrases);
        }
        // 引用符処理を適用（userIntentのkeyPhrasesを使用）
        return preservePhrases(cleaned, userIntent?.keyPhrases);
      }

      // 翻訳結果が無効な場合はフォールバックを使用
      return preservePhrases(
        translateQueryToEnglishFallback(query),
        userIntent?.keyPhrases
      );
    } catch (error) {
      console.warn("[Search Simple] Gemini translation failed:", error);
      // エラー時はフォールバックを使用
      return preservePhrases(
        translateQueryToEnglishFallback(query),
        userIntent?.keyPhrases
      );
    }
  }

  // その他の場合: そのまま返す（引用符処理付き）
  return preservePhrases(query, userIntent?.keyPhrases);
}

// Gemini APIを使用した日本語→英語変換（ハイブリッド: パターン4 + パターン1）
async function translateQueryToEnglishHybrid(query: string): Promise<string> {
  // 日本語が含まれていない場合はそのまま返す（英語のみ、またはその他の言語のみ）
  if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query)) {
    return query;
  }

  // 日本語が含まれている場合は、英語と混在していても翻訳を実行
  try {
    const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードを生成してください。

【分析ステップ】
1. ユーザーが探している研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード生成ルール】
- 必須概念を必ず含める
- 関連する専門用語を追加
- 研究の文脈に応じた概念を含める
- 12-15語程度で、スペース区切りで出力
- 余計な説明や記号は不要

【クエリ】
"${query}"

【出力】
英語キーワード:`;

    const translated = await callGemini(prompt);
    const cleaned = translated.trim();

    if (cleaned && /[A-Za-z]/.test(cleaned)) {
      return cleaned;
    }

    // 翻訳結果が無効な場合はフォールバックを使用
    return translateQueryToEnglishFallback(query);
  } catch (error) {
    console.warn("[Search Simple] Gemini translation failed:", error);
    // エラー時はフォールバックを使用
    return translateQueryToEnglishFallback(query);
  }
}

// Gemini APIを使用した日本語→英語変換（デフォルト: 現在の方式）
async function translateQueryToEnglish(
  query: string,
  userIntent?: UserIntent
): Promise<string> {
  // 環境変数でパターンを選択（デフォルトはパターン4）
  const pattern = process.env.SEARCH_TRANSLATION_PATTERN || "pattern4";

  if (pattern === "hybrid") {
    return translateQueryToEnglishHybrid(query);
  } else {
    return translateQueryToEnglishPattern4(query, userIntent);
  }
}

// 引用符を整理する関数（不適切な引用符を削除）
function sanitizeQuotes(query: string): string {
  if (!query || typeof query !== 'string') return query || "";
  const generalTerms = [
    "disorder", "disorders",
    "disease", "diseases",
    "syndrome", "syndromes",
    "function", "functions",
    "mechanism", "mechanisms",
    "regulation", "regulations",
    "development", "developments",
    "effect", "effects",
    "influence", "influences",
    "role", "roles",
    "activity", "activities",
    "movement", "movements"
  ];

  // 引用符で囲まれた部分を抽出してチェック
  return query.replace(/"([^"]+)"/g, (match, content) => {
    const lower = content.toLowerCase().trim();
    // 一般用語で終わる場合は引用符を外す
    if (generalTerms.some(term => lower.endsWith(term))) {
      // ただし、ホワイトリスト（固有名詞）は除外する必要があるかもしれないが、
      // 現状は安全側に倒して外す
      return content;
    }
    return match;
  });
}

// フォールバック: 簡単な日本語→英語変換
function translateQueryToEnglishFallback(query: string): string {
  const translations: Record<string, string> = {
    カルシウム: "calcium",
    神経細胞: "neuron",
    微小管: "microtubule",
    解体: "disassembly",
    促進: "promotion",
    研究: "research",
    論文: "paper",
    検索: "search",
    分析: "analysis",
    実験: "experiment",
    データ: "data",
    結果: "result",
    方法: "method",
    技術: "technique",
    開発: "development",
    応用: "application",
    効果: "effect",
    影響: "influence",
    関係: "relationship",
    比較: "comparison",
  };

  // 英語が含まれている場合はそのまま返す
  if (/[A-Za-z]/.test(query)) {
    return query;
  }

  let result = query;
  for (const [japanese, english] of Object.entries(translations)) {
    result = result.replace(new RegExp(japanese, "g"), english);
  }

  // 日本語文字が残っている場合は削除
  result = result.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "");

  return result.trim() || query; // 空の場合は元のクエリを返す
}

// Semantic Scholar検索
async function searchSemanticScholar(
  query: string,
  limit: number
): Promise<Paper[]> {
  try {
    // APIキーを使用（s2Headers関数を使用）
    const headers = s2Headers();

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        query
      )}&limit=${limit}&fields=paperId,title,abstract,authors,year,publicationDate,venue,citationCount,url,doi`,
      {
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Search Simple] Semantic Scholar rate limited");
        return [];
      }

      // 403エラーの場合、APIキーなしで再試行
      if (response.status === 403) {
        console.warn(
          "[Search Simple] Semantic Scholar API key invalid (403), trying without API key"
        );
        // APIキーなしで再試行
        const fallbackHeaders = {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        };
        const fallbackResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
            query
          )}&limit=${limit}&fields=paperId,title,abstract,authors,year,publicationDate,venue,citationCount,url,doi`,
          {
            headers: fallbackHeaders,
          }
        );

        if (fallbackResponse.ok) {
          console.log(
            "[Search Simple] Semantic Scholar search succeeded without API key"
          );
          const data = await fallbackResponse.json();
          if (data && data.data && Array.isArray(data.data)) {
            return data.data.map((paper: any) => {
              // publicationDateから年、月、日を抽出
              let year = paper.year || new Date().getFullYear();
              let month: number | null = null;
              let day: number | null = null;

              if (paper.publicationDate) {
                // ISO 8601形式: "2024-05-15"
                const dateParts = paper.publicationDate.split("-");
                if (dateParts.length >= 1) {
                  year = parseInt(dateParts[0]) || year;
                }
                if (dateParts.length >= 2) {
                  month = parseInt(dateParts[1]) || null;
                }
                if (dateParts.length >= 3) {
                  day = parseInt(dateParts[2]) || null;
                }
              }

              return {
                id:
                  paper.paperId ||
                  `paper-${Math.random().toString(36).substr(2, 9)}`,
                paperId: paper.paperId,
                title: paper.title || "タイトルなし",
                abstract: paper.abstract || "要約なし",
                authors:
                  paper.authors?.map((author: any) => author.name).join(", ") ||
                  "著者不明",
                year: year,
                month: month,
                day: day,
                publicationDate: paper.publicationDate || undefined,
                venue: paper.venue || "ジャーナル不明",
                citationCount: paper.citationCount || 0,
                url: paper.url || "#",
                doi: paper.doi || undefined,
                source: "semantic_scholar",
              };
            });
          }
        } else {
          console.warn(
            `[Search Simple] Semantic Scholar fallback also failed: ${fallbackResponse.status}`
          );
          return [];
        }
      }

      const errorText = await response.text().catch(() => "");
      console.error(
        `[Search Simple] Semantic Scholar API error: ${response.status}`,
        errorText
      );
      // 400エラーの場合（フィールドエラーなど）は空配列を返して続行
      if (response.status === 400) {
        console.warn(
          "[Search Simple] Semantic Scholar API returned 400, skipping"
        );
        return [];
      }
      // 403以外のエラーは空配列を返して続行（他のソースで検索を継続）
      return [];
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((paper: any) => {
      // Semantic Scholar APIの検索エンドポイントでは、volume, issue, pagesは取得できない
      // 個別の論文エンドポイント（/paper/{paperId}）で取得する必要があるが、
      // パフォーマンスを考慮して、検索結果では取得しない
      const volume: string | undefined = undefined;
      const issue: string | undefined = undefined;
      const pages: string | undefined = undefined;

      // 年、月、日の抽出
      // publicationDateフィールドから取得（ISO 8601形式: "2024-05-15"）
      let year = paper.year || new Date().getFullYear();
      let month: number | null = null;
      let day: number | null = null;

      if (paper.publicationDate) {
        // ISO 8601形式: "2024-05-15" または "2024-05" または "2024"
        const dateParts = paper.publicationDate.split("-");
        if (dateParts.length >= 1) {
          year = parseInt(dateParts[0]) || year;
        }
        if (dateParts.length >= 2) {
          month = parseInt(dateParts[1]) || null;
        }
        if (dateParts.length >= 3) {
          day = parseInt(dateParts[2]) || null;
        }
      }

      return {
        id: paper.paperId || `paper-${Math.random().toString(36).substr(2, 9)}`,
        paperId: paper.paperId,
        title: paper.title || "タイトルなし",
        abstract: paper.abstract || "要約なし",
        authors:
          paper.authors?.map((author: any) => author.name).join(", ") ||
          "著者不明",
        year: year,
        month: month,
        day: day,
        publicationDate: paper.publicationDate || undefined,
        venue: paper.venue || "ジャーナル不明",
        volume: volume,
        issue: issue,
        pages: pages,
        citationCount: paper.citationCount || 0,
        url: paper.url || "#",
        doi: paper.doi || undefined,
        source: "semantic_scholar",
      };
    });
  } catch (error) {
    console.error("[Search Simple] Semantic Scholar search error:", error);
    if (error instanceof Error) {
      console.error(
        "[Search Simple] Semantic Scholar error message:",
        error.message
      );
      console.error(
        "[Search Simple] Semantic Scholar error stack:",
        error.stack
      );
    }
    return [];
  }
}

// PubMed検索
async function searchPubMed(query: string, limit: number): Promise<Paper[]> {
  try {
    // Step 1: esearchでPMIDを取得
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(limit),
      retmode: "json",
    });

    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`PubMed esearch error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const pmids = searchData?.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return [];
    }

    // Step 2: esummaryで詳細情報を取得（JSON形式）
    const summaryParams = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
    });

    const summaryResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!summaryResponse.ok) {
      throw new Error(`PubMed esummary error: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const results = summaryData?.result || {};

    // データを整形
    const papers: Paper[] = pmids
      .map((pmid: string) => {
        const paper = results[pmid];
        if (!paper) return null;

        const authors = paper.authors
          ? paper.authors
            .map((author: any) => {
              if (typeof author === "string") return author;
              return `${author.name || ""}`.trim();
            })
            .filter((name: string) => name)
            .join(", ")
          : "著者不明";

        // pubdateから年、月、日を抽出
        // pubdate形式: "2024 May 15" または "2024-05-15" または "2024 May" など
        let year = new Date().getFullYear();
        let month: number | null = null;
        let day: number | null = null;

        if (paper.pubdate) {
          const pubdateStr = paper.pubdate;
          // 年を抽出
          const yearMatch = pubdateStr.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0]);
          }

          // 月を抽出（英語名または数字）
          const monthNames: Record<string, number> = {
            january: 1,
            jan: 1,
            february: 2,
            feb: 2,
            march: 3,
            mar: 3,
            april: 4,
            apr: 4,
            may: 5,
            june: 6,
            jun: 6,
            july: 7,
            jul: 7,
            august: 8,
            aug: 8,
            september: 9,
            sep: 9,
            sept: 9,
            october: 10,
            oct: 10,
            november: 11,
            nov: 11,
            december: 12,
            dec: 12,
          };

          const monthMatch = pubdateStr.match(
            /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i
          );
          if (monthMatch) {
            month = monthNames[monthMatch[0].toLowerCase()] || null;
          } else {
            // 数字形式の月を抽出（例: "2024-05-15"）
            const monthNumMatch = pubdateStr.match(/\b(0?[1-9]|1[0-2])\b/);
            if (
              (monthNumMatch && !yearMatch) ||
              (monthNumMatch && parseInt(monthNumMatch[0]) <= 12)
            ) {
              month = parseInt(monthNumMatch[0]);
            }
          }

          // 日を抽出（1-31）
          const dayMatch = pubdateStr.match(/\b([1-9]|[12][0-9]|3[01])\b/);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[0]);
            if (dayNum >= 1 && dayNum <= 31) {
              day = dayNum;
            }
          }
        }

        // Volume, Issue, Pagesを抽出
        // PubMed APIのesummaryレスポンス構造を確認
        const volume = paper.volume || undefined;
        const issue = paper.issue || undefined;
        // PubMedのpagesフィールドは"123-145"形式または"123"形式
        // epage (ending page) と spage (starting page) が別々の場合もある
        let pages: string | undefined = undefined;
        if (paper.pages) {
          pages = paper.pages;
        } else if (paper.spage && paper.epage) {
          pages = `${paper.spage}-${paper.epage}`;
        } else if (paper.spage) {
          pages = paper.spage;
        } else if (paper.epage) {
          pages = paper.epage;
        }

        return {
          id: `pubmed-${pmid}`,
          paperId: `pubmed-${pmid}`,
          title: paper.title || "タイトルなし",
          abstract: paper.abstract || "要約なし",
          authors: authors || "著者不明",
          year: year,
          month: month,
          day: day,
          venue: paper.source || "ジャーナル不明",
          volume: volume,
          issue: issue,
          pages: pages,
          citationCount: 0, // PubMed APIには引用数が含まれない
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          source: "pubmed",
        };
      })
      .filter((paper: Paper | null): paper is Paper => paper !== null);

    return papers;
  } catch (error) {
    console.error("[Search Simple] PubMed search error:", error);
    return [];
  }
}

/**
 * Google Scholar検索（非公式API / スクレイピングベース）
 *
 * ⚠️ 注意: Google Scholarには公式APIが存在しません。
 * この実装は検索結果ページをスクレイピングする方式です。
 * Google Scholarの利用規約に違反する可能性があるため、使用時は注意が必要です。
 * 商用利用や大量のリクエストは推奨されません。
 *
 * 代替案: SerpAPIなどの有料APIサービスの使用を検討してください。
 */
async function searchGoogleScholar(
  query: string,
  limit: number
): Promise<Paper[]> {
  try {
    // Google Scholarの検索URLを構築
    const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(
      query
    )}&hl=en&num=${Math.min(limit, 20)}`;

    // タイムアウト付きfetch（10秒でタイムアウト）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // User-Agentを設定（bot対策回避のため）
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Referer: "https://scholar.google.com/",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Search Simple] Google Scholar rate limited");
          return [];
        }
        // 403やその他のエラーも静かに失敗させる
        console.warn(
          `[Search Simple] Google Scholar returned ${response.status}`
        );
        return [];
      }

      const html = await response.text();

      // HTMLをパースして論文情報を抽出
      // Google Scholarの検索結果は動的にロードされることが多いため、
      // シンプルなHTMLパースでは限界があります
      const papers: Paper[] = [];

      // 正規表現で論文情報を抽出
      // Google ScholarのHTML構造に基づくパターンマッチング
      const paperPattern =
        /<div class="gs_ri">[\s\S]*?<h3 class="gs_rt">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<div class="gs_a">([^<]*)<\/div>[\s\S]*?<div class="gs_rs">([^<]*)<\/div>/g;

      let match;
      let count = 0;

      while ((match = paperPattern.exec(html)) !== null && count < limit) {
        const url = match[1];
        const title = match[2].replace(/<[^>]*>/g, "").trim();
        const authorInfo = match[3].replace(/<[^>]*>/g, "").trim();
        const snippet = match[4].replace(/<[^>]*>/g, "").trim();

        // 著者情報から著者名と年を抽出
        const authorMatch = authorInfo.match(/^([^-]+)/);
        const authors = authorMatch ? authorMatch[1].trim() : "著者不明";

        // 年を抽出
        const yearMatch = authorInfo.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch
          ? parseInt(yearMatch[0])
          : new Date().getFullYear();

        // 引用数を抽出（存在する場合）
        const citationMatch = html
          .substring(match.index)
          .match(/Cited by (\d+)/);
        const citationCount = citationMatch ? parseInt(citationMatch[1]) : 0;

        // ジャーナル情報を抽出
        const venueMatch = authorInfo.match(/-\s*([^,]+)/);
        const venue = venueMatch ? venueMatch[1].trim() : "ジャーナル不明";

        if (title && title !== "") {
          papers.push({
            id: `gs-${count}-${Math.random().toString(36).substr(2, 9)}`,
            paperId: `gs-${count}`,
            title: title,
            abstract: snippet || "要約なし",
            authors: authors,
            year: year,
            venue: venue,
            citationCount: citationCount,
            url: url.startsWith("http")
              ? url
              : `https://scholar.google.com${url}`,
            source: "google_scholar",
          });
          count++;
        }
      }

      // パターンマッチングで取得できない場合は、より柔軟な方法を試す
      if (papers.length === 0) {
        // 代替パターン: より広範囲な検索
        const altPattern =
          /<h3 class="gs_rt">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
        let altMatch;
        let altCount = 0;

        while (
          (altMatch = altPattern.exec(html)) !== null &&
          altCount < limit
        ) {
          const url = altMatch[1];
          const title = altMatch[2].replace(/<[^>]*>/g, "").trim();

          if (title && title !== "") {
            papers.push({
              id: `gs-alt-${altCount}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              paperId: `gs-alt-${altCount}`,
              title: title,
              abstract: "要約なし（Google Scholarから取得できませんでした）",
              authors: "著者不明",
              year: new Date().getFullYear(),
              venue: "ジャーナル不明",
              citationCount: 0,
              url: url.startsWith("http")
                ? url
                : `https://scholar.google.com${url}`,
              source: "google_scholar",
            });
            altCount++;
          }
        }
      }

      return papers;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // タイムアウトやネットワークエラーの場合
      if (fetchError.name === "AbortError") {
        console.warn("[Search Simple] Google Scholar request timeout");
      } else {
        console.warn(
          "[Search Simple] Google Scholar fetch error:",
          fetchError.message
        );
      }
      return [];
    }
  } catch (error: any) {
    console.error(
      "[Search Simple] Google Scholar search error:",
      error?.message || error
    );
    // エラーが発生しても他の検索結果には影響を与えないように空配列を返す
    return [];
  }
}
