// 基本型定義
export interface Paper {
  id: string;
  paperId: string;
  title: string;
  authors: string;
  year: number;
  month?: number | null; // 1-12
  day?: number | null; // 1-31
  publicationDate?: string; // ISO 8601形式: "2024-05-15"（元のAPIレスポンスを保持）
  abstract: string;
  url: string;
  citationCount: number;
  venue: string;
  volume?: string; // 巻号
  issue?: string; // 号
  pages?: string; // ページ番号（例: "123-145"）
  source?: string;
  searchQuery?: string;
  isOpenAccess?: boolean;
  doi?: string;
  pdfUrl?: string;
  pdfStoragePath?: string | null;
  pdfFileName?: string | null;
  keywords?: string[];
  fieldClassification?: string[];
  impactFactor?: number;
  readabilityScore?: number;
  keyPhrases?: string[];
  relatedAuthors?: string[];
  citationContext?: CitationContext[];
}

export interface CitationContext {
  citingPaper: string;
  context: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface EnrichedPaper extends Paper {
  impactFactor: number;
  fieldClassification: string[];
  readabilityScore: number;
  keyPhrases: string[];
  relatedAuthors: string[];
  citationContext: CitationContext[];
}

// AI プロバイダー関連
export type AIProvider = "openai" | "gemini" | "claude";

export interface AIProviderConfig {
  name: AIProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

// 検索関連
export interface SourceStats {
  source: string;
  fetched: number; // 取得件数
  displayed: number; // 表示件数
}

export interface SearchResult {
  papers: Paper[];
  total: number;
  error?: string;
  retryAfter?: number;
  searchMethod?: string;
  queries?: string[];
  success?: boolean;
  message?: string;
  plan?: SearchPlan;
  sourceStats?: SourceStats[]; // 各ソースの統計情報
  searchLogic?: {
    originalQuery: string; // 元の検索クエリ
    translatedQuery: string; // 翻訳後のクエリ
    translationMethod: "gemini" | "fallback" | "none"; // 翻訳方法
    searchedSources: string[]; // 実際に検索したソース
    userIntent?: {
      mainConcepts: string[]; // 主要な概念
      compoundTerms: string[]; // 複合語やフレーズ
      searchPurpose: string; // 検索の目的
      keyPhrases: string[]; // 引用符で囲むべきフレーズ
    };
    processingSteps?: Array<{
      step: string;
      description: string;
      query?: string;
      details?: any;
    }>; // クエリ処理の途中経過
  };
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  minRelevance?: number;
  maxResults?: number;
  filters?: AdvancedSearchFilters;
  plan?: SearchPlan;
}

export interface SearchPlan {
  primaryTarget: string;
  researchFocus: string[];
  coreKeywords: string[];
  supportingKeywords: string[];
  excludeKeywords: string[];
  recommendedQueries: string[];
  recommendedDatabases: string[];
  recommendedFilters: {
    minCitations?: number;
    dateRange?: { start?: string; end?: string };
  };
  reasoning: string;
  userIntentSummary: string;
  confidence: number;
}

export interface AdvancedSearchFilters {
  // 基本フィルター
  dateRange?: { start: string; end: string };
  minCitations?: number;
  journalQuality?: "Q1" | "Q2" | "Q3" | "Q4" | "all";

  // 高度フィルター
  studyTypes?: ("empirical" | "theoretical" | "review" | "meta-analysis")[];
  methodologies?: ("quantitative" | "qualitative" | "mixed")[];
  disciplines?: string[];
  authors?: string[];
  institutions?: string[];
  fundingSources?: string[];

  // ユーザーライブラリフィルター
  includeUserLibrary?: boolean;
  excludeUserLibrary?: boolean;
  specificCollections?: string[];

