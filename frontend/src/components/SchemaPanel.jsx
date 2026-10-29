/**
 * SchemaPanel.jsx
 * ───────────────
 * Collapsible schema explorer panel. Fetches Northwind schema from GET /schema
 * once on mount, then displays tables as accordions with column details.
 *
 * On desktop: slides in as a right-side panel (or can be toggled from header).
 * On mobile:  renders as a full-screen modal overlay.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  X, Database, ChevronDown, ChevronRight,
  Key, Link, Search, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Type badge color mapping ──────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = (type || "").toLowerCase();
  let cls = "bg-surface-3 text-ink-subtle";
  if (t.includes("int") || t.includes("serial") || t.includes("numeric") || t.includes("float") || t.includes("real") || t.includes("double") || t.includes("money")) {
    cls = "bg-brand/10 text-brand-glow";
  } else if (t.includes("char") || t.includes("text") || t.includes("varchar")) {
    cls = "bg-success/10 text-success";
  } else if (t.includes("date") || t.includes("time") || t.includes("timestamp")) {
    cls = "bg-warning/10 text-warning";
  } else if (t.includes("bool")) {
    cls = "bg-purple-500/10 text-purple-400";
  }
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-current/20 ${cls}`}>
      {type || "unknown"}
    </span>
  );
}

// ── Individual table accordion ────────────────────────────────────────────
function TableAccordion({ table, searchTerm }) {
  const [open, setOpen] = useState(false);
  const { name, columns = [] } = table;

  // Auto-open if search matches this table or its columns
  useEffect(() => {
    if (searchTerm) {
      const matches =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        columns.some((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));
      setOpen(matches);
    }
  }, [searchTerm, name, columns]);

  const filteredColumns = searchTerm
    ? columns.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : columns;

  const displayColumns = filteredColumns.length > 0 ? filteredColumns : columns;

  return (
    <div className="border border-surface-3 rounded-xl overflow-hidden mb-2">
      {/* Table header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-2 hover:bg-surface-3/40 transition-colors text-left"
        aria-expanded={open}
        aria-label={`Toggle ${name} table`}
      >
        <div className="flex items-center gap-2">
          <Database size={12} className="text-brand-glow shrink-0" />
          <span className="text-xs font-semibold text-ink font-mono">{name}</span>
          <span className="text-[10px] text-ink-subtle">
            {columns.length} col{columns.length !== 1 ? "s" : ""}
          </span>
        </div>
        {open ? (
          <ChevronDown size={13} className="text-ink-subtle shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-ink-subtle shrink-0" />
        )}
      </button>

      {/* Columns list */}
      {open && (
        <div className="divide-y divide-surface-3/40 bg-surface-1">
          {displayColumns.map((col, i) => {
            const isPK = col.is_primary_key || col.name?.toLowerCase() === "id" || col.name?.toLowerCase().endsWith("_id") && i === 0;
            const isFK = col.is_foreign_key || (col.name?.toLowerCase().endsWith("_id") && !isPK);
            return (
              <div key={col.name || i} className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-3/20 transition-colors">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isPK && (
                    <Key size={9} className="text-warning shrink-0" title="Primary key" />
                  )}
                  {isFK && !isPK && (
                    <Link size={9} className="text-brand-glow shrink-0" title="Foreign key" />
                  )}
                  {!isPK && !isFK && (
                    <span className="w-[9px] shrink-0" />
                  )}
                  <span className={`text-xs font-mono truncate ${isPK ? "text-warning" : isFK ? "text-brand-glow" : "text-ink-muted"}`}>
                    {col.name}
                  </span>
                </div>
                <TypeBadge type={col.type || col.data_type} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main SchemaPanel ──────────────────────────────────────────────────────
export default function SchemaPanel({ open, onClose }) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/schema`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      // Normalize: backend may return {tables:[...]} or [...] directly
      const tables = Array.isArray(data) ? data : (data.tables || []);
      setSchema(tables);
    } catch (err) {
      setError(err.message || "Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on first open
  useEffect(() => {
    if (open && !schema && !loading) {
      fetchSchema();
    }
  }, [open, schema, loading, fetchSchema]);

  if (!open) return null;

  const filteredTables = schema
    ? schema.filter(
        (t) =>
          !searchTerm ||
          t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.columns || []).some((c) =>
            c.name?.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : [];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`
          fixed right-0 top-0 h-full z-50
          w-80 md:w-72
          bg-surface-1 border-l border-surface-3
          flex flex-col shadow-2xl
          animate-slide-in-right
        `}
        role="dialog"
        aria-label="Schema explorer"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3 h-14 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-brand-glow" />
            <span className="text-sm font-semibold text-ink">Schema Explorer</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchSchema}
              className="btn-ghost p-1.5"
              aria-label="Refresh schema"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="btn-ghost p-1.5"
              aria-label="Close schema panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-surface-3 flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tables or columns…"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg pl-8 pr-3 py-2 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
              aria-label="Search schema"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={20} className="text-brand-glow animate-spin" />
              <p className="text-xs text-ink-subtle">Loading schema…</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={14} className="text-danger mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-danger mb-0.5">Failed to load schema</p>
                <p className="text-[11px] text-ink-muted mb-2">{error}</p>
                <button
                  onClick={fetchSchema}
                  className="text-[11px] text-brand-glow underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {schema && !loading && (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="text-[11px] text-ink-subtle">
                  <span className="font-semibold text-ink">{schema.length}</span> tables
                </span>
                {searchTerm && (
                  <span className="text-[11px] text-ink-subtle">
                    <span className="font-semibold text-ink">{filteredTables.length}</span> matching
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="flex items-center gap-1 text-[10px] text-ink-subtle">
                  <Key size={8} className="text-warning" /> Primary key
                </span>
                <span className="flex items-center gap-1 text-[10px] text-ink-subtle">
                  <Link size={8} className="text-brand-glow" /> Foreign key
                </span>
              </div>

              {/* Tables */}
              {(searchTerm ? filteredTables : schema).map((table) => (
                <TableAccordion
                  key={table.name}
                  table={table}
                  searchTerm={searchTerm}
                />
              ))}

              {searchTerm && filteredTables.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-ink-subtle">No tables or columns match "{searchTerm}"</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {schema && (
          <div className="border-t border-surface-3 px-4 py-2.5 flex-shrink-0">
            <p className="text-[10px] text-ink-subtle">
              Northwind ERP · PostgreSQL
            </p>
          </div>
        )}
      </div>
    </>
  );
}