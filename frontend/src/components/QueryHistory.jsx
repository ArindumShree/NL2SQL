import React from "react";
import { History, CheckCircle2, AlertCircle, Trash2, Clock } from "lucide-react";

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function QueryHistory({ history, onSelect, onClear, activeId }) {
  if (history.length === 0) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <History size={15} className="text-muted" />
          <span className="text-sm font-medium text-muted">History</span>
        </div>
        <p className="text-xs text-muted text-center py-4">
          Your queries this session will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
        <div className="flex items-center gap-2">
          <History size={15} className="text-muted" />
          <span className="text-sm font-medium text-white">History</span>
          <span className="badge bg-surface-3 text-muted">{history.length}</span>
        </div>
        <button
          onClick={onClear}
          className="btn-ghost text-xs flex items-center gap-1 text-muted hover:text-danger"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      <div className="divide-y divide-surface-3/50 max-h-[480px] overflow-y-auto">
        {history.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelect(entry)}
            className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors group ${
              activeId === entry.id ? "bg-surface-2 border-l-2 border-accent" : ""
            }`}
          >
            <div className="flex items-start gap-2.5">
              {entry.error ? (
                <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate group-hover:text-white transition-colors leading-snug">
                  {entry.question}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={10} className="text-muted/60" />
                  <span className="text-xs text-muted/60">{timeAgo(entry.timestamp)}</span>
                  {!entry.error && entry.row_count !== undefined && (
                    <>
                      <span className="text-muted/40">·</span>
                      <span className="text-xs text-muted/60">
                        {entry.row_count} row{entry.row_count !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}