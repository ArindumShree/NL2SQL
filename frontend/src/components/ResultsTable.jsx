import React, { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Code2,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { useTableSort } from "../hooks/useTableSort";

function SQLPanel({ sql }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-2 border border-surface-3 rounded-xl overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-3">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-accent-light" />
          <span className="text-xs font-medium text-muted uppercase tracking-wide">
            Generated SQL
          </span>
        </div>
        <button onClick={copy} className="btn-ghost flex items-center gap-1.5 text-xs">
          {copied ? (
            <>
              <Check size={13} className="text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="text-sm font-mono text-accent-light p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {sql}
      </pre>
    </div>
  );
}

function SortIcon({ colIndex, sortConfig }) {
  if (sortConfig.key !== colIndex)
    return <ChevronsUpDown size={13} className="text-muted/50 ml-1 shrink-0" />;
  return sortConfig.dir === "asc" ? (
    <ChevronUp size={13} className="text-accent-light ml-1 shrink-0" />
  ) : (
    <ChevronDown size={13} className="text-accent-light ml-1 shrink-0" />
  );
}

export default function ResultsTable({ result }) {
  const [showSQL, setShowSQL] = useState(false);
  const { sortConfig, handleSort, filterText, setFilterText, processedRows } =
    useTableSort(result?.columns || [], result?.rows || []);

  if (!result) return null;

  const { question, sql, columns, rows, row_count, error } = result;

  // Error state
  if (error) {
    return (
      <div className="glass-card p-6 animate-slide-up">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white font-medium mb-1">Query couldn't be completed</p>
            <p className="text-sm text-muted leading-relaxed">{error}</p>
          </div>
        </div>
        {sql && (
          <div className="mt-4">
            <button
              onClick={() => setShowSQL((s) => !s)}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <Code2 size={13} />
              {showSQL ? "Hide" : "Show"} attempted SQL
            </button>
            {showSQL && <div className="mt-2"><SQLPanel sql={sql} /></div>}
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (!columns || columns.length === 0) {
    return (
      <div className="glass-card p-10 text-center animate-slide-up">
        <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
          <Filter size={20} className="text-muted" />
        </div>
        <p className="text-white font-medium">No results found</p>
        <p className="text-sm text-muted mt-1">
          Try rephrasing your question or check if the data exists.
        </p>
      </div>
    );
  }

  // Export to CSV
  const exportCSV = () => {
    const header = columns.join(",");
    const body = processedRows
      .map((row) =>
        row.map((c) => (c === null ? "" : `"${String(c).replace(/"/g, '""')}"`)).join(",")
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCount = processedRows.length;
  const showingFiltered = filterText.trim() && filteredCount !== row_count;

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-success" />
          <span className="text-sm font-medium text-white">
            {showingFiltered ? (
              <>
                <span className="text-accent-light">{filteredCount}</span>
                <span className="text-muted"> of </span>
                <span>{row_count.toLocaleString()}</span>
                <span className="text-muted"> rows</span>
              </>
            ) : (
              <>
                <span className="text-accent-light">{row_count.toLocaleString()}</span>
                <span className="text-muted"> row{row_count !== 1 ? "s" : ""}</span>
              </>
            )}
          </span>
          <span className="text-muted text-xs">·</span>
          <span className="text-muted text-xs">{columns.length} columns</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter input */}
          <div className="relative">
            <Filter
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Filter results…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-surface-2 border border-surface-3 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white placeholder-muted outline-none focus:border-accent w-44 transition-all"
            />
          </div>

          <button
            onClick={() => setShowSQL((s) => !s)}
            className={`btn-ghost flex items-center gap-1.5 text-xs border ${
              showSQL ? "border-accent/40 text-accent-light" : "border-transparent"
            }`}
          >
            <Code2 size={13} />
            {showSQL ? "Hide SQL" : "View SQL"}
          </button>

          <button
            onClick={exportCSV}
            className="btn-ghost flex items-center gap-1.5 text-xs border border-transparent"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* SQL panel */}
      {showSQL && sql && <SQLPanel sql={sql} />}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    onClick={() => handleSort(i)}
                    className="text-left px-4 py-3 font-medium text-muted hover:text-white cursor-pointer select-none whitespace-nowrap transition-colors group"
                  >
                    <div className="flex items-center">
                      <span
                        className={
                          sortConfig.key === i ? "text-accent-light" : ""
                        }
                      >
                        {col}
                      </span>
                      <SortIcon colIndex={i} sortConfig={sortConfig} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center py-10 text-muted text-sm"
                  >
                    No rows match your filter.
                  </td>
                </tr>
              ) : (
                processedRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-surface-3/50 hover:bg-surface-2/60 transition-colors"
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-4 py-2.5 text-slate-300 max-w-xs"
                        title={cell !== null ? String(cell) : "NULL"}
                      >
                        {cell === null ? (
                          <span className="text-muted/50 italic text-xs">NULL</span>
                        ) : (
                          <span className="truncate block">{String(cell)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}