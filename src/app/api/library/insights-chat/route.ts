import { NextRequest, NextResponse } from "next/server";
import { generateInsightsChatResponse } from "@/lib/insights-chat";

interface ChatRequestBody {
  paperId?: string;
  userId?: string;
  question?: string;
}

const DEFAULT_USER = "demo-user-123";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const paperId = body.paperId?.trim();
    const userId = body.userId?.trim() || DEFAULT_USER;
    const question = body.question?.trim();

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId は必須です" },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: "question は必須です" },
        { status: 400 }
      );
    }

    const response = await generateInsightsChatResponse({
      paperId,
      userId,
      question,
    });

    if (!response) {
      return NextResponse.json(
        {
          error:
            "関連する本文コンテキストを取得できませんでした。AI解説を生成するか、プレビューURLを設定してから再度お試しください。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Insights chat error", error);
    return NextResponse.json(
      { error: error?.message || "チャット回答の生成に失敗しました" },
      { status: 500 }
    );
  }
}
