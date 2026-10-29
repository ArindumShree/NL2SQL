/**
 * Sidebar.jsx
 * ────────────
 * Left-rail session history panel.
 *
 * FIXES vs original:
 *  - BUG FIX: import path was "../context/ChatContext" (broken) → "../components/ChatContext"
 *  - Added rename session: double-click a title to enter inline edit mode
 *  - Added arrow-key navigation between sessions (ArrowUp / ArrowDown)
 *  - Added aria-label on all interactive elements
 *  - onClose prop used on mobile overlay close
 */

import React, { useState, useRef, useCallback } from "react";
import {
  MessageSquarePlus,
  Trash2,
  MessagesSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  Check,
} from "lucide-react";
import { useChat } from "./ChatContext"; // ← FIXED: was "../context/ChatContext"

function timeAgo(date) {
  if (!date) return "";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function Sidebar({ collapsed, onToggle, onClose }) {
  const {
    sessions,
    activeSessionId,
    newSession,
    deleteSession,
    switchSession,
    clearAllSessions,
    renameSession,
  } = useChat();

  const [confirmClear, setConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef(null);
  const sessionListRef = useRef(null);

  const handleNew = () => {
    newSession();
    onClose?.();
  };

  const handleSwitch = (id) => {
    switchSession(id);
    onClose?.(); // close mobile sidebar on session switch
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteSession(id);
  };

  const handleClearAll = () => {
    if (confirmClear) {
      clearAllSessions();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  // ── Rename session ────────────────────────────────────────────────────
  const startRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      // Call renameSession if available; otherwise fall through silently
      renameSession?.(editingId, editValue.trim().slice(0, 80));
    }
    setEditingId(null);
    setEditValue("");
  }, [editingId, editValue, renameSession]);

  const handleRenameKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
  };

  // ── Arrow-key navigation ──────────────────────────────────────────────
  const handleSessionKeyDown = (e, index) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const buttons = sessionListRef.current?.querySelectorAll("[data-session-btn]");
      if (buttons && buttons[index + 1]) buttons[index + 1].focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const buttons = sessionListRef.current?.querySelectorAll("[data-session-btn]");
      if (buttons && buttons[index - 1]) buttons[index - 1].focus();
    }
  };

  return (
    <aside
      className={`
        flex flex-col bg-surface-1 border-r border-surface-3
        transition-all duration-300 ease-in-out flex-shrink-0 h-full
        ${collapsed ? "w-14" : "w-64"}
      `}
      aria-label="Session history sidebar"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-surface-3 h-14 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <Database size={15} className="text-brand-glow shrink-0" />
            <span className="text-sm font-semibold text-ink truncate">NL2SQL</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="btn-ghost p-1.5 shrink-0 ml-auto focus-visible:ring-2 focus-visible:ring-brand/40"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* ── New chat button ── */}
      <div className="px-2 py-2 border-b border-surface-3 flex-shrink-0">
        <button
          onClick={handleNew}
          className={`
            w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5
            bg-brand/10 hover:bg-brand/20 border border-brand/20 hover:border-brand/40
            text-brand-glow transition-all duration-150 text-sm font-medium
            focus-visible:ring-2 focus-visible:ring-brand/40
            ${collapsed ? "justify-center px-0" : ""}
          `}
          title="New conversation (⌘N)"
          aria-label="Start new conversation"
        >
          <MessageSquarePlus size={15} className="shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* ── Session list ── */}
      <div ref={sessionListRef} className="flex-1 overflow-y-auto py-1 min-h-0">
        {sessions.length === 0 ? (
          !collapsed && (
            <div className="px-4 py-8 text-center">
              <MessagesSquare size={24} className="text-ink-subtle mx-auto mb-2" />
              <p className="text-xs text-ink-subtle leading-relaxed">
                No conversations yet.<br />Ask your first question!
              </p>
            </div>
          )
        ) : (
          sessions.map((s, index) => {
            const isActive = s.id === activeSessionId;
            const msgCount = s.messages.filter((m) => m.role === "user").length;
            const isEditing = editingId === s.id;

            return (
              <div key={s.id} className="mx-1 my-0.5">
                {isEditing && !collapsed ? (
                  // ── Inline rename input ──
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleRenameKey}
                      onBlur={commitRename}
                      className="flex-1 bg-surface-3 border border-brand/50 rounded px-2 py-1 text-xs text-ink outline-none focus:ring-1 focus:ring-brand/40 font-medium"
                      aria-label="Rename session"
                      maxLength={80}
                    />
                    <button
                      onClick={commitRename}
                      className="p-1 rounded hover:bg-success/20 text-success"
                      aria-label="Confirm rename"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditValue(""); }}
                      className="p-1 rounded hover:bg-surface-3 text-ink-subtle"
                      aria-label="Cancel rename"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    data-session-btn
                    onClick={() => handleSwitch(s.id)}
                    onDoubleClick={(e) => !collapsed && startRename(e, s)}
                    onKeyDown={(e) => handleSessionKeyDown(e, index)}
                    className={`
                      group w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg
                      transition-all duration-150 relative
                      focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none
                      ${
                        isActive
                          ? "bg-brand/10 border border-brand/20 text-ink"
                          : "hover:bg-surface-3/50 text-ink-muted hover:text-ink border border-transparent"
                      }
                    `}
                    style={{ width: "100%" }}
                    title={collapsed ? s.title : "Double-click to rename"}
                    aria-label={`Switch to: ${s.title}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <MessagesSquare
                      size={13}
                      className={`shrink-0 mt-0.5 ${isActive ? "text-brand-glow" : "text-ink-subtle"}`}
                    />
                    {!collapsed && (
                      <div className="flex-1 min-w-0 pr-5">
                        <p className="text-xs font-medium truncate leading-snug">{s.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock size={9} className="text-ink-subtle" />
                          <span className="text-[10px] text-ink-subtle">{timeAgo(s.createdAt)}</span>
                          {msgCount > 0 && (
                            <>
                              <span className="text-ink-subtle text-[10px]">·</span>
                              <span className="text-[10px] text-ink-subtle">
                                {msgCount} msg{msgCount !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Delete button */}
                    {!collapsed && (
                      <button
                        onClick={(e) => handleDelete(e, s.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger/20 hover:text-danger text-ink-subtle transition-all focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-danger/40"
                        title="Delete conversation"
                        aria-label={`Delete: ${s.title}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer / clear all ── */}
      {!collapsed && sessions.length > 0 && (
        <div className="border-t border-surface-3 px-2 py-2 flex-shrink-0">
          <button
            onClick={handleClearAll}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs
              transition-all duration-150 focus-visible:ring-2 focus-visible:ring-danger/40
              ${
                confirmClear
                  ? "bg-danger/15 text-danger border border-danger/30"
                  : "text-ink-subtle hover:text-danger hover:bg-surface-3 border border-transparent"
              }
            `}
            aria-label="Clear all conversation history"
          >
            <Trash2 size={12} />
            {confirmClear ? "Click again to confirm" : "Clear all history"}
          </button>
        </div>
      )}
    </aside>
  );
}