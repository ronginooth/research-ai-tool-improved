import { AIProvider, AIProviderConfig, Paper, ExtendedPaper } from "@/types";
import { openai } from "./openai";
import { callGemini } from "./gemini";
import { callGeminiEmbedding } from "./gemini";

// 統一されたAIプロバイダーインターフェース
export interface AIProviderInterface {
  name: AIProvider;
  generateQuery(topic: string): Promise<string[]>;
  rankPapers(topic: string, papers: Paper[]): Promise<number[]>;
  generateReview(topic: string, papers: Paper[]): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}

// OpenAI プロバイダー実装
class OpenAIProvider implements AIProviderInterface {
  name: AIProvider = "openai";

  async generateQuery(topic: string): Promise<string[]> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "あなたは学術論文検索の専門家です。効率的な検索クエリを生成してください。",
        },
        {
          role: "user",
          content: `以下の研究トピックについて、関連する論文を効率的に検索するための検索クエリを5つ生成してください。

研究トピック: "${topic}"

以下の観点から検索クエリを生成してください：
1. メインのキーワード
2. 関連する専門用語
3. 異なる表現・同義語
4. 具体的な手法や技術
5. 関連する分野

各クエリは簡潔で（10語以内）、学術論文検索に適したものにしてください。
検索クエリのみを、1行に1つずつ出力してください。`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = completion.choices[0].message.content || "";
    return text
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && !q.includes("：") && !q.includes(":"))
      .slice(0, 5);
  }

  async rankPapers(topic: string, papers: Paper[]): Promise<number[]> {
    const prompt = `
以下の研究トピックに関連する論文を、関連性の高い順にランキングしてください。

研究トピック: "${topic}"

論文リスト:
${papers
  .map(
    (paper, index) => `
${index + 1}. ${paper.title}
   著者: ${paper.authors}
   年: ${paper.year}
   要約: ${paper.abstract?.substring(0, 200)}...
   引用数: ${paper.citationCount}
`
  )
  .join("\n")}

関連性の高い順に、論文の番号のみを1行に1つずつ出力してください。
例:
3
1
5
2
4
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "あなたは学術論文の専門家です。研究トピックとの関連性に基づいて論文をランキングしてください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const text = completion.choices[0].message.content || "";
    return text
      .split("\n")
      .map((line) => parseInt(line.trim()))
      .filter((num) => !isNaN(num) && num >= 1 && num <= papers.length);
  }

  async generateReview(topic: string, papers: Paper[]): Promise<string> {
    const prompt = `
以下の研究トピックについて、提供された論文を基に包括的な文献レビューを作成してください。

研究トピック: "${topic}"

関連論文 (${papers.length}件):
${papers
  .map(
    (paper: Paper, index: number) => `
${index + 1}. ${paper.title}
   著者: ${paper.authors}
   年: ${paper.year}
   ジャーナル: ${paper.venue}
   要約: ${paper.abstract}
   引用数: ${paper.citationCount}
`
  )
  .join("\n")}

以下の構造で文献レビューを作成してください：

## 1. はじめに
- 研究トピックの背景と重要性
- レビューの目的と範囲

## 2. 研究の背景
- 関連する先行研究の概要
- 研究分野の発展の流れ

## 3. 主要な研究動向
- 各論文の主要な貢献
- 研究手法の比較
- 共通点と相違点

## 4. 研究方法の比較
- 実験手法の違い
- データセットの特徴
- 評価指標の比較

## 5. 主要な発見
- 重要な研究成果
- 新たな知見
- 実用的な応用

## 6. 今後の研究方向
- 未解決の問題
- 今後の研究の可能性
- 技術的課題

## 7. 結論
- レビューのまとめ
- 研究分野の現状と展望

学術的な文体で、適切な引用を含めて作成してください。各論文の内容を正確に反映し、客観的な分析を行ってください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "あなたは学術論文の専門家です。与えられた論文を基に包括的で構造化された文献レビューを作成してください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return completion.choices[0].message.content || "";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await openai.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

// Gemini プロバイダー実装
class GeminiProvider implements AIProviderInterface {
  name: AIProvider = "gemini";

  async generateQuery(topic: string): Promise<string[]> {
    const prompt = `
以下の研究トピックについて、関連する論文を効率的に検索するための検索クエリを5つ生成してください。

研究トピック: "${topic}"

以下の観点から検索クエリを生成してください：
1. メインのキーワード
2. 関連する専門用語
3. 異なる表現・同義語
4. 具体的な手法や技術
5. 関連する分野

各クエリは簡潔で（10語以内）、学術論文検索に適したものにしてください。
検索クエリのみを、1行に1つずつ出力してください。
`;

    try {
      const text = await callGemini(prompt);

      return text
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0 && !q.includes("：") && !q.includes(":"))
        .slice(0, 5);
    } catch (error) {
      console.error("Gemini query generation error:", error);
      return [];
    }
  }

  async rankPapers(topic: string, papers: Paper[]): Promise<number[]> {
    const prompt = `
以下の研究トピックに関連する論文を、関連性の高い順にランキングしてください。

研究トピック: "${topic}"

論文リスト:
${papers
  .map(
    (paper, index) => `
${index + 1}. ${paper.title}
   著者: ${paper.authors}
   年: ${paper.year}
   要約: ${paper.abstract?.substring(0, 200)}...
   引用数: ${paper.citationCount}
`
  )
  .join("\n")}

関連性の高い順に、論文の番号のみを1行に1つずつ出力してください。
例:
3
1
5
2
4
`;

    try {
      const text = await callGemini(prompt);

      return text
        .split("\n")
        .map((line) => parseInt(line.trim()))
        .filter((num) => !isNaN(num) && num >= 1 && num <= papers.length);
    } catch (error) {
      console.error("Gemini ranking error:", error);
      return [];
    }
  }

  async generateReview(topic: string, papers: Paper[]): Promise<string> {
    const prompt = `
以下の研究トピックについて、提供された論文を基に包括的な文献レビューを作成してください。

研究トピック: "${topic}"

関連論文 (${papers.length}件):
${papers
  .map(
    (paper: Paper, index: number) => `
${index + 1}. ${paper.title}
   著者: ${paper.authors}
   年: ${paper.year}
   ジャーナル: ${paper.venue}
   DOI: ${(paper as ExtendedPaper).doi ?? "不明"}
   要約: ${paper.abstract}
   引用数: ${paper.citationCount}
`
  )
  .join("\n")}

以下の構造で文献レビューを作成してください：

## 1. はじめに
- 研究トピックの背景と重要性
- レビューの目的と範囲

## 2. 研究の背景
- 関連する先行研究の概要
- 研究分野の発展の流れ

## 3. 主要な研究動向
- 各論文の主要な貢献
- 研究手法の比較
- 共通点と相違点

## 4. 研究方法の比較
- 実験手法の違い
- データセットの特徴
- 評価指標の比較

## 5. 主要な発見
- 重要な研究成果
- 新たな知見
- 実用的な応用

## 6. 今後の研究方向
- 未解決の問題
- 今後の研究の可能性
- 技術的課題

## 7. 結論
- レビューのまとめ
- 研究分野の現状と展望

学術的な文体で、適切な引用を含めて作成してください。各論文の内容を正確に反映し、客観的な分析を行ってください。
`;

    try {
      return await callGemini(prompt);
    } catch (error) {
      console.error("Gemini review generation error:", error);
      return "";
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return await callGeminiEmbedding(text);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await callGemini("Please respond with 'OK'.");
      return true;
    } catch {
      return false;
    }
  }
}

