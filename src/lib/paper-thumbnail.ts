// 論文固有のサムネイル画像を取得する機能

interface PaperImageResult {
  thumbnailUrl: string | null;
  source: string;
}

// Semantic Scholar APIから論文の画像を取得
export async function getSemanticScholarThumbnail(
  paperId: string
): Promise<PaperImageResult> {
  try {
    console.log(`Fetching Semantic Scholar thumbnail for paper: ${paperId}`);

    const response = await fetch(
      `https://api.semanticscholar.org/v1/paper/${paperId}`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool/1.0 (https://research-ai-tool.com)",
        },
      }
    );

    if (!response.ok) {
      console.warn(`Semantic Scholar API error: ${response.status}`);
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Semantic Scholar data for ${paperId}:`, {
      hasOpenAccessPdf: !!data.openAccessPdf?.url,
      figuresCount: data.figures?.length || 0,
      hasThumbnail: !!data.thumbnail,
    });

    // 論文のサムネイルを探す
    if (data.thumbnail) {
      return {
        thumbnailUrl: data.thumbnail,
        source: "semantic-scholar-thumbnail",
      };
    }

    // 論文の図表を探す
    if (data.figures && data.figures.length > 0) {
      const firstFigure = data.figures[0];
      if (firstFigure.url) {
        return {
          thumbnailUrl: firstFigure.url,
          source: "semantic-scholar-figure",
        };
      }
    }

    // PDFの最初のページを画像として使用
    if (data.openAccessPdf?.url) {
      return {
        thumbnailUrl: `https://api.semanticscholar.org/v1/paper/${paperId}/thumbnail`,
        source: "semantic-scholar-pdf-thumbnail",
      };
    }

    return {
      thumbnailUrl: null,
      source: "semantic-scholar-no-image",
    };
  } catch (error) {
    console.warn("Semantic Scholar thumbnail fetch failed:", error);
    return {
      thumbnailUrl: null,
      source: "semantic-scholar-error",
    };
  }
}

// DOIから論文IDを抽出してSemantic Scholar画像を取得
export async function getThumbnailFromDOI(
  doi: string
): Promise<PaperImageResult> {
  try {
    // DOIを正規化
    const normalizedDoi = doi
      .replace(/^https?:\/\/dx\.doi\.org\//, "")
      .replace(/^doi:/, "");

    // レート制限対応のため遅延を追加
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Semantic Scholar APIで論文を検索
    const searchResponse = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        normalizedDoi
      )}&limit=1`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool/1.0 (https://research-ai-tool.com)",
        },
      }
    );

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        console.warn(
          "Semantic Scholar rate limit reached, skipping DOI search"
        );
        return {
          thumbnailUrl: null,
          source: "semantic-scholar-rate-limit",
        };
      }
      throw new Error(
        `Semantic Scholar search error: ${searchResponse.status}`
      );
    }

    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      const paper = searchData.data[0];
      return await getSemanticScholarThumbnail(paper.paperId);
    }

    return {
      thumbnailUrl: null,
      source: "semantic-scholar-no-paper",
    };
  } catch (error) {
    console.warn("DOI thumbnail fetch failed:", error);
    return {
      thumbnailUrl: null,
      source: "doi-error",
    };
  }
}

// 論文タイトルからSemantic Scholar画像を取得
export async function getThumbnailFromTitle(
  title: string
): Promise<PaperImageResult> {
  try {
    // レート制限対応のため遅延を追加
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 論文タイトルでSemantic Scholar APIを検索
    const searchResponse = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        title
      )}&limit=1`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool/1.0 (https://research-ai-tool.com)",
        },
      }
    );

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        console.warn(
          "Semantic Scholar rate limit reached, skipping title search"
        );
        return {
          thumbnailUrl: null,
          source: "semantic-scholar-rate-limit",
        };
      }
      throw new Error(
        `Semantic Scholar search error: ${searchResponse.status}`
      );
    }

    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      const paper = searchData.data[0];
      return await getSemanticScholarThumbnail(paper.paperId);
    }

    return {
      thumbnailUrl: null,
      source: "semantic-scholar-no-match",
    };
  } catch (error) {
    console.warn("Title thumbnail fetch failed:", error);
    return {
      thumbnailUrl: null,
      source: "title-error",
    };
  }
}

