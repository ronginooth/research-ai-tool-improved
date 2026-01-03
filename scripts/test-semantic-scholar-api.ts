/**
 * Semantic Scholar API テストスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/test-semantic-scholar-api.ts
 * 
 * または、.env.localを読み込む場合:
 * node -r dotenv/config -r tsx/register scripts/test-semantic-scholar-api.ts
 */

// .env.localを読み込む
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value.trim();
      }
    }
  });
  console.log("✅ .env.localを読み込みました\n");
} catch (e) {
  console.log("⚠️  .env.localの読み込みに失敗しました。環境変数が既に設定されていることを前提とします。\n");
}

async function testSemanticScholarAPI() {
  console.log("🔍 Semantic Scholar API テスト開始...\n");

  // 環境変数の確認
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  console.log("📋 環境変数チェック:");
  console.log(`   SEMANTIC_SCHOLAR_API_KEY: ${apiKey ? "✅ 設定済み" : "❌ 未設定"}`);
  if (apiKey) {
    console.log(`   キーの長さ: ${apiKey.length}文字`);
    console.log(`   キーの先頭: ${apiKey.substring(0, 10)}...`);
  }
  console.log();

  // テスト1: 基本的な検索API
  console.log("📚 テスト1: 基本的な検索API");
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Research-AI-Tool-Improved/2.0",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(
      "https://api.semanticscholar.org/graph/v1/paper/search?query=machine+learning&limit=3&fields=paperId,title,authors,year,citationCount",
      { headers }
    );

    console.log(`   HTTPステータス: ${response.status} ${response.statusText}`);
    
    // レート制限ヘッダーの確認
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const rateLimitLimit = response.headers.get("x-ratelimit-limit");
    const rateLimitReset = response.headers.get("x-ratelimit-reset");
    
    if (rateLimitRemaining) {
      console.log(`   ✅ レート制限情報:`);
      console.log(`      残りリクエスト数: ${rateLimitRemaining}`);
      console.log(`      制限数: ${rateLimitLimit || "不明"}`);
      if (rateLimitReset) {
        const resetDate = new Date(parseInt(rateLimitReset) * 1000);
        console.log(`      リセット時刻: ${resetDate.toLocaleString("ja-JP")}`);
      }
    }

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ 検索成功: ${data.total || 0}件の論文が見つかりました`);
      if (data.data && data.data.length > 0) {
        console.log(`   📄 最初の論文:`);
        const firstPaper = data.data[0];
        console.log(`      タイトル: ${firstPaper.title}`);
        console.log(`      著者: ${firstPaper.authors?.map((a: any) => a.name).join(", ") || "不明"}`);
        console.log(`      年: ${firstPaper.year || "不明"}`);
        console.log(`      引用数: ${firstPaper.citationCount || 0}`);
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ エラー: ${errorText}`);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        console.log(`   ⚠️  レート制限に達しています。`);
        if (retryAfter) {
          console.log(`      ${retryAfter}秒後に再試行可能です。`);
        }
      } else if (response.status === 403) {
        console.log(`   ⚠️  APIキーが無効または期限切れの可能性があります。`);
      }
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  console.log();

  // リクエスト間に待機時間を追加（レート制限対策）
  console.log("⏳ レート制限対策: 2秒待機中...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log();

  // テスト2: 特定の論文IDで取得
  console.log("📚 テスト2: 特定の論文IDで取得");
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Research-AI-Tool-Improved/2.0",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    // 有名な論文のSemantic Scholar IDを使用（Attention Is All You Need）
    // ArXiv IDではなく、Semantic Scholarの内部IDを使用
    const paperId = "1706.03762v7"; // ArXiv ID形式でも試す
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/arXiv:${paperId}?fields=paperId,title,authors,year,citationCount,abstract`,
      { headers }
    );

    console.log(`   HTTPステータス: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ 論文取得成功:`);
      console.log(`      タイトル: ${data.title}`);
      console.log(`      著者: ${data.authors?.map((a: any) => a.name).join(", ") || "不明"}`);
      console.log(`      年: ${data.year || "不明"}`);
      console.log(`      引用数: ${data.citationCount || 0}`);
      console.log(`      要約: ${data.abstract?.substring(0, 100)}...`);
    } else {
      const errorText = await response.text();
      console.log(`   ❌ エラー: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  console.log();

  // リクエスト間に待機時間を追加（レート制限対策）
  console.log("⏳ レート制限対策: 2秒待機中...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log();

  // テスト3: 引用情報の取得
  console.log("📚 テスト3: 引用情報の取得");
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Research-AI-Tool-Improved/2.0",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    // まず検索で論文IDを取得してから引用情報を取得
    const searchResponse = await fetch(
      "https://api.semanticscholar.org/graph/v1/paper/search?query=Attention Is All You Need&limit=1&fields=paperId",
      { headers }
    );
    
    if (!searchResponse.ok) {
      console.log(`   ⚠️  検索に失敗したため、引用情報のテストをスキップします`);
      return;
    }
    
    const searchData = await searchResponse.json();
    if (!searchData.data || searchData.data.length === 0) {
      console.log(`   ⚠️  論文が見つからなかったため、引用情報のテストをスキップします`);
      return;
    }
    
    const paperId = searchData.data[0].paperId;
    console.log(`   使用する論文ID: ${paperId}`);
    
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?limit=3&fields=paperId,title`,
      { headers }
    );

    console.log(`   HTTPステータス: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ 引用情報取得成功: ${data.data?.length || 0}件の引用が見つかりました`);
      if (data.data && data.data.length > 0) {
        console.log(`   📄 最初の引用論文:`);
        const firstCitation = data.data[0];
        console.log(`      タイトル: ${firstCitation.citingPaper?.title || "不明"}`);
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ エラー: ${errorText}`);
      
      if (response.status === 429) {
        console.log(`   ⚠️  レート制限に達しています。`);
      }
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  console.log("\n✅ テスト完了");
}

// 実行
testSemanticScholarAPI().catch(console.error);

