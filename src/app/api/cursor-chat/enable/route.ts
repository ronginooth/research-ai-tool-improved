import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { projectPath, projectName } = await request.json();

    if (!projectPath || !projectName) {
      return NextResponse.json({
        success: false,
        error: "Project path and name are required",
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
    
    // .cursorディレクトリが存在しない場合は作成
    const cursorDir = path.join(projectPath, ".cursor");
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    // チャット設定ファイルが存在しない場合は作成
    if (!fs.existsSync(cursorChatPath)) {
      const defaultChatConfig = {
        projectName,
        enabled: true,
        lastConnected: new Date().toISOString(),
        context: {
          researchTopic: "",
          projectContext: "",
          gapAnalysis: "",
          currentDraft: "",
        },
      };
      
      fs.writeFileSync(cursorChatPath, JSON.stringify(defaultChatConfig, null, 2));
    }

    return NextResponse.json({
      success: true,
      message: "Cursor chat integration enabled successfully",
      projectPath,
      projectName,
    });
  } catch (error) {
    console.error("Error enabling cursor chat:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to enable cursor chat integration",
    });
  }
}



















