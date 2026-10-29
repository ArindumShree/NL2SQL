import { useState, useCallback } from "react";

const MAX_HISTORY = 50;

/**
 * Manages per-session query history.
 * Each entry: { id, question, sql, columns, rows, row_count, error, timestamp }
 */
export function useQueryHistory() {
  const [history, setHistory] = useState([]);

  const addEntry = useCallback((entry) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date(),
      ...entry,
    };
    setHistory((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY));
    return newEntry.id;
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const getEntry = useCallback(
    (id) => history.find((h) => h.id === id),
    [history]
  );

  return { history, addEntry, clearHistory, getEntry };
}