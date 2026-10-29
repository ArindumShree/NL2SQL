import React from "react";
import { Database } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4 items-start animate-fade-in">
      <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0">
        <Database size={13} className="text-brand-glow" />
      </div>
      <div className="bubble-assistant py-3 px-4">
        <span className="flex items-center gap-1">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>
    </div>
  );
}