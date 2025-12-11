import { NextRequest, NextResponse } from "next/server";
import { s2Headers } from "@/lib/semantic-scholar";

/**
 * Semantic Scholar APIキーの診断用エンドポイント
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const headers = s2Headers();

    // 1. 環境変数の確認
    const envCheck = {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey ? `${apiKey.substring(0, 4)}...` : "なし",
    };

    // 2. ヘッダーの確認
    const headerCheck = {
      hasXApiKey: !!headers["x-api-key"],
      headerKeys: Object.keys(headers),
      userAgent: headers["User-Agent"],
    };

    // 3. 実際のAPIリクエストをテスト
    let apiTest: {
      success: boolean;
      status?: number;
      message?: string;
      response?: any;
    } = { success: false };

    try {
      const testResponse = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/search?query=kinesin&limit=1&fields=paperId,title",
        {
          headers,
        }
      );

      apiTest = {
        success: testResponse.ok,
        status: testResponse.status,
        message: testResponse.statusText,
      };

      if (testResponse.ok) {
        const data = await testResponse.json();
        apiTest.response = {
          total: data.total || 0,
          hasData: !!data.data && Array.isArray(data.data),
          dataCount: data.data?.length || 0,
        };
      } else {
        const errorText = await testResponse.text().catch(() => "");
        apiTest.message = errorText || testResponse.statusText;
      }
    } catch (error) {
      apiTest.message =
        error instanceof Error ? error.message : "Unknown error";
    }

    // 4. 推奨事項
    const recommendations: string[] = [];

    if (!envCheck.hasApiKey) {
      recommendations.push(
        ".env.localファイルにSEMANTIC_SCHOLAR_API_KEYを設定してください"
      );
    } else if (envCheck.keyLength < 20) {
      recommendations.push(
        "APIキーの長さが短すぎます。正しいAPIキーか確認してください"
      );
    }

    if (!headerCheck.hasXApiKey) {
      recommendations.push("ヘッダーにx-api-keyが含まれていません");
    }

    if (apiTest.status === 403 || apiTest.status === 401) {
      recommendations.push(
        "APIキーが無効または期限切れの可能性があります。Semantic Scholarのダッシュボードで確認してください"
      );
    }

    if (apiTest.status === 429) {
      recommendations.push(
        "レート制限に達しています。しばらく待ってから再試行してください"
      );
    }

    return NextResponse.json({
      success: true,
      diagnostics: {
        environment: envCheck,
        headers: headerCheck,
        apiTest,
      },
      recommendations,
      summary: {
        apiKeyConfigured: envCheck.hasApiKey,
        headerCorrect: headerCheck.hasXApiKey,
        apiWorking: apiTest.success,
        status: apiTest.status,
      },
    });
  } catch (error) {
    console.error("[Test Semantic Key] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "診断中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}


