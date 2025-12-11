import crypto from "crypto";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_EMBED_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

// キャッシュストレージ（メモリベース、本番環境ではRedis推奨）
interface CacheEntry {
  result: string;
  timestamp: number;
}

interface EmbeddingCacheEntry {
  result: number[];
  timestamp: number;
}

const promptCache = new Map<string, CacheEntry>();
const embeddingCache = new Map<string, EmbeddingCacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

/**
 * プロンプトのハッシュを生成してキャッシュキーとして使用
 */
function getCacheKey(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

/**
 * プロンプトと画像を含むリクエストのキャッシュキーを生成
 */
function getCacheKeyWithImages(
  prompt: string,
  images: Array<{ mimeType: string; data: string }>
): string {
  const combined = JSON.stringify({ prompt, images });
  return crypto.createHash("sha256").update(combined).digest("hex");
}

/**
 * キャッシュから結果を取得
 */
function getCachedResult(prompt: string): string | null {
  const cacheKey = getCacheKey(prompt);
  const cached = promptCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      `[Gemini Cache] Cache hit for prompt (key: ${cacheKey.substring(
        0,
        8
      )}...)`
    );
    return cached.result;
  }

  // 期限切れのキャッシュを削除
  if (cached) {
    promptCache.delete(cacheKey);
  }

  return null;
}

/**
 * キャッシュに結果を保存
 */
function setCachedResult(prompt: string, result: string): void {
  const cacheKey = getCacheKey(prompt);
  promptCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });
  console.log(
    `[Gemini Cache] Cached result for prompt (key: ${cacheKey.substring(
      0,
      8
    )}...)`
  );

  // メモリリークを防ぐため、キャッシュサイズが1000を超えたら古いエントリを削除
  if (promptCache.size > 1000) {
    const entries = Array.from(promptCache.entries());
    // 古い順にソートして、最初の100件を削除
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 100)
      .forEach(([key]) => promptCache.delete(key));
    console.log(
      `[Gemini Cache] Cleaned up old cache entries, current size: ${promptCache.size}`
    );
  }
}

/**
 * 埋め込み結果をキャッシュから取得
 */
function getCachedEmbedding(text: string): number[] | null {
  const cacheKey = getCacheKey(text);
  const cached = embeddingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      `[Gemini Cache] Cache hit for embedding (key: ${cacheKey.substring(
        0,
        8
      )}...)`
    );
    return cached.result;
  }

  // 期限切れのキャッシュを削除
  if (cached) {
    embeddingCache.delete(cacheKey);
  }

  return null;
}

/**
 * 埋め込み結果をキャッシュに保存
 */
function setCachedEmbedding(text: string, result: number[]): void {
  const cacheKey = getCacheKey(text);
  embeddingCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });
  console.log(
    `[Gemini Cache] Cached embedding result (key: ${cacheKey.substring(
      0,
      8
    )}...)`
  );

  // メモリリークを防ぐため、キャッシュサイズが1000を超えたら古いエントリを削除
  if (embeddingCache.size > 1000) {
    const entries = Array.from(embeddingCache.entries());
    // 古い順にソートして、最初の100件を削除
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 100)
      .forEach(([key]) => embeddingCache.delete(key));
    console.log(
      `[Gemini Cache] Cleaned up old embedding cache entries, current size: ${embeddingCache.size}`
    );
  }
}

// 複数のGemini APIキーをサポート
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
].filter((key): key is string => !!key); // undefined/nullを除外

// デバッグ用：利用可能なAPIキーの数をログ出力（サーバーサイドのみ）
if (typeof window === "undefined") {
  console.log(`[Gemini] Initialized with ${GEMINI_API_KEYS.length} API keys`);
  GEMINI_API_KEYS.forEach((key, index) => {
    const masked = key
      ? `${key.substring(0, 10)}...${key.substring(key.length - 4)}`
      : "undefined";
    console.log(`[Gemini] API key ${index + 1}: ${masked}`);
  });
}

