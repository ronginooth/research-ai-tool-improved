import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフ追加
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const {
      worksheetId,
      title,
      description,
      sectionType,
      position, // "above" | "below"
      targetParagraphId,
    } = body;

    if (!worksheetId || !title || !sectionType) {
      return NextResponse.json(
        { error: "worksheetId, title, sectionType は必須です" },
        { status: 400 }
      );
    }

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // ワークシートの確認
    const { data: worksheet, error: worksheetError } = await adminClient
      .from("manuscript_worksheets")
      .select("id")
      .eq("id", worksheetId)
      .eq("user_id", userId)
      .single();

    if (worksheetError || !worksheet) {
      return NextResponse.json(
        { error: "ワークシートが見つかりません" },
        { status: 404 }
      );
    }

    let newParagraphNumber: string;

    if (targetParagraphId && position) {
      // 既存パラグラフの前後に追加
      const { data: targetParagraph, error: targetError } = await adminClient
        .from("manuscript_paragraphs")
        .select("paragraph_number")
        .eq("id", targetParagraphId)
        .eq("worksheet_id", worksheetId)
        .single();

      if (targetError || !targetParagraph) {
        return NextResponse.json(
          { error: "基準となるパラグラフが見つかりません" },
          { status: 404 }
        );
      }

      const targetNum = parseInt(targetParagraph.paragraph_number.replace("P", ""));
      
      // すべてのパラグラフを取得して数値で比較（文字列比較ではP10 < P2になってしまうため）
      const { data: allParagraphs } = await adminClient
        .from("manuscript_paragraphs")
        .select("id, paragraph_number")
        .eq("worksheet_id", worksheetId);

      if (position === "above") {
        // 上に追加: 既存のパラグラフ番号を1つずつ増やす
        const paragraphsToUpdate = (allParagraphs || []).filter((p) => {
          const num = parseInt(p.paragraph_number.replace("P", ""));
          return num >= targetNum;
        });

        // 後続のパラグラフ番号を更新（大きい番号から順に更新して重複を避ける）
        const sortedToUpdate = [...paragraphsToUpdate].sort((a, b) => {
          const numA = parseInt(a.paragraph_number.replace("P", ""));
          const numB = parseInt(b.paragraph_number.replace("P", ""));
          return numB - numA; // 大きい番号から順に
        });

        for (const p of sortedToUpdate) {
          const currentNum = parseInt(p.paragraph_number.replace("P", ""));
          const { error: updateError } = await adminClient
            .from("manuscript_paragraphs")
            .update({ paragraph_number: `P${currentNum + 1}` })
            .eq("id", p.id);
          
          if (updateError) {
            console.error(`Failed to update paragraph ${p.id}:`, updateError);
            throw updateError;
          }
        }

        newParagraphNumber = `P${targetNum}`;
        
        // 更新完了後、使用可能な番号を確認
        const { data: updatedParagraphsAfter } = await adminClient
          .from("manuscript_paragraphs")
          .select("paragraph_number")
          .eq("worksheet_id", worksheetId);

        const existingNumbersAfter = new Set(
          (updatedParagraphsAfter || []).map((p) => p.paragraph_number)
        );

        // もし既に存在する場合は、次の使用可能な番号を探す
        if (existingNumbersAfter.has(newParagraphNumber)) {
          let nextNum = targetNum;
          while (existingNumbersAfter.has(`P${nextNum}`)) {
            nextNum++;
          }
          newParagraphNumber = `P${nextNum}`;
        }
      } else {
        // 下に追加: 次の番号を使用
        // まず、後続のパラグラフ番号を更新（大きい番号から順に更新して重複を避ける）
        const paragraphsToUpdate = (allParagraphs || []).filter((p) => {
          const num = parseInt(p.paragraph_number.replace("P", ""));
          return num > targetNum;
        });

        const sortedToUpdate = [...paragraphsToUpdate].sort((a, b) => {
          const numA = parseInt(a.paragraph_number.replace("P", ""));
          const numB = parseInt(b.paragraph_number.replace("P", ""));
          return numB - numA; // 大きい番号から順に
        });

        for (const p of sortedToUpdate) {
          const currentNum = parseInt(p.paragraph_number.replace("P", ""));
          const { error: updateError } = await adminClient
            .from("manuscript_paragraphs")
            .update({ paragraph_number: `P${currentNum + 1}` })
            .eq("id", p.id);
          
          if (updateError) {
            console.error(`Failed to update paragraph ${p.id}:`, updateError);
            throw updateError;
          }
        }

        // 更新完了後、使用可能な番号を確認
        newParagraphNumber = `P${targetNum + 1}`;
        
        // 念のため、更新後のパラグラフを再取得して重複チェック
        const { data: updatedParagraphs } = await adminClient
          .from("manuscript_paragraphs")
          .select("paragraph_number")
          .eq("worksheet_id", worksheetId);

        const existingNumbers = new Set(
          (updatedParagraphs || []).map((p) => p.paragraph_number)
        );

        // もし既に存在する場合は、次の使用可能な番号を探す
        if (existingNumbers.has(newParagraphNumber)) {
          let nextNum = targetNum + 1;
          while (existingNumbers.has(`P${nextNum}`)) {
            nextNum++;
          }
          newParagraphNumber = `P${nextNum}`;
        }
      }
    } else {
      // 最後に追加
      const { data: lastParagraph } = await adminClient
        .from("manuscript_paragraphs")
        .select("paragraph_number")
        .eq("worksheet_id", worksheetId)
        .order("paragraph_number", { ascending: false })
        .limit(1)
        .single();

      if (lastParagraph) {
        const lastNum = parseInt(lastParagraph.paragraph_number.replace("P", ""));
        newParagraphNumber = `P${lastNum + 1}`;
      } else {
        newParagraphNumber = "P1";
      }
    }

    // 挿入前に再度確認（並行処理による重複を防ぐ）
    const { data: finalCheck } = await adminClient
      .from("manuscript_paragraphs")
      .select("paragraph_number")
      .eq("worksheet_id", worksheetId)
      .eq("paragraph_number", newParagraphNumber)
      .maybeSingle();

    if (finalCheck) {
      // 既に存在する場合、次の使用可能な番号を探す
      const { data: allFinalParagraphs } = await adminClient
        .from("manuscript_paragraphs")
        .select("paragraph_number")
        .eq("worksheet_id", worksheetId);

      const existingNumbers = new Set(
        (allFinalParagraphs || []).map((p) => p.paragraph_number)
      );

      let nextNum = parseInt(newParagraphNumber.replace("P", "")) || 1;
      while (existingNumbers.has(`P${nextNum}`)) {
        nextNum++;
      }
      newParagraphNumber = `P${nextNum}`;
    }

    // 新規パラグラフを作成
    const { data: newParagraph, error: insertError } = await adminClient
      .from("manuscript_paragraphs")
      .insert({
        worksheet_id: worksheetId,
        paragraph_number: newParagraphNumber,
        section_type: sectionType,
        title,
        description: description || "",
        content: "",
        status: "pending",
        word_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    return NextResponse.json({ paragraph: newParagraph });
  } catch (error: any) {
    console.error("Paragraph creation error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの作成に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * パラグラフ一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const worksheetId = searchParams.get("worksheetId");
    const sectionType = searchParams.get("sectionType");

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    console.log(`[Paragraphs API] Fetching paragraphs - worksheetId: ${worksheetId}, userId: ${userId}, sectionType: ${sectionType}`);

    // まずワークシートが存在し、ユーザーがアクセス可能か確認
    if (worksheetId) {
      const { data: worksheet, error: worksheetError } = await adminClient
        .from("manuscript_worksheets")
        .select("id, user_id")
        .eq("id", worksheetId)
        .eq("user_id", userId)
        .single();

      if (worksheetError) {
        console.error("[Paragraphs API] Worksheet check error:", worksheetError);
        throw worksheetError;
      }

      if (!worksheet) {
        return NextResponse.json(
          { error: "ワークシートが見つかりません" },
          { status: 404 }
        );
      }
    }

    // パラグラフを取得（JOINを使わずに直接取得）
    let query = adminClient
      .from("manuscript_paragraphs")
      .select("*");

    if (worksheetId) {
      query = query.eq("worksheet_id", worksheetId);
    }

    if (sectionType) {
      query = query.eq("section_type", sectionType);
    }

    // すべて取得してから数値でソート（文字列ソートではP1, P10, P2...となるため）
    const { data, error } = await query;

    if (error) {
      console.error("[Paragraphs API] Query error:", error);
      throw error;
    }

    // paragraph_numberを数値でソート
    const sortedData = (data || []).sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
      return numA - numB;
    });

    console.log(`[Paragraphs API] Found ${sortedData.length} paragraphs`);

    return NextResponse.json({ paragraphs: sortedData });
  } catch (error: any) {
    console.error("Paragraphs fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの取得に失敗しました" },
      { status: 500 }
    );
  }
}

