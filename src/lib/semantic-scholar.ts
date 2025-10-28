export function s2Headers(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Research-AI-Tool-Improved/2.0",
  };
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}
