import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

interface IntentRefineRequest {
  originalQuery: string;
  userResponse: string; // ユーザーの返答
  previousIntent?: {
    mainConcepts: string[];
    compoundTerms: string[];
    searchPurpose: string;
    keyPhrases: string[];
  };
}

interface IntentRefineResponse {
  refinedQuery: string; // 修正された検索クエリ
  newIntent?: {
    mainConcepts: string[];
    compoundTerms: string[];
    searchPurpose: string;
    keyPhrases: string[];
  };
  needsFurtherConfirmation: boolean; // さらに確認が必要かどうか
  confirmationMessage?: string; // 追加の確認メッセージ
}

export async function POST(request: NextRequest) {
  try {
    const body: IntentRefineRequest = await request.json();
    const { originalQuery, userResponse, previousIntent } = body;

    if (!originalQuery || !userResponse) {
      return NextResponse.json(
        { error: "元のクエリとユーザーの返答が必要です" },
        { status: 400 }
      );
    }

    // ユーザーの返答を分析して検索クエリを修正
    const prompt = `あなたは学術論文検索のアシスタントです。ユーザーの返答を分析し、検索クエリを修正してください。

【状況】
- 元の検索クエリ: "${originalQuery}"
- ユーザーの返答: "${userResponse}"
${previousIntent ? `\n- 以前の意図分析:\n  - 主要な概念: ${previousIntent.mainConcepts.join(", ")}\n  - 複合語: ${previousIntent.compoundTerms.join(", ")}\n  - 検索の目的: ${previousIntent.searchPurpose}` : ""}

【タスク】
1. ユーザーの返答から、検索の意図が明確になったか、変更されたかを判断する
2. 必要に応じて検索クエリを修正する
3. まだ曖昧な点があれば、追加の確認メッセージを生成する

【出力形式】
以下のJSON形式で出力してください：
{
  "refinedQuery": "修正された検索クエリ（英語、引用符で複合語を囲む）",
  "newIntent": {
    "mainConcepts": ["概念1", "概念2"],
    "compoundTerms": ["複合語1", "複合語2"],
    "searchPurpose": "検索の目的を1文で",
    "keyPhrases": ["引用符で囲むべきフレーズ1", "引用符で囲むべきフレーズ2"]
  },
  "needsFurtherConfirmation": true/false,
  "confirmationMessage": "追加の確認メッセージ（needsFurtherConfirmationがtrueの場合のみ）"
}

【例】
元のクエリ: "繊毛病の種類とAdenylate kinase タンパク質"
ユーザーの返答: "はい、その通りです。特にadenylate kinase 7と繊毛病の関係について知りたいです"
出力:
{
  "refinedQuery": "ciliopathy \"adenylate kinase 7\" protein mechanism function",
  "newIntent": {
    "mainConcepts": ["ciliopathy", "adenylate kinase 7", "protein"],
    "compoundTerms": ["adenylate kinase 7", "ciliary dysfunction"],
    "searchPurpose": "adenylate kinase 7タンパク質と繊毛病の関係、特にメカニズムや機能への関与を探している",
    "keyPhrases": ["adenylate kinase 7", "ciliopathy"]
  },
  "needsFurtherConfirmation": false
}

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
        
        const parsed = JSON.parse(jsonStr) as IntentRefineResponse;
        
        // 必須フィールドの検証
        if (!parsed.refinedQuery || !parsed.refinedQuery.trim()) {
          throw new Error("refinedQuery is missing or empty");
        }
        
        return NextResponse.json(parsed);
      } catch (parseError) {
        console.warn("[Search Intent Refine] JSON parse error:", parseError);
        console.warn("[Search Intent Refine] Raw response:", cleaned);
        // パースエラーでも続行（フォールバックに進む）
      }
    }

    // JSON解析に失敗した場合のフォールバック
    return NextResponse.json({
      refinedQuery: originalQuery,
      needsFurtherConfirmation: false,
    });
  } catch (error) {
    console.error("Intent refine error:", error);
    // エラー時は元のクエリを返す
    try {
      const body = await request.json();
      return NextResponse.json(
        {
          refinedQuery: body.originalQuery || "",
          needsFurtherConfirmation: false,
        },
        { status: 500 }
      );
    } catch {
      return NextResponse.json(
        {
          refinedQuery: "",
          needsFurtherConfirmation: false,
        },
        { status: 500 }
      );
    }
  }
}

