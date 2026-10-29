/**
 * ChatContext.jsx
 * ───────────────
 * Global state for the NL2SQL chatbot:
 *  - sessions: array of { id, title, createdAt, messages[] }
 *  - activeSessionId: currently viewed session
 * Persisted to localStorage so history survives a page refresh.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const STORAGE_KEY = "nl2sql_sessions_v2";
const MAX_SESSIONS = 50;

const ChatContext = createContext(null);

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Revive Date strings
    return parsed.map((s) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      messages: s.messages.map((m) => ({ ...m, ts: new Date(m.ts) })),
    }));
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // storage quota – silently ignore
  }
}

export function ChatProvider({ children }) {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const stored = loadSessions();
    return stored.length > 0 ? stored[0].id : null;
  });

  // Persist whenever sessions change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  /** Create a brand-new session and make it active */
  const newSession = useCallback(() => {
    const id = `sess_${Date.now()}`;
    const session = {
      id,
      title: "New conversation",
      createdAt: new Date(),
      messages: [],
    };
    setSessions((prev) => [session, ...prev].slice(0, MAX_SESSIONS));
    setActiveSessionId(id);
    return id;
  }, []);

  /** Append a message to the active session; auto-create session if none */
  const addMessage = useCallback(
    (message) => {
      const sessId = activeSessionId ?? newSession();
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessId) return s;
          const msgs = [...s.messages, { ...message, ts: new Date() }];
          // Auto-title from first user message
          const title =
            s.title === "New conversation" && message.role === "user"
              ? message.content.slice(0, 60) + (message.content.length > 60 ? "…" : "")
              : s.title;
          return { ...s, messages: msgs, title };
        })
      );
      return sessId;
    },
    [activeSessionId, newSession]
  );

  /** Delete a session by id */
  const deleteSession = useCallback(
    (id) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          setActiveSessionId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeSessionId]
  );

  /** Clear ALL sessions */
  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
  }, []);

  /** Switch to a different session */
  const switchSession = useCallback((id) => {
    setActiveSessionId(id);
  }, []);

  /** Rename a session by id */
  const renameSession = useCallback((id, newTitle) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  }, []);

  /** Build the history array for the backend (role+content pairs, no data blobs) */
  const buildBackendHistory = useCallback(() => {
    if (!activeSession) return [];
    return activeSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [activeSession]);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSession,
        activeSessionId,
        newSession,
        addMessage,
        deleteSession,
        clearAllSessions,
        switchSession,
        renameSession,
        buildBackendHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}