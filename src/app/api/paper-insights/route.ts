import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";
import { fetchHtmlPlainText, extractHtmlContexts } from "@/lib/paper-content";
import { aiProviderManager } from "@/lib/ai-provider-manager";
import { supabaseAdmin } from "@/lib/supabase";
import { PaperAIInsights } from "@/types";
import { ensurePaperEmbeddings } from "@/lib/paper-ingest";

interface PaperInsightsRequestBody {
  paperId?: string;
  userId?: string;
  fallback?: {
    title?: string;
    abstract?: string;
    authors?: string;
    venue?: string;
    year?: number;
    url?: string;
    htmlUrl?: string;
  };
}

async function fetchFallbackPlainText(
  fallback?: PaperInsightsRequestBody["fallback"]
): Promise<string | null> {
  const htmlUrl = fallback?.htmlUrl ?? fallback?.url;
  if (!htmlUrl) return null;
  const text = await fetchHtmlPlainText(htmlUrl);
  if (!text) return null;
  return text.slice(0, 20000);
}

function buildInsightsPrompt({
  fallback,
  articleText,
  paperId,
}: {
  fallback?: PaperInsightsRequestBody["fallback"];
  articleText?: string | null;
  paperId?: string;
}): string {
  const pieces: string[] = [];

  if (fallback?.title) pieces.push(`タイトル: ${fallback.title}`);
  if (fallback?.authors) pieces.push(`著者: ${fallback.authors}`);
  if (fallback?.venue) pieces.push(`ジャーナル: ${fallback.venue}`);
  if (fallback?.year) pieces.push(`発行年: ${fallback.year}`);
  if (fallback?.abstract) pieces.push(`抄録: ${fallback.abstract}`);
  if (articleText) pieces.push(`本文抜粋: ${articleText.slice(0, 9000)}`);

  return `以下の学術論文情報を読み取り、図表の説明は各図のキャプション（legend）や本文内の記述に厳密に基づいてまとめてください。該当する説明が見つからない場合は、その旨を明記し、推測で補わないでください。落合方式（Overview、Background、Method、Results、Discussion、Future Work）でレビューも併記してください。

出力フォーマット(JSON形式):
{
  "figureInsights": [
    "Figure 1 caption から得られる内容と補足",
    ...
  ],
  "ochiaiReview": {
    "overview": string,
    "background": string,
    "method": string,
    "results": string,
    "discussion": string,
    "futureWork": string
  },
  "caveats": string[],
  "sources": string[]
}

論文識別子: ${paperId ?? "不明"}
${pieces.join("\n")}`;
}

function parseInsights(rawText: string): PaperAIInsights {
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return {
    figureInsights: parsed.figureInsights || [],
    ochiaiReview: parsed.ochiaiReview || {
      overview: "",
      background: "",
      method: "",
      results: "",
      discussion: "",
      futureWork: "",
    },
    caveats: parsed.caveats || [],
    sources: parsed.sources || [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaperInsightsRequestBody;

    if (!body.paperId && !body.fallback?.url && !body.fallback?.abstract) {
      return NextResponse.json(
        { error: "論文識別子または補助情報が必要です" },
        { status: 400 }
      );
    }

    const plainText = await fetchFallbackPlainText(body.fallback);

    const prompt = buildInsightsPrompt({
      fallback: body.fallback,
      articleText: plainText,
      paperId: body.paperId,
    });

    const rawText = await callGemini(prompt);

    if (!rawText) {
      throw new Error("AIからの応答が空でした");
    }

    const insights = parseInsights(rawText);

    if (body.paperId) {
      await ensurePaperEmbeddings({
        paperId: body.paperId,
        htmlUrl: body.fallback?.htmlUrl ?? body.fallback?.url ?? null,
        pdfUrl: undefined,
        fallbackText: plainText ?? undefined,
        force: false,
      });
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error("Paper insights error", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error:
            "AI応答の解析に失敗しました。再試行するか、後でお試しください。",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "AI解説の生成に失敗しました" },
      { status: 500 }
    );
  }
}
