"use client";

import { useState, useEffect, useRef } from "react";
import { Tag, Plus, X, Edit2, Check } from "lucide-react";

interface TagManagerProps {
  paperId: string;
  currentTags: string[];
  availableTags: string[];
  onAddTag: (paperId: string, tag: string) => void;
  onRemoveTag: (paperId: string, tag: string) => void;
  onCreateTag: (tag: string) => void;
  className?: string;
  allPapers?: Array<{ tags?: string[] }>; // タグの使用頻度を計算するために全論文データを渡す
}

export default function TagManager({
  paperId,
  currentTags,
  availableTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  className = "",
  allPapers = [],
}: TagManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // タグの使用頻度を計算
  const getTagFrequency = (): Map<string, number> => {
    const frequency = new Map<string, number>();
    allPapers.forEach((paper) => {
      const tags = paper.tags || [];
      tags.forEach((tag) => {
        frequency.set(tag, (frequency.get(tag) || 0) + 1);
      });
    });
    return frequency;
  };

  // 使用頻度の高いタグを取得（最大10件、多い順）
  const getPopularTags = (): string[] => {
    const frequency = getTagFrequency();
    const tagsWithFrequency = availableTags
      .filter((tag) => !currentTags.includes(tag))
      .map((tag) => ({
        tag,
        count: frequency.get(tag) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => item.tag);
    return tagsWithFrequency;
  };

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isEditing]);

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !currentTags.includes(tag.trim())) {
      onAddTag(paperId, tag.trim());
      setNewTag("");
      setShowSuggestions(false);
      setShowCreateConfirm(false);
    }
  };

  const handleCreateNewTag = () => {
    if (newTag.trim() && !availableTags.includes(newTag.trim())) {
      onCreateTag(newTag.trim());
      handleAddTag(newTag.trim());
    }
  };

  // 人気タグ（使用頻度の高いタグ、最大10件）
  const popularTags = getPopularTags();

  // 検索フィルターを人気タグに適用
  const filteredPopularTags = newTag.trim()
    ? popularTags.filter((tag) =>
        tag.toLowerCase().includes(newTag.toLowerCase())
      )
    : popularTags; // 検索窓が空の場合は人気タグを全部表示

  // 完全一致チェック（全タグから）
  const exactMatch = availableTags.find(
    (tag) => tag.toLowerCase() === newTag.trim().toLowerCase()
  );

  const hasExactMatch = !!exactMatch && !currentTags.includes(exactMatch);
  const hasPartialMatches = filteredPopularTags.length > 0;
  const shouldShowCreateConfirm = 
    newTag.trim().length > 0 && 
    !hasExactMatch && 
    !hasPartialMatches &&
    !currentTags.includes(newTag.trim());
  
  // 表示する提案タグ（検索中は絞り込まれた人気タグ、そうでない場合は人気タグ全部）
  const displaySuggestions = filteredPopularTags;

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
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-xs text-blue-700 dark:text-blue-300"
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(paperId, tag);
              }}
              className="ml-1 hover:text-blue-900 dark:hover:text-blue-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* 編集ボタン */}
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setNewTag("");
              setShowSuggestions(true); // 編集開始時に人気タグを表示
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Plus className="h-3 w-3" />
            タグを追加
          </button>
        )}
      </div>

      {/* タグ追加フォーム */}
      {isEditing && (
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => {
                setNewTag(e.target.value);
                setShowSuggestions(true); // 検索窓が空でも人気タグを表示
                setShowCreateConfirm(false);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowSuggestions(newTag.length > 0);
              }}
              onFocus={() => {
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (hasExactMatch) {
                    // 完全一致する既存タグがある場合は追加
                    handleAddTag(exactMatch);
                  } else if (displaySuggestions.length > 0) {
                    // 絞り込まれた人気タグがある場合は最初の候補を追加
                    handleAddTag(displaySuggestions[0]);
                  } else if (newTag.trim() && !currentTags.includes(newTag.trim())) {
                    // 既存タグがない場合は新規作成確認を表示
                    setShowCreateConfirm(true);
                  }
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setNewTag("");
                  setShowSuggestions(false);
                  setShowCreateConfirm(false);
                } else if (e.key === "ArrowDown" && displaySuggestions.length > 0) {
                  e.preventDefault();
                  // キーボードナビゲーション（必要に応じて実装）
                }
              }}
              placeholder="タグを検索または入力..."
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />

            {/* 提案タグドロップダウン */}
            {showSuggestions && (displaySuggestions.length > 0 || hasExactMatch) && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {hasExactMatch && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTag(exactMatch);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center gap-2 border-b border-[var(--color-border)]"
                  >
                    <Check className="h-4 w-4 text-[var(--color-primary)]" />
                    <span className="font-medium">{exactMatch}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">（一致）</span>
                  </button>
                )}
                {displaySuggestions.length > 0 && (
                  <>
                    {!newTag.trim() && (
                      <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-[var(--color-background)]">
                        よく使われるタグ
                      </div>
                    )}
                    {displaySuggestions.slice(0, 10).map((tag) => {
                      const frequency = getTagFrequency().get(tag) || 0;
                      return (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddTag(tag);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center justify-between"
                        >
                          <span>{tag}</span>
                          {frequency > 0 && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {frequency}件
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* 新規作成確認 */}
            {showCreateConfirm && shouldShowCreateConfirm && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-sm text-[var(--color-text)] mb-2">
                  「<span className="font-semibold">{newTag.trim()}</span>」というタグは存在しません。
                  <br />
                  新規作成しますか？
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNewTag();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-surface)] hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" />
                    新規作成
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateConfirm(false);
                    }}
                    className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!showCreateConfirm && (
              <>
                {hasExactMatch ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTag(exactMatch);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-surface)] hover:opacity-90"
                  >
                    <Check className="h-3 w-3" />
                    追加
                  </button>
                ) : shouldShowCreateConfirm ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateConfirm(true);
                    }}
                    disabled={!newTag.trim()}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3" />
                    新規作成
                  </button>
                ) : displaySuggestions.length > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTag(displaySuggestions[0]);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-surface)] hover:opacity-90"
                  >
                    <Check className="h-3 w-3" />
                    最初の候補を追加
                  </button>
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(false);
                    setNewTag("");
                    setShowSuggestions(false);
                    setShowCreateConfirm(false);
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-background)]"
                >
                  キャンセル
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
