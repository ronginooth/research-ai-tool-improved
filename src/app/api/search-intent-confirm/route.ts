import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

// ユーザーの意図を分析する関数（search-simple/route.tsからコピー）
interface UserIntent {
  mainConcepts: string[];
  compoundTerms: string[];
  searchPurpose: string;
  keyPhrases: string[];
}

async function analyzeUserIntent(query: string): Promise<UserIntent> {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query);

  try {
    const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、検索の意図を明確にしてください。

【分析タスク】
1. 主要な概念を特定（タンパク質名、遺伝子名、プロセス名、細胞小器官など）
2. 複合語やフレーズを特定（例: "adenylate kinase", "motor protein", "intraflagellar transport"）
3. 検索の目的を特定（メカニズム、機能、調節、相互作用、疾患との関係など）
4. 引用符で囲むべき重要なフレーズを特定

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
  "keyPhrases": ["adenylate kinase", "ciliopathy"]
}

【クエリ】
"${query}"

【出力】
JSON形式:`;

    const response = await callGemini(prompt);
    const cleaned = response.trim();

    // JSONを抽出（```json や ``` で囲まれている場合がある）
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0];
        
        // 文字列内の改行をエスケープ
        jsonStr = jsonStr.replace(/\n/g, "\\n");
        jsonStr = jsonStr.replace(/\r/g, "\\r");
        jsonStr = jsonStr.replace(/\t/g, "\\t");
        
        const parsed = JSON.parse(jsonStr) as UserIntent;
        
        // 必須フィールドの検証
        if (!parsed.mainConcepts || !Array.isArray(parsed.mainConcepts)) {
          throw new Error("mainConcepts is missing or invalid");
        }
        
        return parsed;
      } catch (parseError) {
        console.warn("[Search Intent Confirm] Intent analysis JSON parse error:", parseError);
        console.warn("[Search Intent Confirm] Raw response:", cleaned);
        // パースエラーでも続行（フォールバックに進む）
      }
    }

    // JSON解析に失敗した場合のフォールバック
    return {
      mainConcepts: [],
      compoundTerms: [],
      searchPurpose: "研究論文を検索",
      keyPhrases: [],
    };
  } catch (error) {
    console.warn("[Search Intent Confirm] Intent analysis failed:", error);
    return {
      mainConcepts: [],
      compoundTerms: [],
      searchPurpose: "研究論文を検索",
      keyPhrases: [],
    };
  }
}

interface IntentConfirmationRequest {
  query: string;
  userIntent?: {
    mainConcepts: string[];
    compoundTerms: string[];
    searchPurpose: string;
    keyPhrases: string[];
  };
}

interface IntentConfirmationResponse {
  confirmationMessage: string; // ユーザーに確認するメッセージ
  suggestedQuery?: string; // 提案された検索クエリ
  requiresConfirmation: boolean; // 確認が必要かどうか
}

export async function POST(request: NextRequest) {
  try {
    const body: IntentConfirmationRequest = await request.json();
    const { query, userIntent: providedUserIntent } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    // userIntentが提供されていない場合は分析する
    const userIntent = providedUserIntent || await analyzeUserIntent(query);

    // ユーザーの意図を分析して確認メッセージを生成
    const prompt = `あなたは学術論文検索のアシスタントです。ユーザーの検索クエリを分析し、検索の意図を確認するメッセージを生成してください。

【タスク】
1. ユーザーの検索クエリから、何を探しているのかを理解する
2. 曖昧な点や確認すべき点を特定する
3. ユーザーに「これこれこういうことですか？」という形式で確認メッセージを生成する

【出力形式】
以下のJSON形式で出力してください：
{
  "confirmationMessage": "ユーザーへの確認メッセージ（日本語で、親しみやすい口調で）",
  "suggestedQuery": "提案された検索クエリ（英語）",
  "requiresConfirmation": true/false
}

【例】
クエリ: "繊毛病の種類とAdenylate kinase タンパク質"
出力:
{
  "confirmationMessage": "adenylate kinaseタンパク質と繊毛病の関係について調べたいということですね。特に、adenylate kinaseが特定の繊毛病のメカニズムや機能にどのように関与しているかを探しているという理解で合っていますか？",
  "suggestedQuery": "ciliopathy \"adenylate kinase\" protein mechanism function",
  "requiresConfirmation": true
}

【クエリ】
"${query}"
${userIntent ? `\n【分析された意図】\n- 主要な概念: ${userIntent.mainConcepts.join(", ")}\n- 複合語: ${userIntent.compoundTerms.join(", ")}\n- 検索の目的: ${userIntent.searchPurpose}\n- 重要なフレーズ: ${userIntent.keyPhrases.join(", ")}` : ""}

【出力】
JSON形式:`;

    const response = await callGemini(prompt);
    const cleaned = response.trim();

    console.log("[Search Intent Confirm] Raw Gemini response:", cleaned);

    // JSONを抽出（```json や ``` で囲まれている場合がある）
    let jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0];
        
        // まずそのままパースを試みる
        let parsed: IntentConfirmationResponse;
        try {
          parsed = JSON.parse(jsonStr) as IntentConfirmationResponse;
        } catch (firstParseError) {
          // パースに失敗した場合、文字列値内の改行をエスケープして再試行
          // ただし、JSONの構造部分（キーや値の区切り）の改行は保持
          // 文字列値（引用符で囲まれた部分）内の改行のみをエスケープ
          jsonStr = jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
            // 文字列値内の改行をエスケープ
            return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
          });
          parsed = JSON.parse(jsonStr) as IntentConfirmationResponse;
        }
        
        // confirmationMessage内の\nを実際の改行に変換
        if (parsed.confirmationMessage) {
          parsed.confirmationMessage = parsed.confirmationMessage.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
        }
        
        // 必須フィールドの検証
        if (!parsed.confirmationMessage) {
          throw new Error("confirmationMessage is missing");
        }
        
        console.log("[Search Intent Confirm] Parsed confirmation message:", parsed.confirmationMessage);
        
        return NextResponse.json(parsed);
      } catch (parseError) {
        console.warn("[Search Intent Confirm] JSON parse error:", parseError);
        console.warn("[Search Intent Confirm] Raw response:", cleaned);
        console.warn("[Search Intent Confirm] JSON string:", jsonMatch?.[0]);
        // パースエラーでも続行（フォールバックに進む）
      }
    }

    // JSON解析に失敗した場合のフォールバック
    console.warn("[Search Intent Confirm] Using fallback message");
    return NextResponse.json({
      confirmationMessage: `「${query}」について検索しますか？`,
      requiresConfirmation: true,
    });
  } catch (error) {
    console.error("Intent confirmation error:", error);
    // エラー時はフォールバックメッセージを返す
    try {
      const body = await request.json();
      return NextResponse.json(
        {
          confirmationMessage: `「${body.query || "検索クエリ"}」について検索しますか？`,
          requiresConfirmation: true,
        },
        { status: 500 }
      );
    } catch {
      return NextResponse.json(
        {
          confirmationMessage: "検索を実行しますか？",
          requiresConfirmation: true,
        },
        { status: 500 }
      );
    }
  }
}

