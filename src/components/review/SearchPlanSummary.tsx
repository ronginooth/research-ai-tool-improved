"use client";

import { SearchPlan } from "@/types";
import { Lightbulb, Target, Database, Filter } from "lucide-react";

interface SearchPlanSummaryProps {
  plan: SearchPlan | null;
  onRegenerate?: () => void;
}

export default function SearchPlanSummary({ plan, onRegenerate }: SearchPlanSummaryProps) {
  if (!plan) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900">AI が提案した検索戦略</h3>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            再生成
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase text-purple-600">対象と焦点</div>
          <p className="text-sm text-purple-900 font-medium">
            <Target className="inline h-4 w-4 mr-1" />
            {plan.primaryTarget}
          </p>
          <ul className="text-sm text-purple-800 list-disc list-inside space-y-1">
            {plan.researchFocus.map((focus) => (
              <li key={focus}>{focus}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase text-purple-600">推奨キーワード</div>
          <div className="flex flex-wrap gap-2">
            {plan.coreKeywords.map((keyword) => (
              <span
                key={keyword}
                className="px-2 py-1 bg-white border border-purple-200 rounded-full text-xs text-purple-700"
              >
                {keyword}
              </span>
            ))}
            {plan.supportingKeywords.map((keyword) => (
              <span
                key={keyword}
                className="px-2 py-1 bg-white border border-pink-200 rounded-full text-xs text-pink-600"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase text-purple-600 mb-2">推奨クエリ</div>
          <div className="bg-white border border-purple-100 rounded-lg p-3 space-y-2">
            {plan.recommendedQueries.map((query) => (
              <div key={query} className="text-sm text-gray-700">
                • {query}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase text-purple-600 mb-2">
              推奨データベース
            </div>
            <div className="flex flex-wrap gap-2">
              {plan.recommendedDatabases.map((db) => (
                <span
                  key={db}
                  className="px-2 py-1 bg-white border border-purple-200 rounded-full text-xs text-purple-700 flex items-center gap-1"
                >
                  <Database className="h-3 w-3" /> {db}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase text-purple-600 mb-2">
              推奨フィルター
            </div>
            <div className="bg-white border border-purple-100 rounded-lg p-3 text-sm text-gray-700 space-y-1">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-purple-500" /> 最低引用数:
                {plan.recommendedFilters.minCitations ?? "指定なし"}
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-purple-500" /> 発行年:
                {plan.recommendedFilters.dateRange?.start || "指定なし"} ~
                {plan.recommendedFilters.dateRange?.end || ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-purple-100 rounded-lg p-4 text-sm text-gray-700 space-y-2">
        <div>
          <span className="font-semibold text-purple-900">ユーザー意図:</span>
          <p className="mt-1 text-gray-700">{plan.userIntentSummary}</p>
        </div>
        <div>
          <span className="font-semibold text-purple-900">戦略の根拠:</span>
          <p className="mt-1 text-gray-700">{plan.reasoning}</p>
        </div>
        <div className="text-xs text-purple-600">
          自信度: {(plan.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
