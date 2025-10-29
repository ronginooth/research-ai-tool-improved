import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const basePath =
      "/Users/makino/Documents/workspace_cursor/Research/Projects";

    if (!fs.existsSync(basePath)) {
      return NextResponse.json({
        success: false,
        error: "Research projects directory not found",
      });
    }

    const projects = fs
      .readdirSync(basePath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const projectPath = path.join(basePath, dirent.name);
        const projectInfo: any = {
          name: dirent.name,
          path: projectPath,
          writingPath: path.join(projectPath, "05_Writing"),
          hasWritingDir: fs.existsSync(path.join(projectPath, "05_Writing")),
          lastModified: fs.statSync(projectPath).mtime,
        };

        // プロジェクトの詳細情報を取得
        try {
          const readmePath = path.join(projectPath, "README.md");
          if (fs.existsSync(readmePath)) {
            const readmeContent = fs.readFileSync(readmePath, "utf-8");
            projectInfo.description = readmeContent.split("\n")[0] || "";
          }
        } catch (error) {
          console.error(`Error reading README for ${dirent.name}:`, error);
        }

        return projectInfo;
      })
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Error scanning projects:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to scan projects directory",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectName, projectPath } = await request.json();

    if (!projectName || !projectPath) {
      return NextResponse.json({
        success: false,
        error: "Project name and path are required",
      });
    }

    // 05_Writingディレクトリを作成
    const writingPath = path.join(projectPath, "05_Writing");
    if (!fs.existsSync(writingPath)) {
      fs.mkdirSync(writingPath, { recursive: true });
    }

    return NextResponse.json({
      success: true,
      message: "Writing directory created successfully",
    });
  } catch (error) {
    console.error("Error creating writing directory:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create writing directory",
    });
  }
}
