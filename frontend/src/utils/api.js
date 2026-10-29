import axios from "axios";

// Vite uses import.meta.env; fall back to localhost
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 90000,
});

/**
 * Legacy single-turn query (kept for compatibility).
 */
export async function submitQuery(question, maxRows = 500) {
  const response = await api.post("/query", { question, max_rows: maxRows });
  return response.data;
}

/**
 * Multi-turn chat — non-streaming (fallback).
 */
export async function submitChat(question, history = [], maxRows = 500) {
  const response = await api.post("/chat", {
    question,
    history,
    max_rows: maxRows,
  });
  return response.data;
}

/**
 * Streams a chat query using Server-Sent Events.
 * Calls onProgress({step, label}) during processing,
 * then onResult(data) when complete, then onError(msg) on failure.
 */
export async function submitChatStream(question, history = [], { onProgress, onResult, onError } = {}) {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, max_rows: 500 }),
    });

    if (!response.ok) {
      let detail = `Server error ${response.status}`;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch {}
      onError?.(detail);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop(); // keep incomplete chunk

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === "progress") onProgress?.(json);
          else if (json.type === "result") onResult?.(json);
          else if (json.type === "error") onError?.(json.message);
        } catch {
          // malformed JSON chunk — skip
        }
      }
    }
  } catch (err) {
    onError?.(err.message || "Network error — is the backend running?");
  }
}

export default api;