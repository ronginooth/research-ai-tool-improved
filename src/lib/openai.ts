import OpenAI from "openai";

// 環境変数がない場合でもビルド時にエラーにならないように遅延初期化
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Please set it in your environment variables."
      );
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

// プロキシを使用してアクセス時に初期化
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const instance = getOpenAI();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

