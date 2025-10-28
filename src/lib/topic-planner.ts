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
  const text = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

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
    console.error("Topic planner JSON parse error:", error, text);
    throw new Error("検索プランの生成に失敗しました");
  }
}
