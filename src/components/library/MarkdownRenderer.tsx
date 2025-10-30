"use client";

import React from "react";
import type { LibraryPaper } from "@/types";

interface MarkdownRendererProps {
  content: string;
  papers: LibraryPaper[];
  onPaperClick?: (paperId: string) => void;
}

export default function MarkdownRenderer({
  content,
  papers,
  onPaperClick,
}: MarkdownRendererProps) {
  // 論文の引用パターンを検出する関数
  const findPaperReferences = (text: string) => {
    const patterns = [
      // [1], [2], [3] のような番号引用
      /\[(\d+)\]/g,
      // (Author et al., 2023) のような著者年引用
      /\(([^)]+\s\d{4})\)/g,
      // "Title" (Author, 2023) のようなタイトル引用
      /"([^"]+)"\s*\(([^)]+,\s*\d{4})\)/g,
    ];

    const references: Array<{
      type: "number" | "author_year" | "title_author_year";
      match: string;
      number?: string;
      author?: string;
      year?: string;
      title?: string;
      paper?: LibraryPaper;
    }> = [];

    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (index === 0) {
          // 番号引用
          const number = parseInt(match[1]);
          if (number >= 1 && number <= papers.length) {
            references.push({
              type: "number",
              match: match[0],
              number: match[1],
              paper: papers[number - 1],
            });
          }
        } else if (index === 1) {
          // 著者年引用
          const authorYear = match[1];
          const paper = papers.find(
            (p) =>
              p.authors
                ?.toLowerCase()
                .includes(authorYear.split(",")[0].toLowerCase()) ||
              p.year?.toString() === authorYear.split(",").pop()?.trim()
          );
          references.push({
            type: "author_year",
            match: match[0],
            author: match[1],
            paper: paper || undefined,
          });
        } else if (index === 2) {
          // タイトル著者年引用
          const title = match[1];
          const author = match[2];
          const paper = papers.find(
            (p) =>
              p.title?.toLowerCase().includes(title.toLowerCase()) ||
              p.authors?.toLowerCase().includes(author.toLowerCase())
          );
          references.push({
            type: "title_author_year",
            match: match[0],
            title: match[1],
            author: match[2],
            paper: paper || undefined,
          });
        }
      }
    });

    return references;
  };

  // インラインスタイルを処理する関数
  const processInlineStyles = (text: string) => {
    // 太字 **text** または __text__
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // 斜体 *text* または _text_
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    text = text.replace(/_(.*?)_/g, "<em>$1</em>");

    // インラインコード `code`
    text = text.replace(
      /`(.*?)`/g,
      '<code class="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
    );

    // リンク [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return text;
  };

  // テキストをレンダリングする関数
  const renderText = (text: string) => {
    // インラインスタイルを処理
    const styledText = processInlineStyles(text);

    const references = findPaperReferences(styledText);
    if (references.length === 0) {
      return <span dangerouslySetInnerHTML={{ __html: styledText }} />;
    }

    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    references.forEach((ref, index) => {
      const startIndex = styledText.indexOf(ref.match, lastIndex);
      if (startIndex === -1) return;

      // 引用の前のテキスト
      if (startIndex > lastIndex) {
        elements.push(
          <span
            key={`text-${index}`}
            dangerouslySetInnerHTML={{
              __html: styledText.slice(lastIndex, startIndex),
            }}
          />
        );
      }

      // 引用部分
      const paper = ref.paper;
      if (paper) {
        elements.push(
          <button
            key={`ref-${index}`}
            onClick={() => onPaperClick?.(paper.id)}
            className="mx-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
            title={`📚 マイライブラリの論文: ${paper.title} - ${paper.authors}`}
          >
            <span>{ref.match}</span>
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        );
      } else {
        elements.push(
          <span
            key={`ref-${index}`}
            className="mx-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
            title="ライブラリに該当する論文が見つかりませんでした"
          >
            {ref.match}
          </span>
        );
      }

      lastIndex = startIndex + ref.match.length;
    });

    // 残りのテキスト
    if (lastIndex < styledText.length) {
      elements.push(
        <span
          key="text-end"
          dangerouslySetInnerHTML={{ __html: styledText.slice(lastIndex) }}
        />
      );
    }

    return <span>{elements}</span>;
  };

  // Markdownの高度な要素をパースする関数
  const parseMarkdown = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlockLanguage = "";
    let codeBlockContent: string[] = [];
    let inQuote = false;
    let quoteContent: string[] = [];

    const processCurrentParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(" ");
        elements.push(
          <p
            key={`p-${elements.length}`}
            className="mb-4 text-sm text-slate-700 leading-relaxed"
          >
            {renderText(paragraphText)}
          </p>
        );
        currentParagraph = [];
      }
    };

    const processCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <div
            key={`code-${elements.length}`}
            className="mb-4 rounded-lg bg-slate-900 p-4 overflow-x-auto"
          >
            {codeBlockLanguage && (
              <div className="mb-2 text-xs text-slate-400 font-mono">
                {codeBlockLanguage}
              </div>
            )}
            <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap">
              <code>{codeBlockContent.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlockContent = [];
        codeBlockLanguage = "";
      }
    };

    const processQuote = () => {
      if (quoteContent.length > 0) {
        elements.push(
          <blockquote
            key={`quote-${elements.length}`}
            className="mb-4 border-l-4 border-blue-200 bg-blue-50 pl-4 py-2 rounded-r-lg"
          >
            <div className="text-sm text-slate-700 italic">
              {quoteContent.map((line, index) => (
                <div key={index}>{renderText(line)}</div>
              ))}
            </div>
          </blockquote>
        );
        quoteContent = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // コードブロックの処理
      if (trimmedLine.startsWith("```")) {
        if (inCodeBlock) {
          // コードブロック終了
          processCodeBlock();
          inCodeBlock = false;
        } else {
          // コードブロック開始
          processCurrentParagraph();
          processQuote();
          inCodeBlock = true;
          codeBlockLanguage = trimmedLine.slice(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // 引用の処理
      if (trimmedLine.startsWith(">")) {
        if (!inQuote) {
          processCurrentParagraph();
          inQuote = true;
        }
        quoteContent.push(trimmedLine.slice(1).trim());
        return;
      } else if (inQuote) {
        processQuote();
        inQuote = false;
      }

      // 空行の処理
      if (trimmedLine === "") {
        processCurrentParagraph();
        return;
      }

      // 見出しの処理
      if (trimmedLine.startsWith("#")) {
        processCurrentParagraph();
        processQuote();

        const level = trimmedLine.match(/^#+/)?.[0].length || 1;
        const text = trimmedLine.replace(/^#+\s*/, "");
        const HeadingTag = `h${Math.min(
          level,
          6
        )}` as keyof JSX.IntrinsicElements;

        const headingClasses = {
          1: "text-2xl font-bold text-slate-900 mb-6 mt-8 border-b border-slate-200 pb-2",
          2: "text-xl font-semibold text-slate-900 mb-4 mt-6",
          3: "text-lg font-semibold text-slate-900 mb-3 mt-5",
          4: "text-base font-semibold text-slate-900 mb-2 mt-4",
          5: "text-sm font-semibold text-slate-900 mb-2 mt-3",
          6: "text-sm font-medium text-slate-800 mb-2 mt-3",
        };

        elements.push(
          <HeadingTag
            key={`h-${elements.length}`}
            className={
              headingClasses[level as keyof typeof headingClasses] ||
              headingClasses[6]
            }
          >
            {text}
          </HeadingTag>
        );
        return;
      }

      // リストの処理
      if (trimmedLine.match(/^[-*+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        processCurrentParagraph();
        processQuote();

        const isOrderedList = trimmedLine.match(/^\d+\.\s/);
        const text = trimmedLine.replace(/^[-*+]\s|^\d+\.\s/, "");

        if (isOrderedList) {
          elements.push(
            <ol
              key={`ol-${elements.length}`}
              className="mb-4 ml-6 list-decimal"
            >
              <li className="text-sm text-slate-700 leading-relaxed">
                {renderText(text)}
              </li>
            </ol>
          );
        } else {
          elements.push(
            <ul key={`ul-${elements.length}`} className="mb-4 ml-6 list-disc">
              <li className="text-sm text-slate-700 leading-relaxed">
                {renderText(text)}
              </li>
            </ul>
          );
        }
        return;
      }

      // 水平線の処理
      if (trimmedLine.match(/^[-*_]{3,}$/)) {
        processCurrentParagraph();
        processQuote();
        elements.push(
          <hr key={`hr-${elements.length}`} className="my-6 border-slate-200" />
        );
        return;
      }

      // 通常のテキスト
      currentParagraph.push(line);
    });

    // 最後の要素を処理
    processCurrentParagraph();
    processCodeBlock();
    processQuote();

    return elements;
  };

  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:leading-relaxed">
      {parseMarkdown(content)}
    </div>
  );
}
