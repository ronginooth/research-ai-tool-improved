"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { getVersionString } from "@/lib/version";

const DEFAULT_USER = "demo-user-123";

interface Worksheet {
  id: string;
  title: string;
  content: string;
  structure: any;
  created_at: string;
  updated_at: string;
}

export default function ManuscriptPage() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWorksheets();
  }, []);

  const fetchWorksheets = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/worksheets?userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      setWorksheets(data.worksheets || []);
    } catch (error) {
      console.error("Failed to fetch worksheets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", DEFAULT_USER);
      formData.append("title", file.name.replace(/\.(md|csv)$/, ""));

      const response = await fetch("/api/manuscript/worksheets/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || "アップロードに失敗しました");
      }

      await fetchWorksheets();
      alert("ワークシートがアップロードされました");
    } catch (error: any) {
      console.error("Upload error:", error);
      const errorMessage = error?.message || error?.error || "アップロードに失敗しました";
      const errorDetails = error?.details ? `\n詳細: ${error.details}` : "";
      alert(`${errorMessage}${errorDetails}`);
    } finally {
      setUploading(false);
      // ファイル入力をリセット
      event.target.value = "";
    }
  };

  const handleDownloadTemplate = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      const response = await fetch("/api/manuscript/worksheets/template?format=csv");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "テンプレートのダウンロードに失敗しました" }));
        throw new Error(errorData.error || "テンプレートのダウンロードに失敗しました");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "manuscript-worksheet-template.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      
      try {
        a.click();
      } catch (clickError) {
        console.error("Click error:", clickError);
        throw new Error("ダウンロードの開始に失敗しました");
      } finally {
        // 少し遅延させてからクリーンアップ
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 100);
      }
    } catch (error: any) {
      console.error("Template download error:", error);
      const errorMessage = error?.message || error?.toString() || "テンプレートのダウンロードに失敗しました";
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このワークシートを削除しますか？")) return;

    try {
      const response = await fetch(
        `/api/manuscript/worksheets/${id}?userId=${DEFAULT_USER}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      await fetchWorksheets();
    } catch (error) {
      console.error("Delete error:", error);
      alert("削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
            {/* 中央の陰影アイコン */}
      <section className="mb-6">
        <div className="flex items-center justify-center gap-3">
          <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))', opacity: 0.15 }}>
            <svg width="80" height="80" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" fill="none" className="text-[var(--color-text)]"/>
              <path d="M12 10C12 10 14 9 16 9C18 9 20 10 20 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
              <path d="M12 10Q12 13 12 16Q12 19 12 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
              <path d="M20 10Q20 13 20 16Q20 19 20 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
              <path d="M12 14Q16 13 20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
              <path d="M12 18Q16 17 20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
            </svg>
          </div>
          {/* バージョン表示 */}
          <span className="text-sm text-[var(--color-text-secondary)] font-medium">
            {getVersionString()}
          </span>
        </div>
      </section>


      <div className="mb-6 flex gap-4 items-center">
        <label className="block">
          <span className="bg-[var(--color-primary)] text-[var(--color-surface)] px-4 py-2 rounded cursor-pointer hover:opacity-90 inline-block">
            {uploading ? "アップロード中..." : "ワークシートをアップロード (MD/CSV)"}
          </span>
          <input
            type="file"
            accept=".md,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <button
          onClick={(e) => {
            e.preventDefault();
            handleDownloadTemplate(e).catch((error) => {
              console.error("Unhandled download error:", error);
              alert("テンプレートのダウンロードに失敗しました");
            });
          }}
          className="bg-[var(--color-success)] text-[var(--color-surface)] px-4 py-2 rounded hover:opacity-90"
        >
          テンプレートをダウンロード (CSV)
        </button>
      </div>

      <div className="grid gap-4">
        {worksheets.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            ワークシートがありません。上記のボタンからアップロードしてください。
          </div>
        ) : (
          worksheets.map((worksheet) => (
            <div
              key={worksheet.id}
              className="border border-[var(--color-border)] rounded-lg p-4 hover:shadow-md transition-shadow bg-[var(--color-surface)]"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <Link
                    href={`/manuscript/${worksheet.id}`}
                    className="text-xl font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    {worksheet.title}
                  </Link>
                  <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                    作成日: {new Date(worksheet.created_at).toLocaleDateString("ja-JP")}
                    {worksheet.structure && (
                      <span className="ml-4">
                        パラグラフ数: {worksheet.structure.totalParagraphs || 0}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(worksheet.id)}
                  className="text-[var(--color-error)] hover:opacity-80 px-2 py-1"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}

