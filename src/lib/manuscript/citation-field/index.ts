/**
 * Citation Field Code System
 * Wordのフィールドコード方式を参考にした引用マーカーシステム
 */

export {
  generateFieldCode,
  parseFieldCode,
  hasFieldCode,
  findFieldCodeByCitationId,
  findFieldCodesByPaperId,
  type CitationFieldCode,
} from "./field-code";

export {
  renderCitationField,
  renderParagraphContent,
  getInTextFormatForStyle,
  type InTextCitationFormat,
  type InTextCitationConfig,
} from "./field-renderer";

export {
  extractFieldCodes,
  insertFieldCode,
  removeFieldCode,
  updateFieldCodeDisplayText,
  validateFieldCodes,
} from "./field-parser";