let currentKeyIndex = 0;

// APIキーの使用状況を追跡
interface KeyUsage {
  requestCount: number;
  lastQuotaReset: number; // 最後にクォータがリセットされた日時（ミリ秒）
  quotaExceeded: boolean; // クォータ超過フラグ
  lastError?: string; // 最後のエラーメッセージ
}

const keyUsageMap = new Map<number, KeyUsage>();
const QUOTA_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24時間

/**
 * キーの使用状況を取得または初期化
 */
function getKeyUsage(keyIndex: number): KeyUsage {
  const now = Date.now();
  const usage = keyUsageMap.get(keyIndex);

  // 24時間経過したらリセット
  if (usage && now - usage.lastQuotaReset >= QUOTA_RESET_INTERVAL) {
    const resetUsage: KeyUsage = {
      requestCount: 0,
      lastQuotaReset: now,
      quotaExceeded: false,
    };
    keyUsageMap.set(keyIndex, resetUsage);
    console.log(`[Gemini] Quota reset for API key ${keyIndex + 1}`);
    return resetUsage;
  }

  if (!usage) {
    const newUsage: KeyUsage = {
      requestCount: 0,
      lastQuotaReset: now,
      quotaExceeded: false,
    };
    keyUsageMap.set(keyIndex, newUsage);
    return newUsage;
  }

  return usage;
}

/**
 * キーの使用回数を増加
 */
function incrementKeyUsage(keyIndex: number): void {
  const usage = getKeyUsage(keyIndex);
  usage.requestCount++;
}

/**
 * キーがクォータ超過かどうかをチェック
 */
function isKeyQuotaExceeded(keyIndex: number): boolean {
  const usage = getKeyUsage(keyIndex);
  return usage.quotaExceeded;
}

/**
 * キーをクォータ超過としてマーク
 */
function markKeyQuotaExceeded(keyIndex: number, errorMessage: string): void {
  const usage = getKeyUsage(keyIndex);
  usage.quotaExceeded = true;
  usage.lastError = errorMessage;
  console.warn(
    `[Gemini] API key ${keyIndex + 1} marked as quota exceeded: ${errorMessage}`
  );
}

/**
 * 利用可能なAPIキーのリストを取得（クォータ超過のキーを除外）
 */
function getAvailableApiKeys(): Array<{ key: string; index: number }> {
  const available: Array<{ key: string; index: number }> = [];
  GEMINI_API_KEYS.forEach((key, index) => {
    if (!isKeyQuotaExceeded(index)) {
      available.push({ key, index });
    }
  });
  return available;
}

/**
 * 次のAPIキーを取得（ローテーション、クォータ超過のキーをスキップ）
 */
function getNextApiKey(): string {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  // 利用可能なキーを取得
  const availableKeys = getAvailableApiKeys();
  if (availableKeys.length === 0) {
    throw new Error(
      "All Gemini API keys have exceeded their quota. Please wait 24 hours or upgrade to a paid plan."
    );
  }

  const keyIndex = currentKeyIndex % availableKeys.length;
  const selected = availableKeys[keyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;

  return selected.key;
}

/**
 * 全てのAPIキーを順番に試行（クォータ超過のキーを除外）
 */
function getAllApiKeys(): Array<{ key: string; index: number }> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return getAvailableApiKeys();
}

/**
 * 使用状況の統計を取得
 */
export function getGeminiUsageStats(): {
  totalKeys: number;
  availableKeys: number;
  quotaExceededKeys: number;
  keyDetails: Array<{
    keyIndex: number;
    requestCount: number;
    quotaExceeded: boolean;
    lastError?: string;
  }>;
} {
  const availableKeys = getAvailableApiKeys();
  const quotaExceededKeys = GEMINI_API_KEYS.length - availableKeys.length;

  const keyDetails = GEMINI_API_KEYS.map((_, index) => {
    const usage = getKeyUsage(index);
    return {
      keyIndex: index + 1,
      requestCount: usage.requestCount,
      quotaExceeded: usage.quotaExceeded,
      lastError: usage.lastError,
    };
  });

  return {
    totalKeys: GEMINI_API_KEYS.length,
    availableKeys: availableKeys.length,
    quotaExceededKeys,
    keyDetails,
  };
}

