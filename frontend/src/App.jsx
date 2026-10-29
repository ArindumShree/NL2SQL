import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Database, Zap, Trash2, Menu, X, Sun, Moon,
  Download, Wifi, WifiOff, ArrowRight,
  MessageSquare, Code, Table, RotateCcw, AlertCircle,
} from "lucide-react";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import TypingIndicator from "./components/TypingIndicator";
import ProgressStepper from "./components/ProgressStepper";
import Sidebar from "./components/Sidebar";
import SchemaPanel from "./components/SchemaPanel";
import { useChat } from "./components/ChatContext";
import { submitChatStream } from "./utils/api";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// ── Animated counter ──────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 1200 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <span>{count.toLocaleString()}</span>;
}

// ── Welcome screen ────────────────────────────────────────────────────────
const STARTER_PROMPTS = [
  { label: "Show me the top 10 customers by total order value", icon: "💰" },
  { label: "Which products are running low on stock?", icon: "📦" },
  { label: "Who are the top 5 employees by revenue?", icon: "🏆" },
  { label: "List all orders shipped to Germany in 1997", icon: "🌍" },
];

const SCHEMA_CHIPS = [
  { name: "customers", prompt: "Show me all customers" },
  { name: "orders", prompt: "Show all recent orders" },
  { name: "products", prompt: "List all products with prices" },
  { name: "employees", prompt: "Show all employees" },
  { name: "suppliers", prompt: "List all suppliers" },
  { name: "categories", prompt: "Show all product categories" },
  { name: "shippers", prompt: "List all shippers" },
  { name: "order_details", prompt: "Show order details breakdown" },
];

const DB_STATS = [
  { label: "customers", value: 91 },
  { label: "orders", value: 830 },
  { label: "products", value: 77 },
  { label: "categories", value: 9 },
];

const HOW_IT_WORKS = [
  { Icon: MessageSquare, step: "Ask in plain English", desc: "No SQL knowledge needed" },
  { Icon: Code, step: "AI writes the SQL", desc: "Gemini generates precise queries" },
  { Icon: Table, step: "See live results", desc: "Real data from your database" },
];

