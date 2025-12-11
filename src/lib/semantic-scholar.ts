export function s2Headers(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Research-AI-Tool-Improved/2.0",
  };
  
  // TODO: 一時的にAPIキーを無効化（将来的に戻す可能性あり）
  // Semantic Scholar APIキーを使用しない仕様に変更
  // 将来的にAPIキーを有効化する場合は、以下のコメントを外す
  /*
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    headers["x-api-key"] = apiKey.trim();
  }
  */
  
  return headers;
}

/**
 * Semantic Scholar APIキーの有効性をテスト
 * @returns APIキーが有効な場合true、無効または未設定の場合false
 */
export async function testSemanticScholarApiKey(): Promise<{
  valid: boolean;
  hasKey: boolean;
  status?: number;
  message?: string;
}> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      valid: false,
      hasKey: false,
      message: "APIキーが設定されていません",
    };
  }

  try {
    const headers = s2Headers();
    const response = await fetch(
      "https://api.semanticscholar.org/graph/v1/paper/search?query=test&limit=1&fields=paperId,title",
      {
        headers,
      }
    );

    if (response.ok) {
      return {
        valid: true,
        hasKey: true,
        status: response.status,
        message: "APIキーは有効です",
      };
    }

    // 403エラーの場合、APIキーが無効または期限切れ
    if (response.status === 403) {
      return {
        valid: false,
        hasKey: true,
        status: response.status,
        message: "APIキーが無効または期限切れです。Semantic Scholarのダッシュボードで確認してください。",
      };
    }

    // その他のエラー
    const errorText = await response.text().catch(() => "");
    return {
      valid: false,
      hasKey: true,
      status: response.status,
      message: errorText || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      valid: false,
      hasKey: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