interface GeminiRequestBody {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
}

interface GeminiImagePart {
  inlineData: {
    mimeType: string;
    data: string; // base64エンコードされた画像データ
  };
}

interface GeminiTextPart {
  text: string;
}

type GeminiPart = GeminiTextPart | GeminiImagePart;

interface GeminiRequestBodyWithImages {
  contents: Array<{
    parts: GeminiPart[];
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

export async function callGemini(prompt: string): Promise<string> {
  // キャッシュチェック
  const cachedResult = getCachedResult(prompt);
  if (cachedResult !== null) {
    return cachedResult;
  }

  const apiKeys = getAllApiKeys();
  if (apiKeys.length === 0) {
    const stats = getGeminiUsageStats();
    throw new Error(
      `全てのGemini APIキーが1日のクォータ制限（20リクエスト）に達しています。24時間後に自動的にリセットされます。現在の状況: ${stats.quotaExceededKeys}/${stats.totalKeys}キーが制限超過`
    );
  }

  console.log(
    `[Gemini callGemini] Starting with ${apiKeys.length}/${GEMINI_API_KEYS.length} API keys available`
  );
  const body: GeminiRequestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  let lastError: Error | null = null;

  // 全てのキーを試行（503/429エラーの場合）
  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const selected = apiKeys[attempt];
    const apiKey = selected.key;
    const keyIndexUsed = selected.index;

    // 使用回数を増加
    incrementKeyUsage(keyIndexUsed);

    console.log(
      `[Gemini callGemini] Attempt ${attempt + 1}/${
        apiKeys.length
      } using API key ${keyIndexUsed + 1} (${apiKey.substring(
        0,
        10
      )}...${apiKey.substring(apiKey.length - 4)})`
    );

    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage: string;
        let errorDetails: any = null;

        // JSONエラーレスポンスをパース
        try {
          errorDetails = JSON.parse(text);
          // エラーメッセージを簡潔に抽出
          const errorObj = errorDetails?.error;
          if (errorObj?.message) {
            errorMessage = `Gemini API error: ${response.status} - ${errorObj.message}`;
          } else {
            errorMessage = `Gemini API error: ${response.status}`;
          }
        } catch {
          // JSONパースに失敗した場合はテキストをそのまま使用（最初の200文字まで）
          errorMessage = `Gemini API error: ${
            response.status
          } - ${text.substring(0, 200)}`;
        }

        // 503（過負荷）または429（レート制限）の場合は次のキーを試す
        if (response.status === 503 || response.status === 429) {
          const retryDelay = errorDetails?.error?.details?.find(
            (d: any) =>
              d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
          )?.retryDelay;
          const retrySeconds = retryDelay
            ? Math.ceil(parseInt(retryDelay) / 1000)
            : undefined;

          // 429エラーでクォータ超過の場合はキーをマーク
          if (
            response.status === 429 &&
            errorMessage.includes("Quota exceeded") &&
            errorMessage.includes("limit: 20")
          ) {
            markKeyQuotaExceeded(keyIndexUsed, errorMessage);
          }

          console.warn(
            `[Gemini callGemini] API key ${keyIndexUsed + 1} (attempt ${
              attempt + 1
            }) failed with ${response.status}${
              retrySeconds ? `, retry after ${retrySeconds}s` : ""
            }, trying next key...`
          );
          lastError = new Error(errorMessage);

          // 最後のキーでない場合は次のキーを試す
          if (attempt < apiKeys.length - 1) {
            continue;
          }
          // 最後のキーの場合も、エラーを投げずにループを終了してlastErrorを投げる
          break;
        }

        // 503/429以外のエラーは即座に投げる
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as GeminiResponse;
      const result =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

      if (result) {
        console.log(
          `[Gemini callGemini] Success with API key ${keyIndexUsed + 1}`
        );
        // キャッシュに保存
        setCachedResult(prompt, result);
        return result;
      }

      throw new Error("Gemini API returned empty response");
    } catch (error) {
      // fetchエラーやネットワークエラーの場合
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 503/429エラーまたはUNAVAILABLEステータスが含まれている場合は次のキーを試す
      if (
        errorMessage.includes("503") ||
        errorMessage.includes("429") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("overloaded")
      ) {
        console.warn(
          `[Gemini callGemini] API key ${keyIndexUsed + 1} (attempt ${
            attempt + 1
          }) failed with retryable error, trying next key...`
        );
        lastError = error as Error;

        // 最後のキーでない場合は次のキーを試す
        if (attempt < apiKeys.length - 1) {
          continue;
        }
        // 最後のキーの場合も、ループを終了してlastErrorを投げる
        break;
      }

      // 503/429エラー以外の場合は即座にエラーを投げる
      throw error;
    }
  }

