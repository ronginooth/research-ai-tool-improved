"use client";

import { useState } from "react";
import { Tag, Plus, X, Edit2 } from "lucide-react";

interface TagManagerProps {
  paperId: string;
  currentTags: string[];
  availableTags: string[];
  onAddTag: (paperId: string, tag: string) => void;
  onRemoveTag: (paperId: string, tag: string) => void;
  onCreateTag: (tag: string) => void;
  className?: string;
}

export default function TagManager({
  paperId,
  currentTags,
  availableTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  className = "",
}: TagManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !currentTags.includes(tag.trim())) {
      onAddTag(paperId, tag.trim());
      setNewTag("");
      setShowSuggestions(false);
    }
  };

  const handleCreateNewTag = () => {
    if (newTag.trim() && !availableTags.includes(newTag.trim())) {
      onCreateTag(newTag.trim());
      handleAddTag(newTag.trim());
    }
  };

  const filteredSuggestions = availableTags.filter(
    (tag) =>
      !currentTags.includes(tag) &&
      tag.toLowerCase().includes(newTag.toLowerCase())
  );

  return (
    <div
      className={`space-y-2 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 現在のタグ表示 */}
      <div className="flex flex-wrap gap-1">
        {currentTags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(paperId, tag);
              }}
              className="ml-1 hover:text-blue-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* 編集ボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-700"
        >
          <Edit2 className="h-3 w-3" />
          編集
        </button>
      </div>

      {/* タグ追加フォーム */}
      {isEditing && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={newTag}
              onChange={(e) => {
                setNewTag(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (availableTags.includes(newTag.trim())) {
                    handleAddTag(newTag.trim());
                  } else {
                    handleCreateNewTag();
                  }
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setNewTag("");
                  setShowSuggestions(false);
                }
              }}
              placeholder="タグを入力..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              autoFocus
            />

            {/* 提案タグ */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {filteredSuggestions.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTag(tag);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (availableTags.includes(newTag.trim())) {
                  handleAddTag(newTag.trim());
                } else {
                  handleCreateNewTag();
                }
              }}
              disabled={!newTag.trim()}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Plus className="h-3 w-3" />
              {availableTags.includes(newTag.trim()) ? "追加" : "新規作成"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(false);
                setNewTag("");
                setShowSuggestions(false);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
