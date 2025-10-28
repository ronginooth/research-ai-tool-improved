const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchHtmlPlainText(url?: string): Promise<string | null> {
  if (!url) return null;

  const maxRetries = 3;
  const retryDelay = 1000; // 1秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const html = await response.text();
        const text = stripHtml(html);
        if (text) {
          console.log(`HTML fetch success on attempt ${attempt}: ${url}`);
          return text;
        }
      } else if (response.status === 409 && attempt < maxRetries) {
        console.warn(
          `HTTP 409 on attempt ${attempt}, retrying in ${retryDelay}ms: ${url}`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt)
        );
        continue;
      } else {
        console.warn(
          `fetchHtmlPlainText failed ${response.status} on attempt ${attempt}: ${url}`
        );
        if (attempt === maxRetries) return null;
      }
    } catch (error) {
      console.warn(`fetchHtmlPlainText error on attempt ${attempt}:`, error);
      if (attempt === maxRetries) return null;
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
    }
  }

  return null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img[^>]*alt="([^"]+)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFigureCaptions(html: string): string[] {
  const captions: string[] = [];

  // 一般的な図キャプションのパターンを抽出
  const patterns = [
    // Figure caption patterns
    /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi,
    /<p[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    /<div[^>]*class="[^"]*figure[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
    /<p[^>]*>[\s\S]*?(?:Figure|Fig\.|図)\s*[0-9a-z\-:]+[\s\S]*?<\/p>/gi,
    // Nature specific patterns
    /<p[^>]*data-test="figure-caption"[^>]*>([\s\S]*?)<\/p>/gi,
    /<div[^>]*data-test="figure-caption"[^>]*>([\s\S]*?)<\/div>/gi,
    // ScienceDirect patterns
    /<p[^>]*class="[^"]*figure-caption[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    // Springer patterns
    /<p[^>]*class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    // Wiley patterns
    /<p[^>]*class="[^"]*figure-caption-text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const caption = stripHtml(match[1] || match[0]).trim();
      if (caption && caption.length > 10 && caption.length < 1000) {
        captions.push(caption);
      }
    }
  }

  // 重複を除去
  return [...new Set(captions)];
}

interface HtmlContext {
  id: string;
  sectionTitle: string;
  text: string;
  order: number;
}

export function extractHtmlContexts(
  plainText: string,
  options?: { maxContexts?: number }
): HtmlContext[] {
  const maxContexts = options?.maxContexts ?? 120;
  const paragraphs = splitIntoParagraphs(plainText);

  const contexts: HtmlContext[] = [];

  let currentSection = "本文";
  let order = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    if (looksLikeHeading(paragraph)) {
      currentSection = cleanHeading(paragraph);
      continue;
    }

    contexts.push({
      id: `html-${order + 1}`,
      sectionTitle: currentSection,
      text: paragraph,
      order,
    });

    order += 1;
    if (contexts.length >= maxContexts) break;
  }

  return contexts;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function looksLikeHeading(paragraph: string): boolean {
  if (!paragraph) return false;
  const trimmed = paragraph.trim();
  if (trimmed.length === 0) return false;

  if (trimmed.length <= 80) {
    const numericHeading = /^(?:[0-9]+(?:\.[0-9]+)*)\s+/.test(trimmed);
    if (numericHeading) return true;

    const uppercase = trimmed === trimmed.toUpperCase();
    if (uppercase && /[A-Z]/.test(trimmed)) return true;
  }

  return false;
}

function cleanHeading(heading: string): string {
  return heading
    .replace(/^(?:[0-9]+(?:\.[0-9]+)*)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
