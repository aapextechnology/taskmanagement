import { env } from "@/lib/env";

// Thin OpenAI Chat Completions client (EPIC-014). Plain fetch — no SDK
// dependency; we only need streaming chat. The key lives in env only.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function aiConfigured(): boolean {
  return env.OPENAI_API_KEY.length > 0;
}

/** Streams assistant text chunks. Throws (with OpenAI's error message) on a
 *  non-OK response so the route can surface a readable failure. */
export async function* streamChat(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    let detail = `${response.status}`;
    try {
      const parsed = (await response.json()) as {
        error?: { message?: string };
      };
      detail = parsed.error?.message ?? detail;
    } catch {
      // keep the status code
    }
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are newline-delimited "data: {...}" lines
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // partial frame — will complete on the next read
      }
    }
  }
}
