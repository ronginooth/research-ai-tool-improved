const UNPAYWALL_ENDPOINT = "https://api.unpaywall.org/v2/";
const CROSSREF_ENDPOINT = "https://api.crossref.org/works/";

interface ResolveResult {
  pdfUrl: string | null;
  htmlUrl: string | null;
  thumbnailUrl: string | null;
  sources: string[];
}

interface UnpaywallLocation {
  url?: string | null;
  url_for_pdf?: string | null;
  url_for_landing_page?: string | null;
}

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function pickFirstUrl(location?: UnpaywallLocation | null) {
  if (!location) return { pdf: null, html: null };
  const pdf = location.url_for_pdf || null;
  const html =
    location.url_for_landing_page ||
    location.url ||
    location.url_for_pdf ||
    null;
  return { pdf, html };
}

async function tryUnpaywall(doi: string): Promise<ResolveResult | null> {
  const email = process.env.UNPAYWALL_EMAIL || "test@research-ai-tool.com";
  if (!email) return null;

  const normalized = normalizeDoi(doi);
  const url = `${UNPAYWALL_ENDPOINT}${encodeURIComponent(
    normalized
  )}?email=${encodeURIComponent(email)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": `ResearchAI/1.0 (mailto:${email})`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;
    const sources: string[] = [];

    let pdfUrl: string | null = null;
    let htmlUrl: string | null = null;

    if (data.best_oa_location) {
      const picked = pickFirstUrl(data.best_oa_location);
      pdfUrl = picked.pdf;
      htmlUrl = picked.html;
      if (pdfUrl || htmlUrl) sources.push("unpaywall:best_oa_location");
    }

    if ((!pdfUrl || !htmlUrl) && Array.isArray(data.oa_locations)) {
      for (const location of data.oa_locations as UnpaywallLocation[]) {
        const picked = pickFirstUrl(location);
        if (!pdfUrl && picked.pdf) {
          pdfUrl = picked.pdf;
          sources.push("unpaywall:oa_locations.pdf");
        }
        if (!htmlUrl && picked.html) {
          htmlUrl = picked.html;
          sources.push("unpaywall:oa_locations.html");
        }
        if (pdfUrl && htmlUrl) break;
      }
    }

    if (pdfUrl || htmlUrl) {
      return {
        pdfUrl,
        htmlUrl,
        sources,
      };
    }

    return null;
  } catch (error) {
    console.warn("Unpaywall resolve failed", error);
    return null;
  }
}

async function tryCrossref(doi: string): Promise<ResolveResult | null> {
  const normalized = normalizeDoi(doi);
  const mail =
    process.env.CROSSREF_MAILTO ||
    process.env.UNPAYWALL_EMAIL ||
    "test@research-ai-tool.com";
  const url = `${CROSSREF_ENDPOINT}${encodeURIComponent(normalized)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": `ResearchAI/1.0 (mailto:${mail})`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as any;
    const links: any[] = payload?.message?.link;

    if (!Array.isArray(links) || links.length === 0) {
      return null;
    }

    let pdfUrl: string | null = null;
    let htmlUrl: string | null = null;
    const sources: string[] = [];

    for (const link of links) {
      if (!link?.URL) continue;
      const contentType = (link["content-type"] || "").toLowerCase();
      if (!pdfUrl && contentType.includes("application/pdf")) {
        pdfUrl = link.URL;
        sources.push("crossref:pdf");
      }
      if (!htmlUrl && contentType.includes("text/html")) {
        htmlUrl = link.URL;
        sources.push("crossref:html");
      }
      if (pdfUrl && htmlUrl) break;
    }

    if (pdfUrl || htmlUrl) {
      return { pdfUrl, htmlUrl, sources };
    }

    return null;
  } catch (error) {
    console.warn("Crossref resolve failed", error);
    return null;
  }
}

export async function resolveOpenAccessUrls(
  doi?: string | null
): Promise<ResolveResult | null> {
  if (!doi || typeof doi !== "string" || doi.trim().length === 0) {
    return null;
  }

  const triedSources: string[] = [];

  const fromUnpaywall = await tryUnpaywall(doi);
  if (fromUnpaywall) {
    fromUnpaywall.sources = [...fromUnpaywall.sources, "resolver:unpaywall"];
    // サムネイル画像を取得
    const thumbnailUrl = await getThumbnailUrl(doi);
    fromUnpaywall.thumbnailUrl = thumbnailUrl;
    return fromUnpaywall;
  }
  triedSources.push("unpaywall");

  const fromCrossref = await tryCrossref(doi);
  if (fromCrossref) {
    fromCrossref.sources = [...fromCrossref.sources, "resolver:crossref"];
    // サムネイル画像を取得
    const thumbnailUrl = await getThumbnailUrl(doi);
    fromCrossref.thumbnailUrl = thumbnailUrl;
    return fromCrossref;
  }
  triedSources.push("crossref");

  // Try Semantic Scholar as fallback
  const normalized = normalizeDoi(doi);
  const semanticUrl = `https://www.semanticscholar.org/paper/${normalized}`;

  console.log("resolveOpenAccessUrls: using Semantic Scholar fallback", {
    doi,
    triedSources,
    fallbackUrl: semanticUrl,
  });

  // サムネイル画像を取得（HTML URLも渡す）
  const thumbnailUrl = await getThumbnailUrl(
    normalized,
    undefined,
    semanticUrl
  );

  return {
    pdfUrl: null,
    htmlUrl: semanticUrl,
    thumbnailUrl,
    sources: [...triedSources, "semantic-scholar-fallback"],
  };
}

import { getPaperThumbnail } from "./paper-thumbnail";

// サムネイル画像を取得する関数
export async function getThumbnailUrl(
  doi: string,
  title?: string,
  htmlUrl?: string,
  pdfUrl?: string
): Promise<string | null> {
  // 新しい論文固有のサムネイル取得機能を使用（HTML URLとPDF URLも渡す）
  return await getPaperThumbnail(doi, title, htmlUrl, pdfUrl);
}
