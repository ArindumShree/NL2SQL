import React from "react";
import { Database, Cpu, BarChart3 } from "lucide-react";

const steps = [
  { icon: Database, label: "Inspecting schema via MCP…" },
  { icon: Cpu, label: "Generating SQL with Gemini…" },
  { icon: BarChart3, label: "Executing query…" },
];

export default function LoadingSkeleton() {
  return (
    <div className="glass-card p-6 animate-pulse-slow">
      {/* Steps indicator */}
      <div className="flex items-center gap-6 mb-6">
        {steps.map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <Icon size={12} className="text-accent-light" />
            </div>
            <span>{label}</span>
            {i < steps.length - 1 && (
              <div className="w-4 h-px bg-surface-3 ml-1" />
            )}
          </div>
        ))}
      </div>

      {/* Skeleton rows */}
      <div className="space-y-2">
        {/* Header */}
        <div className="flex gap-3 pb-2 border-b border-surface-3">
          {[120, 90, 110, 80, 100].map((w, i) => (
            <div
              key={i}
              className="h-3 bg-surface-3 rounded"
              style={{ width: w }}
            />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 6 }).map((_, ri) => (
          <div key={ri} className="flex gap-3 py-1.5">
            {[120, 90, 110, 80, 100].map((w, ci) => (
              <div
                key={ci}
                className="h-3 bg-surface-2 rounded"
                style={{ width: w, opacity: 1 - ri * 0.12 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}