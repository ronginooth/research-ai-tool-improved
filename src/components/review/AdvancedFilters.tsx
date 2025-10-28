"use client";

import { useState } from "react";
import { Settings, Database, Calendar, Filter, Award } from "lucide-react";

export interface FilterSettings {
  outputType: "auto" | "structured" | "dynamic" | "deep";
  minCitations: number;
  databases: string[];
  journalQuality: "all" | "q1" | "q2" | "q3" | "q4";
  internetFilter: "all" | "gov" | "edu";
  dateRange: {
    start: string;
    end: string;
  };
}

interface AdvancedFiltersProps {
  filters: FilterSettings;
  onFiltersChange: (filters: FilterSettings) => void;
}

export default function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof FilterSettings, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const updateDateRange = (key: "start" | "end", value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
      	[key]: value,
      },
    });
  };

  const toggleDatabase = (database: string) => {
    const newDatabases = filters.databases.includes(database)
      ? filters.databases.filter((db) => db !== database)
      : [...filters.databases, database];
    updateFilter("databases", newDatabases);
  };

  const outputTypes = [
    {
      value: "auto",
      label: "Auto（自動）",
      description: "AIが最適な形式を選択",
    },
    {
      value: "structured",
      label: "Structured Literature Review",
      description: "構造化された文献レビュー",
    },
    {
      value: "dynamic",
      label: "Dynamic Research Assistant",
      description: "動的リサーチアシスタント",
    },
    { value: "deep", label: "Deep Research", description: "深堀りリサーチ" },
  ];

  const databases = [
    {
      value: "semantic_scholar",
      label: "Semantic Scholar",
      description: "包括的な学術検索",
    },
    {
      value: "openalex",
      label: "OpenAlex",
      description: "オープンアクセス巨大DB",
    },
    { value: "pubmed", label: "PubMed", description: "医学・生命科学専門" },
    { value: "arxiv", label: "arXiv", description: "最新研究・プレプリント" },
  ];

  const journalQualities = [
    { value: "all", label: "All（すべて）" },
    { value: "q1", label: "Q1（最高品質）" },
    { value: "q2", label: "Q2（高品質）" },
    { value: "q3", label: "Q3（中品質）" },
    { value: "q4", label: "Q4（標準品質）" },
  ];

  const internetFilters = [
    { value: "all", label: "All websites（すべて）" },
    { value: "gov", label: ".gov（政府サイト）" },
    { value: "edu", label: ".edu（教育機関サイト）" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium mb-4"
      >
        <Settings className="h-5 w-5" />
        高度なフィルター設定
        <span className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Filter className="h-4 w-4 inline mr-1" />
              アウトプットのタイプ
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outputTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => updateFilter("outputType", type.value)}
                  className={`p-3 text-left border-2 rounded-lg transition-colors ${
                    filters.outputType === type.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最低引用数: {filters.minCitations}
            </label>
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={filters.minCitations}
              onChange={(e) => updateFilter("minCitations", parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1000+</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Database className="h-4 w-4 inline mr-1" />
              検索するデータベース
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {databases.map((db) => (
                <button
                  key={db.value}
                  onClick={() => toggleDatabase(db.value)}
                  className={`p-3 text-left border-2 rounded-lg transition-colors ${
                    filters.databases.includes(db.value)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{db.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{db.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Award className="h-4 w-4 inline mr-1" />
              ジャーナルの質
            </label>
            <div className="flex flex-wrap gap-2">
              {journalQualities.map((quality) => (
                <button
                  key={quality.value}
                  onClick={() => updateFilter("journalQuality", quality.value)}
                  className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                    filters.journalQuality === quality.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {quality.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              インターネットフィルター
            </label>
            <div className="flex flex-wrap gap-2">
              {internetFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => updateFilter("internetFilter", filter.value)}
                  className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                    filters.internetFilter === filter.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Calendar className="h-4 w-4 inline mr-1" />
              出版日範囲
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">開始日</label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateDateRange("start", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">終了日</label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateDateRange("end", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                onFiltersChange({
                  outputType: "auto",
                  minCitations: 0,
                  databases: ["semantic_scholar"],
                  journalQuality: "all",
                  internetFilter: "all",
                  dateRange: { start: "", end: "" },
                });
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              フィルターをリセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
