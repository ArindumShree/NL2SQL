import React, { useState, useRef, useEffect } from "react";
import { Search, Loader2, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Show me the top 10 customers by total order value",
  "Which products are running low on stock?",
  "List all orders from Germany in 1997",
  "Who are the top 5 sales employees by revenue?",
  "What categories have the most products?",
  "Show average order value by country",
];

export default function QueryInput({ onSubmit, loading }) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    const q = value.trim();
    if (!q || loading) return;
    onSubmit(q);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (s) => {
    setValue(s);
    setShowSuggestions(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="relative">
      {/* Input container */}
      <div
        className={`relative flex items-end gap-3 bg-surface-1 border rounded-xl p-3 transition-all duration-200 ${
          loading
            ? "border-accent/40"
            : "border-surface-3 hover:border-surface-3 focus-within:border-accent"
        }`}
      >
        <Search
          size={18}
          className="text-muted mt-1 shrink-0 transition-colors duration-200 group-focus-within:text-accent"
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your data… e.g. Show top 10 products by revenue"
          disabled={loading}
          className="flex-1 bg-transparent text-white placeholder-muted resize-none outline-none text-sm leading-relaxed disabled:opacity-60"
          style={{ minHeight: "24px" }}
        />

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          className="btn-primary flex items-center gap-2 shrink-0 text-sm"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Running…</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Ask</span>
            </>
          )}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !loading && !value && (
        <div className="absolute z-20 top-full mt-2 w-full bg-surface-2 border border-surface-3 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <p className="text-xs text-muted px-4 pt-3 pb-1.5 font-medium tracking-wide uppercase">
            Try these
          </p>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSuggestion(s)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-3 hover:text-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted mt-2 ml-1">
        Press{" "}
        <kbd className="bg-surface-2 border border-surface-3 rounded px-1.5 py-0.5 font-mono text-xs">
          Enter
        </kbd>{" "}
        to run ·{" "}
        <kbd className="bg-surface-2 border border-surface-3 rounded px-1.5 py-0.5 font-mono text-xs">
          Shift+Enter
        </kbd>{" "}
        for new line
      </p>
    </div>
  );
}