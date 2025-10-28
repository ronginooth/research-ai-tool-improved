import { NextRequest, NextResponse } from "next/server";
import { extractFigureFromHtml } from "@/lib/paper-thumbnail";

export async function POST(request: NextRequest) {
  try {
    const { htmlUrl } = await request.json();

    if (!htmlUrl) {
      return NextResponse.json(
        { error: "HTML URLが必要です" },
        { status: 400 }
      );
    }

    console.log(`[DEBUG] Starting HTML extraction test for: ${htmlUrl}`);

    // HTMLの内容も取得して返す
    const response = await fetch(htmlUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        htmlUrl,
        figureUrl: null,
        success: false,
        error: `HTTP ${response.status}`,
      });
    }

    const html = await response.text();
    const figureUrl = await extractFigureFromHtml(htmlUrl);

    // HTMLの一部を返す（最初の1000文字）
    const htmlPreview = html.substring(0, 1000);
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const figureTags = html.match(/<figure[^>]*>[\s\S]*?<\/figure>/gi) || [];

    return NextResponse.json({
      htmlUrl,
      figureUrl,
      success: true,
      htmlLength: html.length,
      htmlPreview,
      imgTags: imgTags.slice(0, 5), // 最初の5つのimgタグ
      figureTags: figureTags.slice(0, 2), // 最初の2つのfigureタグ
    });
  } catch (error) {
    console.error("[DEBUG] HTML extraction test error:", error);
    return NextResponse.json(
      {
        error: "HTML抽出テスト中にエラーが発生しました",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
