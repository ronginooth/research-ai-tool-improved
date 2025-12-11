import { NextRequest, NextResponse } from "next/server";
import { generateTemplateCsv } from "@/lib/manuscript/csv-worksheet-parser";

/**
 * ワークシートテンプレート（CSV形式）をダウンロード
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    if (format === "csv") {
      const csvContent = generateTemplateCsv();
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="manuscript-worksheet-template.csv"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: "サポートされていない形式です。csv形式のみサポートしています。" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Template download error:", error);
    return NextResponse.json(
      { error: error?.message || "テンプレートのダウンロードに失敗しました" },
      { status: 500 }
    );
  }
}






