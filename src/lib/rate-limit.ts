const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 20;

interface RateLimitState {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitState>();

function getLimitConfig(type?: "search" | "ai"): {
  windowMs: number;
  maxRequests: number;
} {
  if (type === "ai") {
    return {
      windowMs:
        Number.parseInt(process.env.AI_SEARCH_RATE_WINDOW_MS || "90000", 10) ||
        90_000,
      maxRequests:
        Number.parseInt(process.env.AI_SEARCH_RATE_MAX || "10", 10) || 10,
    };
  }

  return {
    windowMs:
      Number.parseInt(process.env.SEARCH_RATE_WINDOW_MS || "60000", 10) ||
      DEFAULT_WINDOW_MS,
    maxRequests:
      Number.parseInt(process.env.SEARCH_RATE_MAX || "20", 10) ||
      DEFAULT_MAX_REQUESTS,
  };
}

export function isRateLimited(
  key: string,
  type: "search" | "ai" = "search"
): { limited: boolean; retryAfter?: number } {
  const { windowMs, maxRequests } = getLimitConfig(type);
  const now = Date.now();
  const state = rateLimitStore.get(key) || { timestamps: [] };

  // 有効期間外のタイムスタンプを除外
  state.timestamps = state.timestamps.filter(
    (timestamp) => now - timestamp <= windowMs
  );

  if (state.timestamps.length >= maxRequests) {
    const retryAfter =
      windowMs - (now - state.timestamps[0]) + 1000; /* safety buffer */
    rateLimitStore.set(key, state);
    return { limited: true, retryAfter };
  }

  state.timestamps.push(now);
  rateLimitStore.set(key, state);

  return { limited: false };
}
