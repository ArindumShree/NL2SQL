/**
 * ChatMessage.jsx
 * ────────────────
 * Renders a single chat turn (user bubble or assistant card).
 *
 * v2 changes:
 *  - react-markdown + remark-gfm replaces the hand-rolled renderMarkdown()
 *  - DataTable upgraded: column sort, text filter, smart cell formatting,
 *    Copy as JSON button, row highlight, accessible roles
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Code2, Copy, Check, ChevronDown, ChevronUp,
  Database, Sparkles, AlertCircle, Download,
  ChevronLeft, ChevronRight, Bot, ArrowUp, ArrowDown,
  Search, X,
} from "lucide-react";

// ── react-markdown component overrides ───────────────────────────────────

const markdownComponents = {
  p: ({ children }) => (
    <p className="text-sm text-ink leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-ink-muted">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1 ml-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 space-y-1 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm text-ink leading-relaxed">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-glow shrink-0" />
      <span>{children}</span>
    </li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-surface-3/80 text-brand-glow font-mono text-xs px-1.5 py-0.5 rounded">
        {children}
      </code>
    ) : (
      <pre className="bg-[#0d1117] rounded-lg p-3 overflow-x-auto text-xs font-mono text-emerald-300 my-2">
        <code>{children}</code>
      </pre>
    ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-ink mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-ink mt-2 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-ink-muted mt-2">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand/40 pl-3 my-2 text-ink-muted italic text-sm">
      {children}
    </blockquote>
  ),
};

// ── SQL keyword highlighter ───────────────────────────────────────────────

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|LIKE|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MIN|MAX|COALESCE|CASE|WHEN|THEN|ELSE|END|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|UNION|ALL|NULL|IS|DESC|ASC|BY)\b/g;

function highlightSQL(sql) {
  // Reset lastIndex since we reuse the regex
  SQL_KEYWORDS.lastIndex = 0;
  const parts = sql.split(SQL_KEYWORDS);
  return parts.map((part, i) => {
    SQL_KEYWORDS.lastIndex = 0;
    return SQL_KEYWORDS.test(part)
      ? <span key={i} className="text-blue-400 font-semibold">{part}</span>
      : <span key={i} className="text-emerald-300">{part}</span>;
  });
}

// ── SQL Panel ─────────────────────────────────────────────────────────────

function SQLPanel({ sql }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 bg-[#0d1117] border border-surface-3 rounded-xl overflow-hidden text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-3/30 transition-colors"
        aria-expanded={open}
        aria-label="Toggle generated SQL"
      >
        <span className="flex items-center gap-2 text-ink-muted font-mono">
          <Code2 size={13} className="text-brand-glow" />
          <span className="text-[11px] uppercase tracking-wide font-medium">View generated SQL</span>
        </span>
        {open
          ? <ChevronUp size={13} className="text-ink-subtle" />
          : <ChevronDown size={13} className="text-ink-subtle" />
        }
      </button>

      {open && (
        <div className="border-t border-surface-3">
          <div className="flex justify-end px-3 py-1.5 bg-[#0d1117] border-b border-surface-3/50">
            <button
              onClick={copy}
              className="btn-ghost flex items-center gap-1 text-xs py-1 px-2"
              aria-label="Copy SQL to clipboard"
            >
              {copied
                ? <><Check size={11} className="text-success" /><span className="text-success">Copied!</span></>
                : <><Copy size={11} /><span>Copy SQL</span></>
              }
            </button>
          </div>
          <pre className="font-mono p-4 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">
            {highlightSQL(sql)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Smart cell formatter ──────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="text-ink-subtle italic text-[10px]">—</span>;
  }
  const str = String(value);

  // ISO date → "Jun 16, 2026"
  if (ISO_DATE_RE.test(str)) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
      }
    } catch {}
  }

  // Number with 2+ decimals → formatted locale string
  const num = Number(value);
  if (!isNaN(num) && str.includes(".") && str.split(".")[1].length >= 2) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Long strings → truncate with tooltip
  if (str.length > 40) {
    return (
      <span title={str} className="cursor-help">
        {str.slice(0, 40)}…
      </span>
    );
  }

  return str;
}

// ── Data Table with sort, filter, pagination, copy JSON ──────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined"
      ? window.innerWidth < 768
      : false
  );

  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return mobile;
}

const PAGE_SIZE = 10;

function DataTable({ columns, rows, rowCount }) {
    const isMobile = useIsMobile();

  const [mobileView, setMobileView] = useState(() => {
    return columns.length > 4 ? "card" : "table";
  });
  useEffect(() => {
  if (columns.length <= 4) {
    setMobileView("table");
  }
}, [columns.length]);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);   // column index
  const [sortDir, setSortDir] = useState("asc");  // "asc" | "desc"
  const [filterText, setFilterText] = useState("");
  const [highlightRow, setHighlightRow] = useState(null);
  const [copiedJSON, setCopiedJSON] = useState(false);

  // Filter
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => cell !== null && String(cell).toLowerCase().includes(lower))
    );
  }, [rows, filterText]);

  // Sort
  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const an = Number(av), bn = Number(bv);
      const cmp = !isNaN(an) && !isNaN(bn)
        ? an - bn
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter changes
  const handleFilter = useCallback((val) => {
    setFilterText(val);
    setPage(0);
  }, []);

  const handleSort = (colIdx) => {
    if (sortCol === colIdx) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
    setPage(0);
  };

  const downloadCSV = () => {
    const header = columns.join(",");
    const body = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    const obj = rows.map((r) =>
      Object.fromEntries(columns.map((c, i) => [c, r[i]]))
    );
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  if (!columns.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-surface-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-surface-3 gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-muted flex-shrink-0">
          <span className="font-semibold text-ink">{rowCount.toLocaleString()}</span>
          <span>row{rowCount !== 1 ? "s" : ""}</span>
          <span className="text-ink-subtle">·</span>
          <span className="font-semibold text-ink">{columns.length}</span>
          <span>col{columns.length !== 1 ? "s" : ""}</span>
          {filterText && (
            <>
              <span className="text-ink-subtle">·</span>
              <span className="text-brand-glow font-semibold">{filteredRows.length} filtered</span>
            </>
          )}
        </div>

        {/* Filter input */}
        <div className="relative flex-1 max-w-[200px]">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => handleFilter(e.target.value)}
            placeholder="Filter rows…"
            className="w-full bg-surface-2 border border-surface-3 rounded-lg pl-6 pr-6 py-1 text-[11px] text-ink placeholder-ink-subtle focus:outline-none focus:border-brand/50"
            aria-label="Filter table rows"
          />
          {filterText && (
            <button
              onClick={() => handleFilter("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
              aria-label="Clear filter"
            >
              <X size={10} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={copyJSON}
            className="btn-ghost flex items-center gap-1 text-xs py-1 px-2"
            aria-label="Copy all data as JSON"
          >
            {copiedJSON
              ? <><Check size={11} className="text-success" /><span className="text-success">Copied!</span></>
              : <><Copy size={11} /><span>JSON</span></>
            }
          </button>
          <button
            onClick={downloadCSV}
            className="btn-ghost flex items-center gap-1 text-xs py-1 px-2"
            aria-label="Download data as CSV"
          >
            <Download size={11} />
            CSV
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      {/* Mobile table/card toggle */}
{isMobile && columns.length > 4 && (
  <div className="px-3 py-2 border-b border-surface-3 bg-surface-1 flex gap-2">
    <button
      onClick={() => setMobileView("table")}
      className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
        mobileView === "table"
          ? "bg-brand text-white"
          : "bg-surface-2 border border-surface-3 text-ink-muted"
      }`}
    >
      Table View
    </button>

    <button
      onClick={() => setMobileView("card")}
      className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
        mobileView === "card"
          ? "bg-brand text-white"
          : "bg-surface-2 border border-surface-3 text-ink-muted"
      }`}
    >
      Card View
    </button>
  </div>
)}

{/* Mobile card layout */}
{isMobile &&
 columns.length > 4 &&
 mobileView === "card" && (
  <div className="p-3 space-y-3">
    {pageRows.map((row, rowIndex) => (
      <div
        key={rowIndex}
        className="bg-surface-2 border border-surface-3 rounded-xl p-3"
      >
        {columns.map((col, ci) => (
          <div
            key={col}
            className="flex justify-between gap-3 py-1 text-xs"
          >
            <div className="font-semibold text-ink-muted">
              {col}
            </div>

            <div className="text-right text-ink break-all">
              {formatCell(row[ci])}
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
)}

{/* Desktop / Table View */}
<div
  className={`overflow-x-auto ${
    isMobile &&
    columns.length > 4 &&
    mobileView === "card"
      ? "hidden"
      : ""
  }`}
>
        <table
          className="w-full text-xs border-collapse"
          role="table"
          aria-label="Query results"
        >
          <thead className="bg-surface-1 sticky top-0 z-10">
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={col}
                  scope="col"
                  onClick={() => handleSort(ci)}
                  style={{ resize: "horizontal", overflow: "auto", minWidth: "80px" }}
                  className="px-3 py-2.5 text-left font-semibold text-ink-muted border-b border-surface-3 whitespace-nowrap uppercase text-[10px] tracking-wide cursor-pointer select-none hover:text-ink transition-colors"
                  aria-sort={sortCol === ci ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === ci
                      ? sortDir === "asc"
                        ? <ArrowUp size={9} className="text-brand-glow" />
                        : <ArrowDown size={9} className="text-brand-glow" />
                      : <ArrowUp size={9} className="text-ink-subtle/30" />
                    }
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-xs text-ink-subtle"
                >
                  No rows match the current filter.
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => {
                const globalIdx = page * PAGE_SIZE + ri;
                return (
                  <tr
                    key={ri}
                    onClick={() => setHighlightRow((prev) => prev === globalIdx ? null : globalIdx)}
                    className={`
                      border-b border-surface-3/40 transition-colors cursor-pointer
                      ${highlightRow === globalIdx
                        ? "bg-brand/10"
                        : ri % 2 === 0 ? "bg-surface-2 hover:bg-brand/5" : "bg-surface-1/50 hover:bg-brand/5"
                      }
                    `}
                    aria-selected={highlightRow === globalIdx}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-ink-muted font-mono whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"
                      >
                        {formatCell(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-t border-surface-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-ghost py-1 px-2 text-xs flex items-center gap-1 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={12} /> Prev
          </button>
          <span className="text-[10px] text-ink-subtle">
            page <span className="font-semibold text-ink">{page + 1}</span> of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-ghost py-1 px-2 text-xs flex items-center gap-1 disabled:opacity-30"
            aria-label="Next page"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ChatMessage ──────────────────────────────────────────────────────

export default function ChatMessage({ message, onFollowUp }) {
  const { role, content, data, ts } = message;

  const timeStr = ts
    ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (role === "user") {
    return (
      <div className="flex justify-end mb-5 group">
        <div className="max-w-[95%] md:max-w-[78%]">
          <div className="bubble-user">{content}</div>
          <p className="text-[10px] text-ink-subtle mt-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  // ── Assistant turn ──
  return (
    <div className="flex gap-2 md:gap-3 mb-5 items-start group">
      {/* Avatar */}
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} className="text-brand-glow" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Error card */}
        {data?.error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-start gap-3" role="alert">
            <AlertCircle size={15} className="text-danger mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-danger mb-0.5">Query error</p>
              <p className="text-sm text-ink-muted">{data.error}</p>
            </div>
          </div>
        )}

        {/* Main response card */}
        {!data?.error && (
          <div className="bg-surface-2 border border-surface-3 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm">
            {/* Narrative text — rendered via react-markdown */}
            {content && (
              <div className="prose-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}

            {/* Data table */}
            {data?.columns?.length > 0 && (
              <DataTable
                columns={data.columns}
                rows={data.rows ?? []}
                rowCount={data.row_count ?? 0}
              />
            )}

            {/* SQL panel */}
            {data?.sql && <SQLPanel sql={data.sql} />}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-ink-subtle mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {timeStr}
        </p>

        {/* Follow-up chips */}
        {data?.follow_ups?.length > 0 && (
          <div className="mt-2.5 ml-1" aria-label="Suggested follow-up questions">
            <p className="text-[11px] text-ink-subtle mb-2 flex items-center gap-1.5">
              <Sparkles size={10} className="text-brand-glow" aria-hidden="true" />
              Suggested follow-ups
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.follow_ups.map((q, i) => (
                <button
                  key={i}
                  className="chip"
                  onClick={() => onFollowUp?.(q)}
                  title={q}
                  aria-label={`Follow-up: ${q}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}