function WelcomeScreen({ onPrompt }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in min-h-full">
      <div className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center mb-5">
        <Database size={26} className="text-brand-glow" />
      </div>

      <h2 className="text-2xl font-bold text-ink mb-2 tracking-tight">
        Ask your database anything
      </h2>
      <p className="text-ink-muted text-sm max-w-sm leading-relaxed mb-6">
        Type in plain English. Gemini translates it to SQL via MCP, runs it live, and answers you with full context.
      </p>

      {/* DB stats */}
      <div className="grid grid-cols-4 gap-3 mb-8 w-full max-w-sm">
        {DB_STATS.map(({ label, value }) => (
          <div key={label} className="bg-surface-2 border border-surface-3 rounded-xl py-3 px-2 text-center">
            <div className="text-lg font-bold text-brand-glow">
              <AnimatedCounter target={value} />
            </div>
            <div className="text-[10px] text-ink-subtle mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Schema chips */}
      <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-sm">
        {SCHEMA_CHIPS.map(({ name, prompt }) => (
          <button
            key={name}
            onClick={() => onPrompt(prompt)}
            className="bg-surface-2 border border-surface-3 hover:border-brand/40 hover:bg-brand/5 rounded-full px-3 py-1 text-xs text-ink-muted font-mono transition-all focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label={`Query ${name} table`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* How it works */}
      <div className="flex items-start gap-4 mb-8 max-w-sm w-full">
        {HOW_IT_WORKS.map(({ Icon, step, desc }, i) => (
          <div key={step} className="flex-1 text-center">
            <div className="w-9 h-9 bg-surface-2 border border-surface-3 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Icon size={15} className="text-brand-glow" />
            </div>
            <p className="text-xs font-semibold text-ink leading-snug">{step}</p>
            <p className="text-[10px] text-ink-subtle mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Starter prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {STARTER_PROMPTS.map(({ label, icon }) => (
          <button
            key={label}
            onClick={() => onPrompt(label)}
            className="text-left text-sm text-ink-muted hover:text-ink bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-brand/40 rounded-xl px-4 py-3 transition-all duration-150 flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label={label}
          >
            <span className="flex items-center gap-2">
              <span>{icon}</span>
              <span>{label}</span>
            </span>
            <ArrowRight size={13} className="text-ink-subtle group-hover:text-brand-glow transition-colors shrink-0 ml-2" />
          </button>
        ))}
      </div>

      {/* Shortcut hints */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] text-ink-subtle">
        <span><kbd className="bg-surface-3 border border-surface-3 rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> focus input</span>
        <span><kbd className="bg-surface-3 border border-surface-3 rounded px-1.5 py-0.5 font-mono text-[10px]">⌘N</kbd> new chat</span>
        <span><kbd className="bg-surface-3 border border-surface-3 rounded px-1.5 py-0.5 font-mono text-[10px]">⌘/</kbd> schema</span>
      </div>
    </div>
  );
}

// ── Inline Error Card ─────────────────────────────────────────────────────
function ErrorCard({ message, onRetry, onRephrase }) {
  return (
    <div className="flex gap-3 mb-5 items-start">
      <div className="w-8 h-8 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0 mt-0.5">
        <AlertCircle size={15} className="text-danger" />
      </div>
      <div className="flex-1 bg-danger/5 border border-danger/20 rounded-2xl rounded-tl-sm px-4 py-3.5">
        <p className="text-sm font-semibold text-danger mb-1">Something went wrong</p>
        <p className="text-sm text-ink-muted mb-3">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-xs bg-surface-3 hover:bg-surface-2 border border-surface-3 text-ink px-3 py-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Retry the failed request"
          >
            <RotateCcw size={11} /> Try again
          </button>
          <button
            onClick={onRephrase}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink px-3 py-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Rephrase the question"
          >
            Rephrase
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connection status ─────────────────────────────────────────────────────
function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/health",
          { signal: AbortSignal.timeout(4000) }
        );
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 border text-[11px] font-medium ${
        online
          ? "bg-success/10 border-success/20 text-success"
          : "bg-danger/10 border-danger/20 text-danger"
      }`}
      aria-label={online ? "Connected to backend" : "Backend offline"}
    >
      {online ? <Wifi size={11} /> : <WifiOff size={11} />}
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${online ? "bg-success" : "bg-danger"}`} />
      <span className="hidden sm:inline">{online ? "Connected" : "Offline"}</span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const { activeSession, addMessage, newSession, buildBackendHistory } = useChat();
  const messages = activeSession?.messages ?? [];

  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(null);
  const [prefill, setPrefill] = useState("");
  const [failedQuestion, setFailedQuestion] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("nl2sql_sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("nl2sql_theme") || "dark"; } catch { return "dark"; }
  });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Theme apply
  useEffect(() => {
    document.documentElement.classList.toggle("light-theme", theme === "light");
    try { localStorage.setItem("nl2sql_theme", theme); } catch {}
  }, [theme]);

  // Sidebar collapse persist
  useEffect(() => {
    try { localStorage.setItem("nl2sql_sidebar_collapsed", sidebarCollapsed); } catch {}
  }, [sidebarCollapsed]);

  // Lock body scroll when mobile sidebar is open
useEffect(() => {
  if (window.innerWidth < 768) {
    document.body.style.overflow = sidebarOpen
      ? "hidden"
      : "";
  }

  return () => {
    document.body.style.overflow = "";
  };
}, [sidebarOpen]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, progressStep]);

  const handleSubmit = useCallback(async (question) => {
    setErrorMessage(null);
    setFailedQuestion(null);

    addMessage({ id: `u_${Date.now()}`, role: "user", content: question });
    setLoading(true);
    setProgressStep("schema");

    const history = buildBackendHistory();

    try {
      await submitChatStream(question, history, {
        onProgress: ({ step }) => setProgressStep(step),
        onResult: (data) => {
          setProgressStep(null);
          setLoading(false);
          addMessage({
            id: `a_${Date.now()}`,
            role: "assistant",
            content: data.model_text || (data.error ? data.error : "Here are the results:"),
            data,
          });
        },
        onError: (msg) => {
          setProgressStep(null);
          setLoading(false);
          setFailedQuestion(question);
          setErrorMessage(msg);
        },
      });
    } catch (err) {
      setProgressStep(null);
      setLoading(false);
      setFailedQuestion(question);
      setErrorMessage(err?.message || "Could not reach the server.");
    }
  }, [addMessage, buildBackendHistory]);

  const handleFollowUp = (q) => setPrefill(q);
  const handleRetry = () => { if (failedQuestion) handleSubmit(failedQuestion); };
  const handleRephrase = () => { if (failedQuestion) { setPrefill(failedQuestion); setFailedQuestion(null); setErrorMessage(null); } };
  const handleNewSession = () => { newSession(); };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    focusInput: () => inputRef.current?.focus(),
    newSession: handleNewSession,
    toggleSchema: () => {}, // future: open schema panel
    escape: () => setSidebarOpen(false),
  });

  // Export session
  const exportSession = () => {
    const blob = new Blob([JSON.stringify({ session: activeSession, exportedAt: new Date() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nl2sql_session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
  style={{
    display: "flex",
    height: "100dvh",
    overflow: "hidden",
  }}
>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (desktop: static; mobile: fixed overlay) ── */}
      <div
        className={`
          md:relative md:flex md:flex-col md:flex-shrink-0
          fixed inset-y-0 left-0 z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <header className="border-b border-surface-3 bg-surface-1 px-4 py-3 flex-shrink-0 h-[52px] flex items-center">
          <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
            {/* Left: hamburger (mobile) + brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden btn-ghost p-1.5"
                aria-label="Open sidebar"
              >
                <Menu size={17} />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-brand/15 border border-brand/30 rounded-lg flex items-center justify-center">
                  <Database size={13} className="text-brand-glow" />
                </div>
                <div>
                  <h1 className="text-ink font-semibold text-sm leading-none tracking-tight">NL2SQL</h1>
                  <p className="text-ink-subtle text-[10px] mt-0.5 hidden sm:block">Northwind · Gemini 2.5 Flash + MCP</p>
                </div>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <ConnectionStatus />

              <div className="hidden sm:flex items-center gap-1 text-xs text-ink-muted">
                <Zap size={11} className="text-brand-glow" />
                <span>Gemini 2.5 Flash</span>
              </div>

              {messages.length > 0 && (
                <button
                  onClick={exportSession}
                  className="btn-ghost flex items-center gap-1.5 text-xs py-1.5"
                  aria-label="Export session as JSON"
                  title="Export session"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}

              <button
                onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
                className="btn-ghost p-1.5"
                aria-label="Toggle light/dark theme"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {messages.length > 0 && (
                <button
                  onClick={handleNewSession}
                  className="btn-ghost flex items-center gap-1.5 text-xs py-1.5"
                  aria-label="Start new conversation"
                  title="New chat (⌘N)"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Chat body — ONLY this scrolls */}
        <main
          style={{ flex: 1, overflowY: "auto", paddingBottom: "120px" }}
          aria-label="Chat messages"
        >
          <div className="max-w-3xl mx-auto w-full px-4 pt-6">
            {messages.length === 0 && !loading ? (
              <WelcomeScreen onPrompt={handleFollowUp} />
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onFollowUp={handleFollowUp}
                  />
                ))}

                {errorMessage && (
                  <ErrorCard
                    message={errorMessage}
                    onRetry={handleRetry}
                    onRephrase={handleRephrase}
                  />
                )}

                {loading && (
                  progressStep
                    ? <ProgressStepper currentStep={progressStep} />
                    : <TypingIndicator />
                )}

                <div ref={bottomRef} />
              </>
            )}
          </div>
        </main>

        {/* Input bar — flex sibling of main, never scrolls away */}
        <div className="flex-shrink-0 max-w-3xl mx-auto w-full px-4">
          <ChatInput
            ref={inputRef}
            onSubmit={handleSubmit}
            loading={loading}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill("")}
          />
        </div>
      </div>
    </div>
  );
}