/**
 * Citation Style ローダー
 * 優先度: DB > ローカルJSON > フォールバック
 */

import { CitationStyle } from "./types";
import natureStyle from "./system/nature.json";
import cellStyle from "./system/cell.json";
import scienceStyle from "./system/science.json";
import jcbStyle from "./system/jcb.json";
import jbcStyle from "./system/jbc.json";
import elifeStyle from "./system/elife.json";
import pnasStyle from "./system/pnas.json";
import harvardStyle from "./system/harvard.json";
import vancouverStyle from "./system/vancouver.json";

// システムスタイルのマップ
const SYSTEM_STYLES: Record<string, CitationStyle> = {
  nature: natureStyle as CitationStyle,
  cell: cellStyle as CitationStyle,
  science: scienceStyle as CitationStyle,
  jcb: jcbStyle as CitationStyle,
  jbc: jbcStyle as CitationStyle,
  elife: elifeStyle as CitationStyle,
  pnas: pnasStyle as CitationStyle,
  harvard: harvardStyle as CitationStyle,
  vancouver: vancouverStyle as CitationStyle,
};

/**
 * システムスタイルを読み込む
 */
function loadSystemStyle(id: string): CitationStyle | null {
  return SYSTEM_STYLES[id] || null;
}

/**
 * DBからスタイルを取得（将来実装）
 */
async function getStyleFromDB(id: string, userId?: string): Promise<CitationStyle | null> {
  // TODO: Supabaseから取得
  // 現時点では未実装
  return null;
}

/**
 * Citation Style を読み込む
 * 優先度: DB > ローカルJSON > フォールバック
 */
export async function loadCitationStyle(
  id: string,
  userId?: string
): Promise<CitationStyle> {
  // 1. DBから取得（ユーザーカスタム）
  if (userId) {
    const dbStyle = await getStyleFromDB(id, userId);
    if (dbStyle) return dbStyle;
  }

  // 2. システムスタイル（ローカルJSON）
  const systemStyle = loadSystemStyle(id);
  if (systemStyle) return systemStyle;

  // 3. フォールバック（Vancouver）
  return SYSTEM_STYLES.vancouver;
}

/**
 * 利用可能なスタイル一覧を取得
 */
export function getAvailableStyles(): CitationStyle[] {
  return Object.values(SYSTEM_STYLES);
}

/**
 * スタイルをIDで取得（同期版）
 */
export function getStyleById(id: string): CitationStyle | null {
  return loadSystemStyle(id);
}

/**
 * デフォルトスタイルを取得
 */
export function getDefaultStyle(): CitationStyle {
  return SYSTEM_STYLES.nature;
}

/**
 * システムスタイルかどうかを判定
 */
export function isSystemStyle(id: string): boolean {
  return id in SYSTEM_STYLES;
}



