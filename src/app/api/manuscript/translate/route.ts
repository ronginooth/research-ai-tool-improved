import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

/**
 * パラグラフの翻訳API
 * 英語→日本語、日本語→英語の両方向に対応
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLanguage } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "翻訳するテキストが必要です" },
        { status: 400 }
      );
    }

    if (!targetLanguage || !["ja", "en"].includes(targetLanguage)) {
      return NextResponse.json(
        { error: "targetLanguageは'ja'（日本語）または'en'（英語）である必要があります" },
        { status: 400 }
      );
    }

    // テキストの言語を判定（簡易版）
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const sourceLanguage = isJapanese ? "ja" : "en";

    // 同じ言語への翻訳は不要
    if (sourceLanguage === targetLanguage) {
      return NextResponse.json({
        translatedText: text,
        sourceLanguage,
        targetLanguage,
      });
    }

    // 翻訳プロンプトを作成
    const translationPrompt = targetLanguage === "ja"
      ? `以下の英語の学術論文のパラグラフを自然な日本語に翻訳してください。学術的な正確性を保ち、専門用語は適切に翻訳してください。\n\n英語:\n${text}\n\n日本語:`
      : `以下の日本語の学術論文のパラグラフを自然な英語に翻訳してください。学術的な正確性を保ち、専門用語は適切に翻訳してください。IMRaD形式の論文スタイルで、学術的な文章として自然に読めるようにしてください。\n\n日本語:\n${text}\n\n英語:`;

    console.log(`[Translate] Translating from ${sourceLanguage} to ${targetLanguage}, text length: ${text.length}`);

    try {
      const translatedText = await callGemini(translationPrompt);
      
      if (!translatedText || translatedText.trim().length === 0) {
        throw new Error("翻訳結果が空でした");
      }

      console.log(`[Translate] Translation successful, translated length: ${translatedText.length}`);

      return NextResponse.json({
        translatedText: translatedText.trim(),
        sourceLanguage,
        targetLanguage,
      });
    } catch (error: any) {
      console.error("[Translate] Translation error:", error);
      throw new Error(`翻訳に失敗しました: ${error?.message || "不明なエラー"}`);
    }
  } catch (error: any) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: error?.message || "翻訳に失敗しました" },
      { status: 500 }
    );
  }
}




