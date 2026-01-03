import { callGemini } from "./gemini";
import { SearchPlan } from "@/types";

interface TopicPlanInput {
  topic: string;
  language?: string;
  contextNeeded?: boolean;
}

export async function generateSearchPlan(
  input: TopicPlanInput
): Promise<SearchPlan> {
  const prompt = `あなたは学術研究の情報アーキテクトです。以下の研究トピックについて、関連論文を効率的に収集するための検索戦略を日本語で構造化して提案してください。

# 出力フォーマット
以下のJSONフォーマットで出力してください:
{
  "primaryTarget": string,
  "researchFocus": string[],
  "coreKeywords": string[],
  "supportingKeywords": string[],
  "excludeKeywords": string[],
  "recommendedQueries": string[],
  "recommendedDatabases": string[],
  "recommendedFilters": {
    "minCitations": number,
    "dateRange": { "start": string, "end": string }
  },
  "reasoning": string,
  "userIntentSummary": string,
  "confidence": number
}

# 指示
1. トピックを学術的な観点から分解し、対象分野・焦点・関連概念を抽出する。
2. 日本語特有の疑問表現や汎用語を除外し、英語検索で利用しやすいキーワードに変換する。
3. 「coreKeywords」には必須となる固有名詞や専門用語を入れる。
4. 「supportingKeywords」には補助的に使える同義語・関連語を入れる。
5. 「excludeKeywords」には誤ってヒットしそうな語を挙げる。
6. 「recommendedQueries」には実際にAPI検索に使用できる英語クエリを複数提案する。
7. 「recommendedDatabases」には推奨するデータベースを列挙する（日本語で）。
8. 「recommendedFilters」には最低引用数や推奨年代を設定する。日付範囲が不明な場合は空文字で良い。
9. 「reasoning」では、検索戦略の背景や意図を短くまとめる。
10. 「userIntentSummary」ではユーザーが求めている研究目的を要約する。
11. 「confidence」は0.0〜1.0で、この計画の自信度を示す。

# 研究トピック
${input.topic}
`;

  const rawText = await callGemini(prompt);
  let text = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // JSONブロックを抽出（より堅牢に）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }

  // ステップ1: まず、JSON全体からバックスペース文字(\b)を除去
  // \bはキー名や値の前後に含まれる可能性があるため、先に除去
  text = text.replace(/\u0008/g, ""); // \b (バックスペース文字) を除去

  // ステップ2: JSON文字列値内の制御文字をエスケープ（改善版）
  // エスケープシーケンスの正確な判定と文字列境界の識別を実装
  let result = "";
  let inString = false;
  let escaped = false; // エスケープ状態を追跡
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // エスケープシーケンスの処理
    // 前の文字がバックスラッシュでエスケープされている場合
    if (escaped) {
      // エスケープされた文字はそのまま追加（制御文字のエスケープは行わない）
      result += char;
      escaped = false;
      continue;
    }
    
    // バックスラッシュの検出
    if (char === "\\") {
      escaped = true;
      result += char;
      continue;
    }
    
    // 文字列の開始/終了の検出
    // エスケープされていない引用符のみが文字列の境界
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    // 文字列内の制御文字をエスケープ
    if (inString) {
      const charCode = char.charCodeAt(0);
      // Unicode制御文字（\u0000-\u001F）をエスケープ
      if (charCode >= 0 && charCode <= 0x1F) {
        if (char === "\n") {
          result += "\\n";
        } else if (char === "\r") {
          result += "\\r";
        } else if (char === "\t") {
          result += "\\t";
        } else if (char === "\f") {
          result += "\\f";
        } else if (char === "\b") {
          result += "\\b";
        } else {
          // その他の制御文字はUnicodeエスケープ形式で
          result += `\\u${charCode.toString(16).padStart(4, "0")}`;
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  
  text = result;

  // 未閉じの引用符を修正（行末の未閉じ引用符）
  text = text.replace(/"([^"]*)$/gm, (match, content) => {
    if (!content.includes('"') && !content.includes('\\')) {
      return `"${content}"`;
    }
    return match;
  });

  try {
    const json = JSON.parse(text);
    return {
      primaryTarget: json.primaryTarget,
      researchFocus: json.researchFocus || [],
      coreKeywords: json.coreKeywords || [],
      supportingKeywords: json.supportingKeywords || [],
      excludeKeywords: json.excludeKeywords || [],
      recommendedQueries: json.recommendedQueries || [],
      recommendedDatabases: json.recommendedDatabases || [],
      recommendedFilters: {
        minCitations: json.recommendedFilters?.minCitations,
        dateRange: json.recommendedFilters?.dateRange || {},
      },
      reasoning: json.reasoning || "",
      userIntentSummary: json.userIntentSummary || "",
      confidence: json.confidence ?? 0.5,
    };
  } catch (error) {
    console.error("Topic planner JSON parse error:", error);
    console.error("Failed JSON text (first 500 chars):", text.substring(0, 500));
    
    // フォールバック: 基本的な検索プランを返す
    return {
      primaryTarget: input.topic,
      researchFocus: [],
      coreKeywords: input.topic.split(" ").slice(0, 5),
      supportingKeywords: [],
      excludeKeywords: [],
      recommendedQueries: [input.topic],
      recommendedDatabases: ["semantic_scholar", "pubmed"],
      recommendedFilters: {
        minCitations: 0,
        dateRange: {},
      },
      reasoning: "JSONパースに失敗したため、基本的な検索プランを使用します",
      userIntentSummary: input.topic,
      confidence: 0.3,
    };
  }
}
