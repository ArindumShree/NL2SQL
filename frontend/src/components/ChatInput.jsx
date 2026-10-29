/**
 * ChatInput.jsx
 * ─────────────
 * Bottom input bar. Fixes vs original:
 *  - forwardRef so parent (App.jsx) can call .focus() via inputRef (⌘K shortcut)
 *  - Character counter when approaching limit
 *  - Cleaner visual feedback on focus / loading
 *  - Handles prefill (follow-up chips) correctly
 *  - Accessible: proper aria labels, disabled states
 *  - Mobile: reduced padding
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Send, Loader2 } from "lucide-react";

const MAX_CHARS = 1000;

const ChatInput = forwardRef(function ChatInput(
  { onSubmit, loading, prefill, onPrefillConsumed },
  ref
) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);

  // Expose focus() to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Inject prefill from follow-up chips
  useEffect(() => {
    if (prefill) {
      setValue(prefill);
      onPrefillConsumed?.();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [prefill, onPrefillConsumed]);

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
    if (!q || loading || q.length > MAX_CHARS) return;
    onSubmit(q);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = value.length;
  const nearLimit = charCount > MAX_CHARS * 0.8;
  const overLimit = charCount > MAX_CHARS;
  const canSubmit = value.trim().length > 0 && !loading && !overLimit;

  return (
    <div className="border-t border-surface-3 bg-surface-1/95 backdrop-blur px-4 py-2 md:py-3">
      <div
        className={`
          flex items-end gap-3 bg-surface-2 border rounded-2xl px-4 py-3
          transition-all duration-200
          ${focused ? "border-brand/50 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]" : "border-surface-3"}
          ${loading ? "border-brand/20" : ""}
          ${overLimit ? "border-danger/50" : ""}
        `}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={loading ? "Waiting for response…" : "Ask anything about your data…"}
          disabled={loading}
          aria-label="Query input"
          className="flex-1 bg-transparent text-ink placeholder-ink-subtle resize-none outline-none text-sm leading-relaxed disabled:opacity-50 min-h-[24px]"
          style={{ maxHeight: "160px" }}
        />

        {/* Char counter — only shows near the limit */}
        {nearLimit && (
          <span
            className={`text-[10px] font-mono shrink-0 mb-0.5 ${
              overLimit ? "text-danger" : "text-ink-subtle"
            }`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Send message"
          className={`
            shrink-0 flex items-center justify-center w-9 h-9 rounded-xl
            transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand/50
            ${
              canSubmit
                ? "bg-brand hover:bg-brand-light text-white shadow-sm"
                : "bg-surface-3 text-ink-subtle cursor-not-allowed"
            }
          `}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* Keyboard hint — hidden on mobile */}
      <p className="hidden md:flex text-[10px] text-ink-subtle mt-1.5 ml-1 items-center gap-1">
        <kbd className="bg-surface-3 border border-surface-4 rounded px-1 py-0.5 font-mono text-[9px]">
          ↵
        </kbd>
        <span>send</span>
        <span className="mx-1 text-ink-subtle/50">·</span>
        <kbd className="bg-surface-3 border border-surface-4 rounded px-1 py-0.5 font-mono text-[9px]">
          ⇧↵
        </kbd>
        <span>new line</span>
      </p>
    </div>
  );
});

export default ChatInput;