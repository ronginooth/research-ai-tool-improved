/**
 * Citation Field Code パーサー
 * パラグラフ内容からフィールドコードを抽出・操作
 */

import { CitationFieldCode, parseFieldCode } from "./field-code";

/**
 * パラグラフ内容からすべてのフィールドコードを抽出
 */
export function extractFieldCodes(content: string): CitationFieldCode[] {
  return parseFieldCode(content);
}

/**
 * フィールドコードをパラグラフ内容に挿入
 */
export function insertFieldCode(
  content: string,
  fieldCode: string,
  position: number
): string {
  return (
    content.substring(0, position) +
    fieldCode +
    content.substring(position)
  );
}

/**
 * フィールドコードを削除
 */
export function removeFieldCode(
  content: string,
  citationId: string
): string {
  const fieldCodes = parseFieldCode(content);
  const targetCode = fieldCodes.find((fc) => fc.citationId === citationId);

  if (targetCode) {
    return (
      content.substring(0, targetCode.startIndex) +
      content.substring(targetCode.endIndex)
    );
  }

  return content;
}

/**
 * フィールドコードの表示テキストを更新
 */
export function updateFieldCodeDisplayText(
  content: string,
  citationId: string,
  newDisplayText: string
): string {
  const fieldCodes = parseFieldCode(content);
  const targetCode = fieldCodes.find((fc) => fc.citationId === citationId);

  if (targetCode) {
    const newFieldCode = `[cite:${targetCode.citationId}:${targetCode.paperId}](${newDisplayText})`;
    return (
      content.substring(0, targetCode.startIndex) +
      newFieldCode +
      content.substring(targetCode.endIndex)
    );
  }

  return content;
}

/**
 * パラグラフ内容内のフィールドコードを検証
 */
export function validateFieldCodes(
  content: string,
  validCitationIds: Set<string>
): { valid: boolean; invalidCodes: CitationFieldCode[] } {
  const fieldCodes = parseFieldCode(content);
  const invalidCodes = fieldCodes.filter(
    (fc) => !validCitationIds.has(fc.citationId)
  );

  return {
    valid: invalidCodes.length === 0,
    invalidCodes,
  };
}