  // 全てのキーで失敗した場合
  throw lastError || new Error("All Gemini API keys failed");
}

export async function callGeminiEmbedding(text: string): Promise<number[]> {
  // キャッシュチェック
  const cachedEmbedding = getCachedEmbedding(text);
  if (cachedEmbedding !== null) {
    return cachedEmbedding;
  }

  const body = {
    model: "models/text-embedding-004",
    content: {
      parts: [
        {
          text,
        },
      ],
    },
  };

  const apiKeys = getAllApiKeys();
  if (apiKeys.length === 0) {
    const stats = getGeminiUsageStats();
    throw new Error(
      `全てのGemini APIキーが1日のクォータ制限（20リクエスト）に達しています。24時間後に自動的にリセットされます。現在の状況: ${stats.quotaExceededKeys}/${stats.totalKeys}キーが制限超過`
    );
  }

  let lastError: Error | null = null;

  // 全てのキーを試行（503/429エラーの場合）
  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const selected = apiKeys[attempt];
    const apiKey = selected.key;
    const keyIndexUsed = selected.index;

    // 使用回数を増加
    incrementKeyUsage(keyIndexUsed);

    try {
      const response = await fetch(`${GEMINI_EMBED_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const message = await response.text();
        const errorMessage = `Gemini embedding error: ${response.status} ${message}`;

        // 503（過負荷）または429（レート制限）の場合は次のキーを試す
        if (response.status === 503 || response.status === 429) {
          // 429エラーでクォータ超過の場合はキーをマーク
          if (
            response.status === 429 &&
            errorMessage.includes("Quota exceeded") &&
            errorMessage.includes("limit: 20")
          ) {
            markKeyQuotaExceeded(keyIndexUsed, errorMessage);
          }

          console.warn(
            `[Gemini Embedding] API key ${keyIndexUsed + 1} (attempt ${
              attempt + 1
            }) failed with ${response.status}, trying next key...`
          );
          lastError = new Error(errorMessage);

          // 最後のキーでない場合は次のキーを試す
          if (attempt < apiKeys.length - 1) {
            continue;
          }
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as GeminiEmbeddingResponse;
      const values = data.embedding?.values;

      if (!values || values.length === 0) {
        throw new Error("Gemini embedding response was empty");
      }

      // キャッシュに保存
      setCachedEmbedding(text, values);
      return values;
    } catch (error) {
      // 503/429エラー以外の場合は即座にエラーを投げる
      if (
        error instanceof Error &&
        !error.message.includes("503") &&
        !error.message.includes("429")
      ) {
        throw error;
      }

      lastError = error as Error;

      // 最後のキーでない場合は次のキーを試す
      if (attempt < apiKeys.length - 1) {
        continue;
      }
    }
  }

  // 全てのキーで失敗した場合
  const stats = getGeminiUsageStats();
  if (stats.quotaExceededKeys === stats.totalKeys) {
    throw new Error(
      `全てのGemini APIキー（${stats.totalKeys}個）が1日のクォータ制限（20リクエスト）に達しています。24時間後に自動的にリセットされます。有料プランへのアップグレードを検討してください: https://ai.google.dev/pricing`
    );
  }

  throw lastError || new Error("All Gemini API keys failed");
}

