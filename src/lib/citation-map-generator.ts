import { Paper, CitationMap, NetworkMetrics } from "@/types";
import { s2Headers } from "./semantic-scholar";

// 引用マップ生成器
export class CitationMapGenerator {
  private cache = new Map<string, CitationMap>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1時間

  async generateCitationMap(paperDOI: string): Promise<CitationMap> {
    const cacheKey = `citation_map_${paperDOI}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // 中心論文を取得
      const centerPaper = await this.getPaperByDOI(paperDOI);
      if (!centerPaper) {
        throw new Error("Paper not found");
      }

      // 引用された論文を取得
      const citedBy = await this.getCitedByPapers(centerPaper.paperId);

      // 参考文献を取得
      const references = await this.getReferencePapers(centerPaper.paperId);

      // 間接的接続を探索
      const indirectConnections = await this.findIndirectConnections(
        centerPaper.paperId
      );

      const citationMap: CitationMap = {
        center: centerPaper,
        citedBy: citedBy.slice(0, 50), // 上位50件
        references: references.slice(0, 50),
        indirectConnections: indirectConnections.slice(0, 30),
        networkMetrics: this.calculateNetworkMetrics(
          centerPaper,
          citedBy,
          references
        ),
      };

      // キャッシュに保存
      this.cache.set(cacheKey, citationMap);

      return citationMap;
    } catch (error) {
      console.error("Citation map generation error:", error);
      throw error;
    }
  }

  // paperIdから直接Citation Mapを生成
  async generateCitationMapByPaperId(paperId: string): Promise<CitationMap> {
    // paperIdの検証
    const trimmedPaperId = paperId.trim();
    if (!trimmedPaperId || trimmedPaperId.length === 0) {
      throw new Error("PaperId is empty or invalid");
    }

    // paperIdの形式チェック（通常は英数字とハイフンのみ）
    if (!/^[a-zA-Z0-9\-]+$/.test(trimmedPaperId)) {
      console.warn(`[CITATION MAP] Suspicious paperId format: ${trimmedPaperId}`);
    }

    const cacheKey = `citation_map_paperid_${trimmedPaperId}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // paperIdから直接論文を取得
      const centerPaper = await this.getPaperByPaperId(trimmedPaperId);
      if (!centerPaper) {
        throw new Error(`Paper not found for paperId: ${trimmedPaperId}`);
      }

      // 引用された論文を取得
      const citedBy = await this.getCitedByPapers(centerPaper.paperId);

      // 参考文献を取得
      const references = await this.getReferencePapers(centerPaper.paperId);

      // 間接的接続を探索
      const indirectConnections = await this.findIndirectConnections(
        centerPaper.paperId
      );

      const citationMap: CitationMap = {
        center: centerPaper,
        citedBy: citedBy.slice(0, 50),
        references: references.slice(0, 50),
        indirectConnections: indirectConnections.slice(0, 30),
        networkMetrics: this.calculateNetworkMetrics(
          centerPaper,
          citedBy,
          references
        ),
      };

      // キャッシュに保存
      this.cache.set(cacheKey, citationMap);

      return citationMap;
    } catch (error) {
      console.error("Citation map generation error:", error);
      throw error;
    }
  }

  // DOIで論文を取得
  private async getPaperByDOI(doi: string): Promise<Paper | null> {
    try {
      console.log(`[CITATION MAP] Fetching paper for DOI: ${doi}`);
      const encodedDoi = encodeURIComponent(doi.trim());

      // レート制限対応のため1秒待機（APIキー使用時は1 request per second）
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // DOI 部分のみをエンコードし、接頭辞のコロンはそのまま
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodedDoi}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
        { headers: s2Headers() }
      );

      console.log(
        `[CITATION MAP] Direct DOI search status: ${response.status}`
      );

      // レート制限エラーの場合
      if (response.status === 429) {
        console.log(`[CITATION MAP] Rate limited, waiting 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 再試行
        const retryResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodedDoi}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
          { headers: s2Headers() }
        );
        console.log(`[CITATION MAP] Retry status: ${retryResponse.status}`);
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          console.log(`[CITATION MAP] Retry success:`, data);
          return this.formatPaperData(data);
        }
      }

      if (!response.ok) {
        console.log(
          `[CITATION MAP] Direct DOI search failed, trying search endpoint`
        );
        // フォールバック: 検索エンドポイントで DOI をクエリとして検索
        const searchResp = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedDoi}&limit=5&fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
          { headers: s2Headers() }
        );

        console.log(
          `[CITATION MAP] Search endpoint status: ${searchResp.status}`
        );

        if (!searchResp.ok) {
          console.log(
            `[CITATION MAP] Search endpoint failed, trying URL format`
          );
          // さらにフォールバック: DOI の URL 形式で解決
          const urlResp = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(
              `https://doi.org/${doi.trim()}`
            )}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
            { headers: s2Headers() }
          );
          console.log(`[CITATION MAP] URL format status: ${urlResp.status}`);

          if (!urlResp.ok) {
            console.log(`[CITATION MAP] All methods failed for DOI: ${doi}`);
            return null;
          }

          const udata = await urlResp.json();
          console.log(`[CITATION MAP] URL format result:`, udata);
          const uhit = udata;
          if (!uhit?.paperId) {
            console.log(`[CITATION MAP] No paperId found in URL format result`);
            return null;
          }
          return this.formatPaperData(uhit);
        }

        const sdata = await searchResp.json();
        console.log(`[CITATION MAP] Search results:`, sdata);

        const hit =
          (sdata.data || []).find(
            (p: any) => (p.doi || "").toLowerCase() === doi.trim().toLowerCase()
          ) || (sdata.data || [])[0];

        if (!hit) {
          console.log(
            `[CITATION MAP] No matching paper found in search results`
          );
          return null;
        }

        console.log(`[CITATION MAP] Found paper via search:`, hit);
        return this.formatPaperData(hit);
      }

      const data = await response.json();
      console.log(`[CITATION MAP] Direct DOI search success:`, data);

      return this.formatPaperData(data);
    } catch (error) {
      console.error("Get paper by DOI error:", error);
      return null;
    }
  }

  // paperIdから直接論文を取得するメソッド
  private async getPaperByPaperId(paperId: string): Promise<Paper | null> {
    try {
      console.log(`[CITATION MAP] Fetching paper for paperId: ${paperId}`);
      
      // APIキーの有無に応じて待機時間を調整
      const hasApiKey = !!process.env.SEMANTIC_SCHOLAR_API_KEY;
      const initialWaitTime = hasApiKey ? 2000 : 3000; // APIキーあり: 2秒、なし: 3秒
      await new Promise((resolve) => setTimeout(resolve, initialWaitTime));

      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
        { headers: s2Headers() }
      );

      console.log(`[CITATION MAP] PaperId API response status: ${response.status}`);

      if (!response.ok) {
        // エラーレスポンスの詳細を取得
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error(`[CITATION MAP] API error response:`, errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error(`[CITATION MAP] API error text:`, errorText);
          errorMessage = errorText || errorMessage;
        }

        if (response.status === 429) {
          // レート制限の場合は長めに待機（10-15秒）
          const waitTime = hasApiKey ? 10000 : 15000;
          console.log(`[CITATION MAP] Rate limited, waiting ${waitTime / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          
          // 再試行（最大3回）
          for (let retryCount = 0; retryCount < 3; retryCount++) {
            const retryWaitTime = hasApiKey ? 2000 : 3000;
            await new Promise((resolve) => setTimeout(resolve, retryWaitTime));
            
            const retryResponse = await fetch(
              `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
              { headers: s2Headers() }
            );
            console.log(`[CITATION MAP] Retry ${retryCount + 1}/3 response status: ${retryResponse.status}`);
            
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              console.log(`[CITATION MAP] Retry success for paperId: ${paperId}`);
              return this.formatPaperData(data);
            } else if (retryResponse.status === 429) {
              // まだレート制限の場合はさらに待機
              const additionalWait = hasApiKey ? 10000 : 15000;
              console.log(`[CITATION MAP] Still rate limited, waiting ${additionalWait / 1000} more seconds...`);
              await new Promise((resolve) => setTimeout(resolve, additionalWait));
              continue;
            } else {
              // 429以外のエラーの場合はリトライを中止
              let retryErrorMessage = `HTTP ${retryResponse.status}`;
              try {
                const retryErrorData = await retryResponse.json();
                retryErrorMessage = retryErrorData.message || retryErrorData.error || retryErrorMessage;
              } catch (e) {
                // ignore
              }
              console.error(`[CITATION MAP] Retry ${retryCount + 1} failed for paperId ${paperId}: ${retryErrorMessage}`);
              if (retryCount === 2) {
                return null;
              }
            }
          }
          
          // すべてのリトライが失敗した場合
          console.error(`[CITATION MAP] All retries failed for paperId ${paperId} due to rate limiting`);
          return null;
        }

        // 404エラーの場合
        if (response.status === 404) {
          console.error(`[CITATION MAP] Paper not found for paperId: ${paperId} (404)`);
          return null;
        }

        console.error(`[CITATION MAP] Failed to fetch paper by paperId: ${paperId}, status: ${response.status}, error: ${errorMessage}`);
        return null;
      }

      const data = await response.json();
      console.log(`[CITATION MAP] Successfully fetched paper for paperId: ${paperId}, title: ${data.title?.substring(0, 50)}`);
      
      // データの検証
      if (!data.paperId) {
        console.error(`[CITATION MAP] Invalid response: paperId is missing`, data);
        return null;
      }

      return this.formatPaperData(data);
    } catch (error) {
      console.error(`[CITATION MAP] Get paper by paperId error for ${paperId}:`, error);
      return null;
    }
  }

  // 論文データをフォーマットする共通メソッド
  private formatPaperData(data: any): Paper {
    return {
      id: data.paperId,
      paperId: data.paperId,
      title: data.title || "タイトルなし",
      authors: data.authors || [], // 配列として保存
      year: data.year || new Date().getFullYear(),
      abstract: data.abstract || "要約なし",
      url: data.url || `https://www.semanticscholar.org/paper/${data.paperId}`,
      citationCount: data.citationCount || 0,
      venue: data.venue || "ジャーナル不明",
      isOpenAccess: data.isOpenAccess || false,
      doi: data.doi,
      source: "semantic_scholar",
    };
  }

  // 引用された論文を取得
  private async getCitedByPapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?limit=100&fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      console.log(`[CITATION MAP] Citations response:`, data);

      return (data.data || [])
        .map((citation: any) => {
          // 引用された論文の構造を確認して適切にアクセス
          const paper = citation.citingPaper || citation;

          // paperIdがnullまたは空の場合はスキップ
          if (!paper || !paper.paperId || paper.paperId === null) {
            return null;
          }

          // タイトルが空または無効な場合はスキップ
          if (
            !paper.title ||
            paper.title.trim() === "" ||
            paper.title.includes("Peer review information")
          ) {
            return null;
          }

          return {
            id: paper.paperId,
            paperId: paper.paperId,
            title: paper.title || "タイトルなし",
            authors: paper.authors || [], // 配列として保存
            year: paper.year || new Date().getFullYear(),
            abstract: paper.abstract || "要約なし",
            url:
              paper.url ||
              `https://www.semanticscholar.org/paper/${paper.paperId}`,
            citationCount: paper.citationCount || 0,
            venue: paper.venue || "ジャーナル不明",
            isOpenAccess: paper.isOpenAccess || false,
            doi: paper.doi,
            source: "semantic_scholar",
          };
        })
        .filter(Boolean); // null値を除外
    } catch (error) {
      console.error("Get cited by papers error:", error);
      return [];
    }
  }

  // 参考文献を取得
  private async getReferencePapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/references?limit=100&fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      console.log(`[CITATION MAP] References response:`, data);

      return (data.data || [])
        .map((reference: any) => {
          // 参考文献の構造を確認して適切にアクセス
          // Semantic Scholar APIの参考文献は citedPaper フィールドを使用
          const paper = reference.citedPaper || reference.paper || reference;

          // paperIdがnullまたは空の場合はスキップ
          if (!paper || !paper.paperId || paper.paperId === null) {
            return null;
          }

          // タイトルが空または無効な場合はスキップ
          if (
            !paper.title ||
            paper.title.trim() === "" ||
            paper.title.includes("Peer review information")
          ) {
            return null;
          }

          return {
            id: paper.paperId,
            paperId: paper.paperId,
            title: paper.title || "タイトルなし",
            authors: paper.authors || [], // 配列として保存
            year: paper.year || new Date().getFullYear(),
            abstract: paper.abstract || "要約なし",
            url:
              paper.url ||
              `https://www.semanticscholar.org/paper/${paper.paperId}`,
            citationCount: paper.citationCount || 0,
            venue: paper.venue || "ジャーナル不明",
            isOpenAccess: paper.isOpenAccess || false,
            doi: paper.doi,
            source: "semantic_scholar",
          };
        })
        .filter(Boolean); // null値を除外
    } catch (error) {
      console.error("Get reference papers error:", error);
      return [];
    }
  }

  // 間接的接続を探索
  private async findIndirectConnections(paperId: string): Promise<Paper[]> {
    try {
      // 引用された論文の一部を取得
      const citedBy = await this.getCitedByPapers(paperId);
      const references = await this.getReferencePapers(paperId);

      // 引用された論文の参考文献を探索
      const indirectPapers: Paper[] = [];

      for (const paper of citedBy.slice(0, 10)) {
        // 上位10件のみ
        const paperReferences = await this.getReferencePapers(paper.paperId);
        indirectPapers.push(...paperReferences.slice(0, 5)); // 各論文から5件まで
      }

      // 重複除去
      const uniquePapers = indirectPapers.filter(
        (paper, index, self) =>
          index === self.findIndex((p) => p.paperId === paper.paperId)
      );

      return uniquePapers;
    } catch (error) {
      console.error("Find indirect connections error:", error);
      return [];
    }
  }

  // ネットワークメトリクスを計算
  private calculateNetworkMetrics(
    center: Paper,
    citedBy: Paper[],
    references: Paper[]
  ): NetworkMetrics {
    const totalPapers = citedBy.length + references.length;

    if (totalPapers === 0) {
      return {
        centrality: 0,
        betweenness: 0,
        clustering: 0,
        density: 0,
        pathLength: 0,
      };
    }

    // 中心性（引用数に基づく）
    const centrality = center.citationCount || 0;

    // 媒介中心性（簡略化）
    const betweenness = citedBy.length / totalPapers;

    // クラスタリング係数（簡略化）
    const clustering = Math.min(1, citedBy.length / 100);

    // 密度（接続の密度）
    const density = totalPapers / ((totalPapers * (totalPapers - 1)) / 2);

    // 平均経路長（簡略化）
    const pathLength = Math.log(totalPapers + 1);

    return {
      centrality,
      betweenness,
      clustering,
      density,
      pathLength,
    };
  }

  // 引用マップの可視化データを生成
  generateVisualizationData(citationMap: CitationMap): {
    nodes: Array<{
      id: string;
      label: string;
      group: "center" | "citedBy" | "references" | "indirect";
      size: number;
      color: string;
      x?: number;
      y?: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: "citation" | "reference" | "indirect";
      weight: number;
    }>;
  } {
    const nodes: Array<{
      id: string;
      label: string;
      group: "center" | "citedBy" | "references" | "indirect";
      size: number;
      color: string;
      x?: number;
      y?: number;
    }> = [];
    const edges: Array<{
      source: string;
      target: string;
      type: "citation" | "reference" | "indirect";
      weight: number;
    }> = [];

    // 中心ノード
    nodes.push({
      id: citationMap.center.paperId,
      label: citationMap.center.title.substring(0, 50) + "...",
      group: "center",
      size: 20,
      color: "#ff6b6b",
    });

    // 引用された論文ノード
    citationMap.citedBy.forEach((paper, index) => {
      nodes.push({
        id: paper.paperId,
        label: paper.title.substring(0, 30) + "...",
        group: "citedBy",
        size: Math.min(15, Math.max(5, (paper.citationCount || 0) / 10)),
        color: "#4ecdc4",
      });

      edges.push({
        source: paper.paperId,
        target: citationMap.center.paperId,
        type: "citation",
        weight: 1,
      });
    });

    // 参考文献ノード
    citationMap.references.forEach((paper, index) => {
      nodes.push({
        id: paper.paperId,
        label: paper.title.substring(0, 30) + "...",
        group: "references",
        size: Math.min(15, Math.max(5, (paper.citationCount || 0) / 10)),
        color: "#45b7d1",
      });

      edges.push({
        source: citationMap.center.paperId,
        target: paper.paperId,
        type: "reference",
        weight: 1,
      });
    });

    // 間接接続ノード
    citationMap.indirectConnections.forEach((paper, index) => {
      nodes.push({
        id: paper.paperId,
        label: paper.title.substring(0, 30) + "...",
        group: "indirect",
        size: Math.min(10, Math.max(3, (paper.citationCount || 0) / 20)),
        color: "#96ceb4",
      });
    });

    return { nodes, edges };
  }

  // キャッシュクリア
  clearCache(): void {
    this.cache.clear();
  }

  // キャッシュ統計
  getCacheStats(): {
    size: number;
    keys: string[];
    oldestEntry: number;
    newestEntry: number;
  } {
    const keys = Array.from(this.cache.keys());
    return {
      size: this.cache.size,
      keys,
      oldestEntry: 0,
      newestEntry: 0,
    };
  }
}

// シングルトンインスタンス
export const citationMapGenerator = new CitationMapGenerator();