// 論文のHTMLから実際の図表を抽出
export async function extractFigureFromHtml(
  htmlUrl: string
): Promise<string | null> {
  try {
    console.log(
      `[HTML FIGURE EXTRACTION] Starting extraction from: ${htmlUrl}`
    );

    const response = await fetch(htmlUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    console.log(`[HTML FIGURE EXTRACTION] Response status: ${response.status}`);

    if (!response.ok) {
      console.warn(
        `[HTML FIGURE EXTRACTION] HTML fetch failed: ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    console.log(
      `[HTML FIGURE EXTRACTION] HTML length: ${html.length} characters`
    );

    // Fig 1の画像を探す（複数のパターンを試行）
    const figurePatterns = [
      // Nature風のパターン
      /<img[^>]*src="([^"]*)"[^>]*alt="[^"]*[Ff]ig[^"]*1[^"]*"/i,
      /<img[^>]*alt="[^"]*[Ff]ig[^"]*1[^"]*"[^>]*src="([^"]*)"/i,
      // 一般的なパターン
      /<img[^>]*src="([^"]*)"[^>]*class="[^"]*figure[^"]*"/i,
      /<img[^>]*class="[^"]*figure[^"]*"[^>]*src="([^"]*)"/i,
      // Fig 1のキャプション周辺の画像
      /<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<figcaption[^>]*>[^<]*[Ff]ig[^<]*1/i,
      // より広範囲な画像検索
      /<img[^>]*src="([^"]*)"[^>]*>/gi,
      // より具体的なNatureパターン
      /<img[^>]*src="([^"]*\.jpg[^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*\.png[^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*\.jpeg[^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*\.webp[^"]*)"[^>]*>/i,
      // Nature特有のパターン
      /<img[^>]*src="([^"]*nature[^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*fig[^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*figure[^"]*)"[^>]*>/i,
    ];

    console.log(
      `[HTML FIGURE EXTRACTION] Testing ${figurePatterns.length} patterns...`
    );

    for (let i = 0; i < figurePatterns.length; i++) {
      const pattern = figurePatterns[i];
      console.log(
        `[HTML FIGURE EXTRACTION] Testing pattern ${i + 1}: ${pattern}`
      );

      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];
        console.log(
          `[HTML FIGURE EXTRACTION] Found potential image URL: ${imageUrl}`
        );

        // 相対URLを絶対URLに変換
        if (imageUrl.startsWith("//")) {
          imageUrl = "https:" + imageUrl;
        } else if (imageUrl.startsWith("/")) {
          const baseUrl = new URL(htmlUrl);
          imageUrl = baseUrl.origin + imageUrl;
        } else if (!imageUrl.startsWith("http")) {
          const baseUrl = new URL(htmlUrl);
          imageUrl = baseUrl.origin + "/" + imageUrl;
        }

        console.log(`[HTML FIGURE EXTRACTION] Final image URL: ${imageUrl}`);
        return imageUrl;
      }
    }

    console.log("[HTML FIGURE EXTRACTION] No figure images found in HTML");
    return null;
  } catch (error) {
    console.warn("HTML figure extraction failed:", error);
    return null;
  }
}

// PDFから最初のページを画像として取得
export async function extractFirstPageFromPdf(
  pdfUrl: string
): Promise<string | null> {
  try {
    console.log(`Extracting first page from PDF: ${pdfUrl}`);

    // PDF.jsを使用してPDFの最初のページを画像に変換
    // 注意: これはサーバーサイドで実行されるため、canvasが必要
    // 現在は簡易的な実装として、PDF URLをそのまま返す
    // 実際の実装ではPDF.jsやcanvasライブラリを使用

    return null; // 現在は未実装
  } catch (error) {
    console.warn("PDF first page extraction failed:", error);
    return null;
  }
}

// DOIやHTML URLから直接的な図表URLを生成
export async function getDirectFigureUrl(
  doi?: string,
  htmlUrl?: string
): Promise<string | null> {
  try {
    // DOIがある場合の各ジャーナル論文の図表URL生成
    if (doi) {
      // Nature論文の場合
      if (doi.includes("10.1038/")) {
        // Nature論文の図表URLパターン（複数パターンを試行）
        const patterns = [
          `https://media.springernature.com/lw685/springer-static/image/art%3A${doi.replace(
            ":",
            "%3A"
          )}/MediaObjects/${doi.replace(":", "_")}_Fig1_HTML.jpg`,
          `https://media.springernature.com/lw685/springer-static/image/art%3A${doi.replace(
            ":",
            "%3A"
          )}/MediaObjects/${doi.replace(":", "_")}_Fig1.jpg`,
          `https://www.nature.com/articles/${
            doi.split("10.1038/")[1]
          }/figures/1`,
        ];

        for (const pattern of patterns) {
          console.log(`[DIRECT FIGURE] Trying Nature pattern: ${pattern}`);
          return pattern; // 最初のパターンを返す（実際の検証は後で行う）
        }
      }

      // Science論文の場合
      if (doi.includes("10.1126/")) {
        const scienceFigureUrl = `https://www.science.org/cms/10.1126/${
          doi.split("10.1126/")[1]
        }/asset/${doi.split("10.1126/")[1]}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated Science figure URL: ${scienceFigureUrl}`
        );
        return scienceFigureUrl;
      }

      // Cell論文の場合
      if (doi.includes("10.1016/")) {
        const cellFigureUrl = `https://www.cell.com/cms/asset/${doi.replace(
          ":",
          "_"
        )}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated Cell figure URL: ${cellFigureUrl}`
        );
        return cellFigureUrl;
      }

      // PNAS論文の場合
      if (doi.includes("10.1073/")) {
        const pnasFigureUrl = `https://www.pnas.org/cms/asset/${doi.replace(
          ":",
          "_"
        )}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated PNAS figure URL: ${pnasFigureUrl}`
        );
        return pnasFigureUrl;
      }

      // PLOS論文の場合
      if (doi.includes("10.1371/")) {
        const plosFigureUrl = `https://journals.plos.org/plosone/article/figure/image?id=${doi.replace(
          ":",
          "_"
        )}&type=large`;
        console.log(
          `[DIRECT FIGURE] Generated PLOS figure URL: ${plosFigureUrl}`
        );
        return plosFigureUrl;
      }

      // BioRxiv論文の場合
      if (doi.includes("10.1101/")) {
        const bioRxivFigureUrl = `https://www.biorxiv.org/content/${doi.replace(
          ":",
          "_"
        )}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated BioRxiv figure URL: ${bioRxivFigureUrl}`
        );
        return bioRxivFigureUrl;
      }
    }

    // HTML URLがある場合の直接的な図表URL生成
    if (htmlUrl) {
      // Nature論文の場合
      if (htmlUrl.includes("nature.com/articles/")) {
        const articleId = htmlUrl.split("/articles/")[1];
        const patterns = [
          `https://www.nature.com/articles/${articleId}/figures/1`,
          `https://media.springernature.com/lw685/springer-static/image/art%3A${articleId}/MediaObjects/${articleId}_Fig1_HTML.jpg`,
        ];

        for (const pattern of patterns) {
          console.log(`[DIRECT FIGURE] Trying Nature HTML pattern: ${pattern}`);
          return pattern;
        }
      }

      // Science論文の場合
      if (htmlUrl.includes("science.org/content/")) {
        const articleId = htmlUrl.split("/content/")[1];
        const scienceFigureUrl = `https://www.science.org/cms/${articleId}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated Science HTML figure URL: ${scienceFigureUrl}`
        );
        return scienceFigureUrl;
      }

      // Cell論文の場合
      if (htmlUrl.includes("cell.com/cell/")) {
        const articleId = htmlUrl.split("/cell/")[1];
        const cellFigureUrl = `https://www.cell.com/cms/asset/${articleId}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated Cell HTML figure URL: ${cellFigureUrl}`
        );
        return cellFigureUrl;
      }

      // PLOS論文の場合
      if (htmlUrl.includes("journals.plos.org/")) {
        const articleId =
          htmlUrl.split("id=")[1] || htmlUrl.split("/article/")[1];
        const plosFigureUrl = `https://journals.plos.org/plosone/article/figure/image?id=${articleId}&type=large`;
        console.log(
          `[DIRECT FIGURE] Generated PLOS HTML figure URL: ${plosFigureUrl}`
        );
        return plosFigureUrl;
      }

      // BioRxiv論文の場合
      if (htmlUrl.includes("biorxiv.org/content/")) {
        const articleId = htmlUrl.split("/content/")[1];
        const bioRxivFigureUrl = `https://www.biorxiv.org/content/${articleId}/fig1.jpg`;
        console.log(
          `[DIRECT FIGURE] Generated BioRxiv HTML figure URL: ${bioRxivFigureUrl}`
        );
        return bioRxivFigureUrl;
      }
    }

    return null;
  } catch (error) {
    console.warn(
      "[DIRECT FIGURE] Failed to generate direct figure URL:",
      error
    );
    return null;
  }
}