  // データベース選択
  databases?: string[];
  internetFilter?: "all" | "gov" | "edu";
}

// レビュー関連
export interface Review {
  id: string;
  topic: string;
  content: string;
  papers: Paper[];
  provider: AIProvider;
  createdAt: string;
  updatedAt: string;
  userId: string;
  status: "draft" | "published" | "archived";
  metadata: ReviewMetadata;
}

export interface ReviewMetadata {
  wordCount: number;
  readingTime: number;
  citationCount: number;
  keyTopics: string[];
  confidence: number;
  quality: "low" | "medium" | "high";
}

// 引用マップ関連
export interface CitationMap {
  center: Paper;
  citedBy: Paper[];
  references: Paper[];
  indirectConnections: Paper[];
  networkMetrics: NetworkMetrics;
}

export interface NetworkMetrics {
  centrality: number;
  betweenness: number;
  clustering: number;
  density: number;
  pathLength: number;
}

// 研究ギャップ関連
export interface ResearchGap {
  id: string;
  title: string;
  description: string;
  category: "methodological" | "domain" | "temporal" | "integrative";
  severity: "low" | "medium" | "high" | "critical";
  researchQuestions: string[];
  feasibilityScore: number;
  potentialImpact: number;
  relatedPapers: Paper[];
  suggestedApproaches: string[];
}

// PDF対話関連
export interface ProcessedPDF {
  id: string;
  text: string;
  structure: PDFStructure;
  sections: PDFSection[];
  keyPoints: string[];
  embeddings: number[][];
  metadata: PDFMetadata;
}

export interface PDFStructure {
  title: string;
  authors: string[];
  abstract: string;
  sections: string[];
  references: string[];
}

export interface PDFSection {
  title: string;
  content: string;
  pageNumber: number;
  startIndex: number;
  endIndex: number;
}

export interface PDFMetadata {
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: string;
  language: string;
  subject: string;
}

export interface PDFChatResponse {
  answer: string;
  relevantSections: PDFSection[];
  confidence: number;
  suggestedFollowups: string[];
  citations: string[];
}

// ライター関連
export interface WritingMode {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface WritingOptions {
  academicLevel: "undergraduate" | "graduate" | "postgraduate" | "professional";
  citationStyle: "APA" | "MLA" | "Chicago" | "IEEE" | "Harvard";
  targetAudience: "academic" | "professional" | "general";
  tone: "formal" | "informal" | "neutral";
  length: "short" | "medium" | "long";
}

export interface EnhancedText {
  original: string;
  enhanced: string;
  improvements: TextImprovement[];
  readabilityScore: number;
  suggestedCitations: Reference[];
}

export interface TextImprovement {
  type: "grammar" | "style" | "clarity" | "structure" | "flow";
  original: string;
  improved: string;
  explanation: string;
  confidence: number;
}

export interface Reference {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  url: string;
  relevance: number;
  citation: string;
}

// ダッシュボード関連
export interface DashboardStats {
  totalPapers: number;
  totalReviews: number;
  totalProjects: number;
  recentActivity: Activity[];
  topKeywords: KeywordStats[];
  researchTrends: TrendData[];
}

export interface Activity {
  id: string;
  type: "search" | "review" | "save" | "share";
  description: string;
  timestamp: string;
  userId: string;
}

export interface KeywordStats {
  keyword: string;
  count: number;
  trend: "up" | "down" | "stable";
  change: number;
}

export interface TrendData {
  date: string;
  value: number;
  category: string;
}

// プロジェクト関連
export interface Project {
  id: string;
  name: string;
  description: string;
  papers: Paper[];
  reviews: Review[];
  collaborators: User[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived" | "shared";
  tags: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "user" | "collaborator";
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark" | "auto";
  language: string;
  defaultProvider: AIProvider;
  notifications: NotificationSettings;
  searchSettings: SearchSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  weekly: boolean;
  mentions: boolean;
}

export interface SearchSettings {
  defaultFilters: AdvancedSearchFilters;
  autoSave: boolean;
  maxResults: number;
  sortBy: "relevance" | "date" | "citations";
}

// API レスポンス関連
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// エラー関連
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// 設定関連
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  search: {
    maxResults: number;
    cacheTimeout: number;
    enableSemantic: boolean;
  };
  ai: {
    providers: AIProviderConfig[];
    fallbackOrder: AIProvider[];
  };
  features: {
    citationMap: boolean;
    researchGap: boolean;
    pdfChat: boolean;
    advancedWriter: boolean;
    collaboration: boolean;
  };
}

export interface LibraryItem {
  id: string;
  userId: string;
  paperId: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  url: string;
  citationCount: number;
  venue?: string;
  tags?: string[];
  notes?: string | null;
  aiSummary?: PaperAIInsights | null;
  aiSummaryUpdatedAt?: string | null;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  pdf_url?: string | null;
  html_url?: string | null;
  pdfStoragePath?: string | null;
  pdf_file_name?: string | null;
  pdfFileName?: string | null;
  grobidTeiXml?: string | null;
  grobid_tei_xml?: string | null;
  grobidData?: any | null;
  grobid_data?: any | null;
  grobidProcessedAt?: string | null;
  grobid_processed_at?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LibraryPaper extends LibraryItem {
  paper_id?: string;
  citation_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaperAIInsights {
  figureInsights: string[];
  ochiaiReview: {
    overview: string;
    background: string;
    method: string;
    results: string;
    discussion: string;
    futureWork: string;
  };
  caveats?: string[];
  sources?: string[];
}

export interface ReviewListItem {
  id: string;
  title: string;
  topic: string;
  content: string;
  createdAt: string;
}

export interface InsightsChatReference {
  id: string;
  source: "html" | "pdf";
  sectionTitle: string | null;
  pageNumber: number | null;
  similarity: number;
  excerpt: string;
  chunkType?: string; // figure_html / figure_pdf など
}

export interface InsightsChatParagraph {
  content: string;
  contextIds?: string[];
}

export interface InsightsChatExternalReference {
  title: string;
  url?: string;
  summary?: string;
  authors?: string;
  relation?: string;
}

export interface InsightsChatResponse {
  paperId: string;
  userId: string;
  question: string;
  paragraphs: InsightsChatParagraph[];
  references: InsightsChatReference[];
  externalReferences?: InsightsChatExternalReference[];
  followups?: string[];
  relatedPapers?: Paper[];
}

export interface InsightsChatSession {
  id: string;
  question: string;
  response: InsightsChatResponse;
  createdAt: string;
}
