import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const THUMBNAIL_BUCKET = process.env.SUPABASE_THUMBNAIL_BUCKET ?? "library-thumbnails";

interface UploadRequestBody {
  paperId: string;
  userId?: string;
  imageData?: string; // base64 encoded image
  imageUrl?: string; // external URL
}

async function ensureBucket(client: SupabaseClient, bucket: string) {
  // バケットの存在確認
  const { data: bucketInfo, error: getError } = await client.storage.getBucket(bucket);
  
  if (bucketInfo) {
    return bucketInfo;
  }

  // バケットが存在しない場合（404エラー）は作成を試みる
  const isNotFound = 
    (getError as any)?.statusCode === 404 || 
    (getError as any)?.message?.includes("not found") ||
    (getError as any)?.message?.includes("Bucket not found");

  if (!isNotFound && getError) {
    // 404以外のエラーはそのまま返す
    throw new Error(`バケット情報の取得に失敗しました: ${getError.message}`);
  }

  // バケットを作成を試みる
  try {
    const { data, error: createError } = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 1024 * 1024 * 5, // 5MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    });

    if (createError) {
      // バケット作成に失敗した場合、より詳細なエラーメッセージを返す
      const errorMessage = createError.message || "不明なエラー";
      throw new Error(
        `バケットの作成に失敗しました: ${errorMessage}\n\n` +
        `SupabaseのStorageで「${bucket}」バケットを手動で作成してください。\n` +
        `設定: 公開バケット、最大ファイルサイズ5MB、許可されたMIMEタイプ: image/jpeg, image/png, image/gif, image/webp`
      );
    }

    return data;
  } catch (createError: any) {
    // バケット作成権限がない場合など
    if (createError.message) {
      throw createError;
    }
    throw new Error(
      `バケット「${bucket}」が存在せず、作成もできませんでした。\n\n` +
      `SupabaseのStorageで「${bucket}」バケットを手動で作成してください。\n` +
      `設定: 公開バケット、最大ファイルサイズ5MB`
    );
  }
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UploadRequestBody;
    const paperId = body.paperId?.trim();
    const userIdInput = body.userId?.trim();
    const imageData = body.imageData;
    const imageUrl = body.imageUrl;

    if (!paperId) {
      return NextResponse.json({ error: "paperId は必須です" }, { status: 400 });
    }

    if (!imageData && !imageUrl) {
      return NextResponse.json(
        { error: "imageData または imageUrl は必須です" },
        { status: 400 }
      );
    }

    const { adminClient, userId: resolvedUserId } = await getSupabaseForUser(
      request,
      userIdInput
    );

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    let finalUrl = imageUrl;

    // 画像データが提供された場合、Supabase Storageにアップロード
    if (imageData) {
      try {
        await ensureBucket(adminClient, THUMBNAIL_BUCKET);
      } catch (bucketError: any) {
        console.error("Bucket ensure error:", bucketError);
        return NextResponse.json(
          { 
            error: bucketError.message || "ストレージバケットの準備に失敗しました",
            details: "SupabaseのStorageで「library-thumbnails」バケットを作成してください"
          },
          { status: 500 }
        );
      }

      // base64データをデコード
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // MIMEタイプを検出
      const mimeType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || "png";
      const contentType = `image/${mimeType}`;

      const objectPath = `${resolvedUserId}/${paperId}/${Date.now()}-${randomUUID()}.${mimeType}`;

      const { error: uploadError } = await adminClient.storage
        .from(THUMBNAIL_BUCKET)
        .upload(objectPath, buffer, {
          contentType,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Thumbnail upload failed", uploadError);
        return NextResponse.json(
          { error: uploadError.message || "画像のアップロードに失敗しました" },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = adminClient.storage.from(THUMBNAIL_BUCKET).getPublicUrl(objectPath);

      finalUrl = publicUrl;
    }

    // データベースにサムネイルURLを保存
    const { error: updateError } = await adminClient
      .from("user_library")
      .update({ thumbnail_url: finalUrl })
      .eq("id", paperId)
      .eq("user_id", resolvedUserId);

    if (updateError) {
      console.error("Failed to update user_library record", updateError);
      console.error("Error code:", updateError.code);
      console.error("Error message:", updateError.message);
      console.error("Error details:", (updateError as any).details);
      
      // カラムが存在しない場合のエラーメッセージを追加
      if (
        updateError.code === "42703" ||
        updateError.message?.includes("column") ||
        updateError.message?.includes("thumbnail_url") ||
        updateError.message?.includes("Could not find the 'thumbnail_url' column")
      ) {
        return NextResponse.json(
          {
            error: "データベースエラー: thumbnail_urlカラムが存在しません。マイグレーションを実行してください。",
            details: updateError.message,
            code: updateError.code,
            migrationSql: `ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_library_thumbnail_url ON user_library(thumbnail_url);`,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        {
          error: "データベース更新に失敗しました",
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      thumbnailUrl: finalUrl,
    });
  } catch (error: any) {
    console.error("Thumbnail upload route error", error);
    return NextResponse.json(
      { error: error?.message || "画像のアップロードに失敗しました" },
      { status: 500 }
    );
  }
}