/**
 * テキストと画像を含むプロンプトでGemini APIを呼び出す
 */
export async function callGeminiWithImages(
  prompt: string,
  images: Array<{ mimeType: string; data: string }> = []
): Promise<string> {
  // キャッシュチェック（画像が含まれる場合もキャッシュ可能）
  const cacheKey = getCacheKeyWithImages(prompt, images);
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      `[Gemini Cache] Cache hit for prompt with images (key: ${cacheKey.substring(
        0,
        8
      )}...)`
    );
    return cached.result;
  }
  // 期限切れのキャッシュを削除
  if (cached) {
    promptCache.delete(cacheKey);
  }

  const apiKeys = getAllApiKeys();

  const parts: GeminiPart[] = [
    { text: prompt },
    ...images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    })),
  ];

  const body: GeminiRequestBodyWithImages = {
    contents: [
      {
        parts,
      },
    ],
  };

  let lastError: Error | null = null;

  // 全てのキーを試行（503/429エラーの場合）
  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const selected = apiKeys[attempt];
    const apiKey = selected.key;
    const keyIndexUsed = selected.index;

    // 使用回数を増加
    incrementKeyUsage(keyIndexUsed);

    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        const errorMessage = `Gemini API error: ${response.status} ${text}`;

        // 503（過負荷）または429（レート制限）の場合は次のキーを試す
        if (response.status === 503 || response.status === 429) {
          // 429エラーでクォータ超過の場合はキーをマーク
          if (
            response.status === 429 &&
            errorMessage.includes("Quota exceeded") &&
            errorMessage.includes("limit: 20")
          ) {
            markKeyQuotaExceeded(keyIndexUsed, errorMessage);
          }

          console.warn(
            `[Gemini] API key ${keyIndexUsed + 1} (attempt ${
              attempt + 1
            }) failed with ${response.status}, trying next key...`
          );
          lastError = new Error(errorMessage);

          // 最後のキーでない場合は次のキーを試す
          if (attempt < apiKeys.length - 1) {
            continue;
          }
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as GeminiResponse;
      const result =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

      if (result) {
        // キャッシュに保存
        promptCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
        console.log(
          `[Gemini Cache] Cached result for prompt with images (key: ${cacheKey.substring(
            0,
            8
          )}...)`
        );
        return result;
      }

      throw new Error("Gemini API returned empty response");
    } catch (error) {
      // 503/429エラー以外の場合は即座にエラーを投げる
      if (
        error instanceof Error &&
        !error.message.includes("503") &&
        !error.message.includes("429")
      ) {
        throw error;
      }

      lastError = error as Error;

      // 最後のキーでない場合は次のキーを試す
      if (attempt < apiKeys.length - 1) {
        continue;
      }
    }
  }

  // 全てのキーで失敗した場合
  const imageStats = getGeminiUsageStats();
  if (imageStats.quotaExceededKeys === imageStats.totalKeys) {
    throw new Error(
      `全てのGemini APIキー（${imageStats.totalKeys}個）が1日のクォータ制限（20リクエスト）に達しています。24時間後に自動的にリセットされます。有料プランへのアップグレードを検討してください: https://ai.google.dev/pricing`
    );
  }

  throw lastError || new Error("All Gemini API keys failed");
}
