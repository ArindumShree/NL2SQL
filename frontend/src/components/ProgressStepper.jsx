import React from "react";
import { Database, Code2, PlayCircle, Sparkles, Check } from "lucide-react";

const STEPS = [
  { id: "schema",  icon: Database,    label: "Reading schema"    },
  { id: "query",   icon: Code2,       label: "Writing SQL"       },
  { id: "execute", icon: PlayCircle,  label: "Running query"     },
  { id: "insight", icon: Sparkles,    label: "Composing analysis" },
];

function stepIndex(stepId) {
  return STEPS.findIndex((s) => s.id === stepId);
}

export default function ProgressStepper({ currentStep }) {
  const activeIdx = stepIndex(currentStep);

  return (
    <div className="flex gap-3 mb-5 items-start">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
        <Database size={15} className="text-brand-glow animate-pulse" />
      </div>

      <div className="flex-1 bg-surface-2 border border-surface-3 rounded-2xl rounded-tl-sm px-4 py-3.5">
        <p className="text-xs text-ink-muted mb-3 font-medium">Processing your question…</p>

        {/* Desktop: horizontal */}
        <div className="hidden sm:flex items-center gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < activeIdx;
            const isActive = i === activeIdx;
            const isPending = i > activeIdx;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${
                      isDone
                        ? "bg-success/15 border-success/40 text-success"
                        : isActive
                        ? "bg-brand/15 border-brand/50 text-brand-glow animate-pulse"
                        : "bg-surface-3 border-surface-3 text-ink-subtle"
                    }`}
                    aria-label={`${step.label}: ${isDone ? "done" : isActive ? "active" : "pending"}`}
                  >
                    {isDone ? <Check size={13} /> : <Icon size={13} />}
                  </div>
                  <span
                    className={`text-[10px] whitespace-nowrap font-medium ${
                      isActive ? "text-ink" : isDone ? "text-success" : "text-ink-subtle"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 mb-4 transition-all duration-500 ${
                      i < activeIdx ? "bg-success/40" : "bg-surface-3"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile: vertical */}
        <div className="flex flex-col gap-2 sm:hidden">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < activeIdx;
            const isActive = i === activeIdx;

            return (
              <div key={step.id} className="flex items-center gap-2.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-all duration-300 ${
                    isDone
                      ? "bg-success/15 border-success/40 text-success"
                      : isActive
                      ? "bg-brand/15 border-brand/50 text-brand-glow animate-pulse"
                      : "bg-surface-3 border-surface-3 text-ink-subtle"
                  }`}
                >
                  {isDone ? <Check size={11} /> : <Icon size={11} />}
                </div>
                <span
                  className={`text-xs ${
                    isActive ? "text-ink font-medium" : isDone ? "text-success" : "text-ink-subtle"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}