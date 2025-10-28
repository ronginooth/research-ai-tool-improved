"use client";

import { useState } from "react";
import { Download, Share2, FileText, File, Copy, Check } from "lucide-react";
import { toast } from "react-hot-toast";

interface ReviewActionsProps {
  review: string;
  topic: string;
  papers?: any[];
  provider?: string;
}

export default function ReviewActions({
  review,
  topic,
  papers = [],
  provider = "AI",
}: ReviewActionsProps) {
  const [copied, setCopied] = useState(false);

  const generateWordContent = () => {
    const content = `
# ${topic}に関する文献レビュー

## 概要
${review}

## 引用文献
${papers
  .map(
    (paper, index) => `
### ${index + 1}. ${paper.title}
- **著者**: ${paper.authors}
- **年**: ${paper.year}
- **掲載誌**: ${paper.venue || "不明"}
- **引用数**: ${paper.citationCount || 0}
- **URL**: ${paper.url || "不明"}
- **要約**: ${paper.abstract || "要約なし"}
`
  )
  .join("\n")}

---
生成日時: ${new Date().toLocaleString("ja-JP")}
AI プロバイダー: ${provider}
    `.trim();

    return content;
  };

  const downloadAsWord = () => {
    const content = generateWordContent();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${topic}_文献レビュー_${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("レビューをダウンロードしました");
  };

  const downloadAsPDF = () => {
    // 簡易的なPDF生成（実際の実装ではjsPDFやPuppeteerを使用）
    const content = generateWordContent();
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${topic}に関する文献レビュー</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 30px; }
            h3 { color: #888; margin-top: 20px; }
            .paper { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .meta { font-size: 0.9em; color: #666; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <h1>${topic}に関する文献レビュー</h1>
          <div style="white-space: pre-wrap;">${review.replace(
            /\n/g,
            "<br>"
          )}</div>
          <h2>引用文献</h2>
          ${papers
            .map(
              (paper, index) => `
            <div class="paper">
              <h3>${index + 1}. ${paper.title}</h3>
              <div class="meta">
                <strong>著者:</strong> ${paper.authors}<br>
                <strong>年:</strong> ${paper.year}<br>
                <strong>掲載誌:</strong> ${paper.venue || "不明"}<br>
                <strong>引用数:</strong> ${paper.citationCount || 0}<br>
                <strong>URL:</strong> ${paper.url || "不明"}
              </div>
              <p><strong>要約:</strong> ${paper.abstract || "要約なし"}</p>
            </div>
          `
            )
            .join("")}
          <hr>
          <p><small>生成日時: ${new Date().toLocaleString(
            "ja-JP"
          )} | AI プロバイダー: ${provider}</small></p>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      toast.success("PDF印刷ダイアログを開きました");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateWordContent());
      setCopied(true);
      toast.success("レビューをクリップボードにコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("コピーに失敗しました");
    }
  };

  const shareLink = () => {
    const shareData = {
      title: `${topic}に関する文献レビュー`,
      text: `AIが生成した「${topic}」に関する包括的な文献レビューです。`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData).catch((error) => {
        console.error("シェアエラー:", error);
        fallbackShare();
      });
    } else {
      fallbackShare();
    }
  };

  const fallbackShare = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.success("リンクをクリップボードにコピーしました");
      })
      .catch(() => {
        toast.error("シェアに失敗しました");
      });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">レビューの利用</h3>
      <p className="text-sm text-gray-600 mb-4">
        生成されたレビューを様々な形式でダウンロード・共有できます
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={downloadAsWord}
          className="flex flex-col items-center gap-2 p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <FileText className="h-6 w-6 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Word/Text</span>
          <span className="text-xs text-blue-600">ダウンロード</span>
        </button>

        <button
          onClick={downloadAsPDF}
          className="flex flex-col items-center gap-2 p-4 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors"
        >
          <File className="h-6 w-6 text-red-600" />
          <span className="text-sm font-medium text-red-900">PDF</span>
          <span className="text-xs text-red-600">印刷</span>
        </button>

        <button
          onClick={copyToClipboard}
          className="flex flex-col items-center gap-2 p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
        >
          {copied ? (
            <Check className="h-6 w-6 text-green-600" />
          ) : (
            <Copy className="h-6 w-6 text-green-600" />
          )}
          <span className="text-sm font-medium text-green-900">
            {copied ? "コピー済み" : "コピー"}
          </span>
          <span className="text-xs text-green-600">クリップボード</span>
        </button>

        <button
          onClick={shareLink}
          className="flex flex-col items-center gap-2 p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
        >
          <Share2 className="h-6 w-6 text-purple-600" />
          <span className="text-sm font-medium text-purple-900">シェア</span>
          <span className="text-xs text-пurple-600">リンク共有</span>
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{papers.length}</div>
            <div className="text-xs text-gray-600">引用論文数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {review.length.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">文字数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{provider}</div>
            <div className="text-xs text-gray-600">AI プロバイダー</div>
          </div>
        </div>
      </div>
    </div>
  );
}
