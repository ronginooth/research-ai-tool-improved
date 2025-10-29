import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getThumbnailUrl } from "@/lib/doi-resolver";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "ユーザーIDが必要です" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    // すべての論文を取得（サムネイルの有無に関係なく）
    const { data: papers, error: fetchError } = await supabaseAdmin
      .from("user_library")
      .select("id, title, doi, notes")
      .eq("user_id", userId);

    if (fetchError) {
      console.error("Failed to fetch papers:", fetchError);
      return NextResponse.json(
        { error: "論文の取得に失敗しました" },
        { status: 500 }
      );
    }

    if (!papers || papers.length === 0) {
      return NextResponse.json({
        message: "更新が必要な論文はありません",
        updated: 0,
      });
    }

    console.log(`Found ${papers.length} papers to process`);

    let updatedCount = 0;
    const errors = [];

    // 各論文のサムネイルを更新
    for (const paper of papers) {
      try {
        // 既にサムネイルがある場合はスキップ（強制更新の場合はコメントアウト）
        // if (paper.notes && paper.notes.includes('placeholder.com')) {
        //   console.log(`Skipping paper with existing thumbnail: ${paper.title}`);
        //   continue;
        // }

        if (paper.doi) {
          // HTML URLとPDF URLも取得してサムネイル生成に使用
          const paperData = await supabaseAdmin
            .from("user_library")
            .select("html_url, pdf_url")
            .eq("id", paper.id)
            .single();

          const htmlUrl = paperData.data?.html_url;
          const pdfUrl = paperData.data?.pdf_url;

          const thumbnailUrl = await getThumbnailUrl(
            paper.doi,
            paper.title,
            htmlUrl,
            pdfUrl
          );

          if (thumbnailUrl) {
            const { error: updateError } = await supabaseAdmin
              .from("user_library")
              .update({ notes: thumbnailUrl })
              .eq("id", paper.id);

            if (updateError) {
              console.error(`Failed to update paper ${paper.id}:`, updateError);
              errors.push(`論文 ${paper.title} の更新に失敗しました`);
            } else {
              updatedCount++;
              console.log(`Updated thumbnail for paper: ${paper.title}`);
            }
          }
        } else {
          // DOIがない場合でもデフォルトのサムネイルを生成
          console.log(`Processing paper without DOI: ${paper.title}`);
          const thumbnailUrl = await getThumbnailUrl(
            "",
            paper.title,
            undefined,
            undefined
          );
          console.log(`Generated thumbnail URL: ${thumbnailUrl}`);

          if (thumbnailUrl) {
            const { error: updateError } = await supabaseAdmin
              .from("user_library")
              .update({ notes: thumbnailUrl })
              .eq("id", paper.id);

            if (updateError) {
              console.error(`Failed to update paper ${paper.id}:`, updateError);
              errors.push(`論文 ${paper.title} の更新に失敗しました`);
            } else {
              updatedCount++;
              console.log(
                `Updated thumbnail for paper without DOI: ${paper.title}`
              );
            }
          } else {
            console.log(`No thumbnail URL generated for: ${paper.title}`);
          }
        }
      } catch (error) {
        console.error(`Error processing paper ${paper.id}:`, error);
        errors.push(`論文 ${paper.title} の処理中にエラーが発生しました`);
      }
    }

    return NextResponse.json({
      message: `${updatedCount}件の論文のサムネイルを更新しました`,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Update thumbnails error:", error);
    return NextResponse.json(
      { error: "サムネイルの更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