// 論文の内容に基づいたサムネイルを生成（フォールバック用）
export async function getContentBasedThumbnail(
  title?: string
): Promise<string> {
  if (!title) {
    return getDefaultThumbnail();
  }

  // 論文の内容に基づいて色を決定
  const titleLower = title.toLowerCase();

  // 分野別の色分け
  if (
    titleLower.includes("neural") ||
    titleLower.includes("deep learning") ||
    titleLower.includes("transformer")
  ) {
    return `https://dummyimage.com/200x280/7C3AED/FFFFFF&text=AI%20%26%20ML`;
  }
  if (
    titleLower.includes("cell") ||
    titleLower.includes("biology") ||
    titleLower.includes("protein")
  ) {
    return `https://dummyimage.com/200x280/059669/FFFFFF&text=Biology`;
  }
  if (
    titleLower.includes("brain") ||
    titleLower.includes("neural") ||
    titleLower.includes("cognitive")
  ) {
    return `https://dummyimage.com/200x280/0891B2/FFFFFF&text=Neuroscience`;
  }
  if (
    titleLower.includes("cancer") ||
    titleLower.includes("disease") ||
    titleLower.includes("medical")
  ) {
    return `https://dummyimage.com/200x280/DC2626/FFFFFF&text=Medicine`;
  }
  if (
    titleLower.includes("quantum") ||
    titleLower.includes("physics") ||
    titleLower.includes("material")
  ) {
    return `https://dummyimage.com/200x280/4F46E5/FFFFFF&text=Physics`;
  }
  if (
    titleLower.includes("climate") ||
    titleLower.includes("environment") ||
    titleLower.includes("ecology")
  ) {
    return `https://dummyimage.com/200x280/65A30D/FFFFFF&text=Environment`;
  }

  // デフォルトのサムネイルを生成
  return getDefaultThumbnail(title);
}

