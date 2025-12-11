/**
 * Citation Field Code の生成・パース
 * Wordのフィールドコード方式を参考にした引用マーカー
 */

export interface CitationFieldCode {
  citationId: string;
  paperId: string;
  displayText?: string; // オプション：ユーザーが編集可能な表示テキスト
  fullMatch: string; // 完全なマッチ文字列（置換時に使用）
  startIndex: number; // 開始位置
  endIndex: number; // 終了位置
}

/**
 * フィールドコードを生成
 * 形式: [cite:citation_id:paper_id](表示テキスト)
 */
export function generateFieldCode(
  citationId: string,
  paperId: string,
  displayText?: string
): string {
  if (displayText) {
    return `[cite:${citationId}:${paperId}](${displayText})`;
  }
  return `[cite:${citationId}:${paperId}]`;
}

/**
 * パラグラフ内容からフィールドコードを抽出
 */
export function parseFieldCode(content: string): CitationFieldCode[] {
  const regex = /\[cite:([^:]+):([^\]]+)\](?:\(([^)]+)\))?/g;
  const matches: CitationFieldCode[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    matches.push({
      citationId: match[1],
      paperId: match[2],
      displayText: match[3] || undefined,
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * フィールドコードが存在するかチェック
 */
export function hasFieldCode(content: string): boolean {
  return /\[cite:[^:]+:[^\]]+\]/.test(content);
}

/**
 * 特定のcitationIdのフィールドコードを検索
 */
export function findFieldCodeByCitationId(
  content: string,
  citationId: string
): CitationFieldCode | null {
  const fieldCodes = parseFieldCode(content);
  return fieldCodes.find((fc) => fc.citationId === citationId) || null;
}

/**
 * 特定のpaperIdのフィールドコードを検索
 */
export function findFieldCodesByPaperId(
  content: string,
  paperId: string
): CitationFieldCode[] {
  const fieldCodes = parseFieldCode(content);
  return fieldCodes.filter((fc) => fc.paperId === paperId);
}



