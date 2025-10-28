import { NextRequest, NextResponse } from "next/server";
import { getPaperThumbnail } from "@/lib/paper-thumbnail";

export async function POST(request: NextRequest) {
  try {
    const { doi, title, htmlUrl, pdfUrl } = await request.json();

    if (!doi && !title) {
      return NextResponse.json(
        { error: "DOIまたはタイトルが必要です" },
        { status: 400 }
      );
    }

    console.log(
      `Testing thumbnail for DOI: ${doi}, Title: ${title}, HTML: ${htmlUrl}, PDF: ${pdfUrl}`
    );

    const thumbnailUrl = await getPaperThumbnail(doi, title, htmlUrl, pdfUrl);

    return NextResponse.json({
      doi,
      title,
      htmlUrl,
      pdfUrl,
      thumbnailUrl,
      success: true,
    });
  } catch (error) {
    console.error("Test thumbnail error:", error);
    return NextResponse.json(
      { error: "サムネイル取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
