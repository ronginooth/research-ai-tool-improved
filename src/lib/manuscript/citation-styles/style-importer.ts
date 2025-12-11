/**
 * Citation Style インポーター
 * JSON/URL/UIからのインポート処理
 */

import { CitationStyle } from "./types";

export interface StyleFormData {
  id: string;
  name: string;
  displayName: string;
  sort: CitationStyle["sort"];
  authorRules: CitationStyle["authorRules"];
  title: CitationStyle["title"];
  journal: CitationStyle["journal"];
  volume: CitationStyle["volume"];
  doi: CitationStyle["doi"];
  year: CitationStyle["year"];
  template: string;
}

export class StyleImporter {
  /**
   * JSON文字列からスタイルをインポート
   */
  async importFromJSON(jsonData: string): Promise<CitationStyle> {
    try {
      const style = JSON.parse(jsonData) as CitationStyle;
      this.validateStyle(style);
      return style;
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error}`);
    }
  }

  /**
   * URLからスタイルをインポート（CSL互換）
   */
  async importFromURL(url: string): Promise<CitationStyle> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch style from URL: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        // JSON形式の場合
        const jsonData = await response.text();
        return this.importFromJSON(jsonData);
      } else if (contentType?.includes("application/xml") || url.endsWith(".csl")) {
        // CSL形式の場合（将来実装）
        throw new Error("CSL format conversion is not yet implemented");
      } else {
        throw new Error("Unsupported content type");
      }
    } catch (error) {
      throw new Error(`Failed to import from URL: ${error}`);
    }
  }

  /**
   * UIフォームデータからスタイルをインポート
   */
  async importFromUI(formData: StyleFormData): Promise<CitationStyle> {
    const style: CitationStyle = {
      id: formData.id,
      name: formData.name,
      displayName: formData.displayName,
      isSystem: false,
      sort: formData.sort,
      authorRules: formData.authorRules,
      title: formData.title,
      journal: formData.journal,
      volume: formData.volume,
      doi: formData.doi,
      year: formData.year,
      template: formData.template,
    };

    this.validateStyle(style);
    return style;
  }

  /**
   * スタイルのバリデーション
   */
  private validateStyle(style: CitationStyle): void {
    if (!style.id || !style.name || !style.displayName) {
      throw new Error("Style must have id, name, and displayName");
    }

    if (!style.sort || !style.sort.mode) {
      throw new Error("Style must have sort configuration");
    }

    if (!style.authorRules) {
      throw new Error("Style must have authorRules");
    }

    if (!style.template) {
      throw new Error("Style must have template");
    }

    // テンプレートに必要なプレースホルダーが含まれているかチェック
    const requiredPlaceholders = ["{authors}", "{journal}", "{year}"];
    for (const placeholder of requiredPlaceholders) {
      if (!style.template.includes(placeholder)) {
        throw new Error(`Template must include ${placeholder}`);
      }
    }
  }
}



