const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_EMBED_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

interface GeminiRequestBody {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

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

  const response = await fetch(
    `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function callGeminiEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
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

  const response = await fetch(
    `${GEMINI_EMBED_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini embedding error: ${response.status} ${message}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding response was empty");
  }
  return values;
}