// AI プロバイダーマネージャー
export class AIProviderManager {
  private providers: Map<AIProvider, AIProviderInterface> = new Map();
  private fallbackOrder: AIProvider[] = ["gemini", "openai"];

  constructor() {
    this.providers.set("openai", new OpenAIProvider());
    this.providers.set("gemini", new GeminiProvider());
  }

  async executeWithFallback<T>(
    operation: (provider: AIProviderInterface) => Promise<T>
  ): Promise<T> {
    for (const providerName of this.fallbackOrder) {
      try {
        const provider = this.providers.get(providerName);
        if (provider && (await provider.isAvailable())) {
          return await operation(provider);
        }
      } catch (error) {
        console.warn(`${providerName} failed, trying next provider:`, error);
      }
    }
    throw new Error("All AI providers failed");
  }

  async generateQuery(
    topic: string,
    preferredProvider?: AIProvider
  ): Promise<string[]> {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && (await provider.isAvailable())) {
        return await provider.generateQuery(topic);
      }
    }

    return await this.executeWithFallback((provider) =>
      provider.generateQuery(topic)
    );
  }

  async rankPapers(
    topic: string,
    papers: Paper[],
    preferredProvider?: AIProvider
  ): Promise<number[]> {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && (await provider.isAvailable())) {
        return await provider.rankPapers(topic, papers);
      }
    }

    return await this.executeWithFallback((provider) =>
      provider.rankPapers(topic, papers)
    );
  }

  async generateReview(
    topic: string,
    papers: Paper[],
    preferredProvider?: AIProvider
  ): Promise<string> {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && (await provider.isAvailable())) {
        return await provider.generateReview(topic, papers);
      }
    }

    return await this.executeWithFallback((provider) =>
      provider.generateReview(topic, papers)
    );
  }

  async generateEmbedding(
    text: string,
    preferredProvider?: AIProvider
  ): Promise<number[]> {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && (await provider.isAvailable())) {
        return await provider.generateEmbedding(text);
      }
    }

    return await this.executeWithFallback((provider) =>
      provider.generateEmbedding(text)
    );
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  async checkProviderStatus(): Promise<Record<AIProvider, boolean>> {
    const status: Record<AIProvider, boolean> = {} as Record<
      AIProvider,
      boolean
    >;

    for (const [name, provider] of this.providers) {
      status[name] = await provider.isAvailable();
    }

    return status;
  }
}

// シングルトンインスタンス
export const aiProviderManager = new AIProviderManager();