// デフォルトのサムネイルを生成
export async function getDefaultThumbnail(title?: string): Promise<string> {
  const colors = [
    "4F46E5", // Indigo
    "059669", // Emerald
    "DC2626", // Red
    "EA580C", // Orange
    "7C3AED", // Violet
    "0891B2", // Cyan
    "BE185D", // Pink
    "65A30D", // Lime
  ];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const shortTitle = title?.substring(0, 15) || "Paper";
  return `https://dummyimage.com/200x280/${randomColor}/FFFFFF&text=${encodeURIComponent(
    shortTitle
  )}`;
}

// メインのサムネイル取得関数
export async function getPaperThumbnail(
  doi?: string,
  title?: string,
  htmlUrl?: string,
  pdfUrl?: string
): Promise<string> {
  console.log(
    `Getting thumbnail for DOI: ${doi}, Title: ${title}, HTML: ${htmlUrl}, PDF: ${pdfUrl}`
  );

  // 1. 直接的な図表URL生成を試行
  if (doi || htmlUrl) {
    try {
      const directFigureUrl = await getDirectFigureUrl(doi, htmlUrl);
      if (directFigureUrl) {
        console.log(`Found direct figure URL: ${directFigureUrl}`);
        return directFigureUrl;
      }
    } catch (error) {
      console.warn("Direct figure URL generation failed:", error);
    }
  }

  // 2. HTML URLから実際の図表を抽出
  if (htmlUrl) {
    try {
      const figureUrl = await extractFigureFromHtml(htmlUrl);
      if (figureUrl) {
        console.log(`Found figure from HTML: ${figureUrl}`);
        return figureUrl;
      }
    } catch (error) {
      console.warn("HTML figure extraction failed:", error);
    }
  }

  // 2. PDF URLから最初のページを取得
  if (pdfUrl) {
    try {
      const firstPageUrl = await extractFirstPageFromPdf(pdfUrl);
      if (firstPageUrl) {
        console.log(`Found first page from PDF: ${firstPageUrl}`);
        return firstPageUrl;
      }
    } catch (error) {
      console.warn("PDF first page extraction failed:", error);
    }
  }

  // 3. DOIがある場合はDOIから取得を試行
  if (doi) {
    try {
      const doiResult = await getThumbnailFromDOI(doi);
      if (doiResult.thumbnailUrl) {
        console.log(`Found thumbnail from DOI: ${doiResult.source}`);
        return doiResult.thumbnailUrl;
      }
    } catch (error) {
      console.warn("DOI thumbnail fetch failed:", error);
    }
  }

  // 4. タイトルがある場合はタイトルから取得を試行
  if (title) {
    try {
      const titleResult = await getThumbnailFromTitle(title);
      if (titleResult.thumbnailUrl) {
        console.log(`Found thumbnail from title: ${titleResult.source}`);
        return titleResult.thumbnailUrl;
      }
    } catch (error) {
      console.warn("Title thumbnail fetch failed:", error);
    }
  }

  // 5. 内容に基づいたサムネイルを生成（フォールバック）
  console.log("Using content-based thumbnail as fallback");
  return await getContentBasedThumbnail(title);
}
