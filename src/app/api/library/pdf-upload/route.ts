import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { decodePdfBase64 } from "@/lib/paper-ingest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const DEFAULT_BUCKET = process.env.SUPABASE_LIBRARY_BUCKET ?? "library-pdfs";

interface UploadRequestBody {
  paperId?: string;
  userId?: string;
  fileName?: string;
  content?: string;
}

async function ensureBucket(client: SupabaseClient, bucket: string) {
  const { data: bucketInfo, error } = await client.storage.getBucket(bucket);
  if (bucketInfo) {
    return bucketInfo;
  }

  if (error && (error as any)?.statusCode !== 404) {
    throw new Error(`バケット情報の取得に失敗しました: ${error.message}`);
  }

  const { data, error: createError } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 1024 * 1024 * 50, // 50MB
  });

  if (createError) {
    throw new Error(`バケットの作成に失敗しました: ${createError.message}`);
  }

  return data;
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  if (!safe.toLowerCase().endsWith(".pdf")) {
    return `${safe}.pdf`;
  }
  return safe;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UploadRequestBody;
    const paperId = body.paperId?.trim();
    const userIdInput = body.userId?.trim();
    const fileNameInput = body.fileName?.trim();
    const content = body.content;

    if (!paperId) {
      return NextResponse.json({ error: "paperId は必須です" }, { status: 400 });
    }

    if (!fileNameInput) {
      return NextResponse.json({ error: "fileName は必須です" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "content は必須です" }, { status: 400 });
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

    await ensureBucket(adminClient, DEFAULT_BUCKET);

    const buffer = decodePdfBase64(content);
    if (!buffer) {
      return NextResponse.json(
        { error: "PDFデータの解析に失敗しました" },
        { status: 400 }
      );
    }

    const safeFileName = sanitizeFileName(fileNameInput);
    const objectPath = `${resolvedUserId}/${paperId}/${Date.now()}-${randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await adminClient.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, buffer, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("PDF upload failed", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "PDFのアップロードに失敗しました" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath);

    const { error: updateError } = await adminClient
      .from("user_library")
      .update({
        pdf_url: publicUrl,
        pdf_storage_path: objectPath,
        pdf_file_name: safeFileName,
      })
      .eq("user_id", resolvedUserId)
      .eq("paper_id", paperId);

    if (updateError) {
      console.error("Failed to update user_library record", updateError);
      return NextResponse.json(
        { error: "データベース更新に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bucket: DEFAULT_BUCKET,
      path: objectPath,
      publicUrl,
      fileName: safeFileName,
    });
  } catch (error: any) {
    console.error("PDF upload route error", error);
    return NextResponse.json(
      { error: error?.message || "PDFのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}






