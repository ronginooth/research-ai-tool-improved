import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { projectPath, message, context } = await request.json();

    if (!projectPath || !message) {
      return NextResponse.json({
        success: false,
        error: "Project path and message are required",
      });
    }

    // プロジェクトディレクトリの存在確認
    if (!fs.existsSync(projectPath)) {
      return NextResponse.json({
        success: false,
        error: "Project directory not found",
      });
    }

    // Cursorチャット設定ファイルのパス
    const cursorChatPath = path.join(projectPath, ".cursor", "chat.json");

    // チャット設定ファイルが存在しない場合はエラー
    if (!fs.existsSync(cursorChatPath)) {
      return NextResponse.json({
        success: false,
        error: "Cursor chat not enabled for this project",
      });
    }

    // チャット履歴を読み込み
    let chatHistory = [];
    try {
      const chatData = fs.readFileSync(cursorChatPath, "utf-8");
      const chatConfig = JSON.parse(chatData);
      chatHistory = chatConfig.messages || [];
    } catch (error) {
      console.error("Error reading chat history:", error);
    }

    // 新しいメッセージを追加
    const newMessage = {
      id: Date.now(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    // コンテキスト情報を含むプロンプトを作成
    const contextPrompt = `
プロジェクト: ${context?.topic || "未指定"}
プロジェクトコンテキスト: ${context?.projectContext || "未指定"}
研究ギャップ分析: ${context?.gapAnalysis ? "完了済み" : "未実施"}
現在のドラフト: ${context?.draftType || "未選択"}

ユーザーの質問: ${message}

上記の情報を基に、研究プロジェクトのサポートを行ってください。
`;

    // Gemini APIを使用してレスポンスを生成
    let response = "";
    if (
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== ""
    ) {
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `あなたは研究プロジェクトの専門アシスタントです。以下のコンテキストに基づいて、ユーザーの質問に答えてください。

${contextPrompt}

研究プロジェクトの進捗、論文執筆、データ分析、研究戦略などについてサポートします。`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
              },
            }),
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          response = geminiData.candidates[0].content.parts[0].text;
        } else {
          throw new Error("Gemini API request failed");
        }
      } catch (error) {
        console.error("Gemini API error:", error);
        response =
          "申し訳ありません。現在AIアシスタントに接続できません。プロジェクトの詳細についてお手伝いできることがあれば、お聞かせください。";
      }
    } else {
      // デモ用のレスポンス
      response = `プロジェクト「${
        context?.topic || "KIF6研究"
      }」についてのご質問ですね。

現在の研究状況：
- 研究トピック: ${context?.topic || "未設定"}
- プロジェクトコンテキスト: ${context?.projectContext || "未設定"}
- 研究ギャップ分析: ${context?.gapAnalysis ? "完了済み" : "未実施"}
- 現在のドラフト: ${context?.draftType || "未選択"}

何か具体的にお手伝いできることがあれば、お聞かせください。研究の進捗、論文執筆、データ分析などについてサポートします。`;
    }

    // アシスタントのレスポンスを追加
    const assistantMessage = {
      id: Date.now() + 1,
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
    };

    // チャット履歴を更新
    const updatedHistory = [...chatHistory, newMessage, assistantMessage];

    // チャット設定を更新
    const chatConfig = {
      projectName: path.basename(projectPath),
      enabled: true,
      lastConnected: new Date().toISOString(),
      context: context || {},
      messages: updatedHistory,
    };

    // ファイルに保存
    fs.writeFileSync(cursorChatPath, JSON.stringify(chatConfig, null, 2));

    return NextResponse.json({
      success: true,
      response,
      messageId: assistantMessage.id,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to send message",
    });
  }
}




















