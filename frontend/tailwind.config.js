/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Deep navy base — more professional than pure black
        surface: {
          DEFAULT: "#0b0f1a",  // page background
          1: "#111827",        // sidebar / panels
          2: "#1a2236",        // cards
          3: "#233049",        // borders / dividers
          4: "#2d3d5a",        // hover states
        },
        // Blue-indigo accent — authoritative, data-forward
        brand: {
          DEFAULT: "#2563eb",   // primary CTA
          light:   "#3b82f6",   // hover
          dim:     "#1e3a8a",   // subtle backgrounds
          glow:    "#60a5fa",   // highlights / inline code
        },
        // Teal for positive feedback
        success: "#0ea5e9",
        // Amber for warnings
        warning: "#f59e0b",
        // Red for errors
        danger:  "#ef4444",
        // Slate text hierarchy
        ink: {
          DEFAULT: "#f1f5f9",  // headings / primary text
          muted:   "#94a3b8",  // secondary text
          subtle:  "#475569",  // placeholder / disabled
        },
      },
      animation: {
        "pulse-slow":   "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":      "fadeIn 0.2s ease-out",
        "slide-up":     "slideUp 0.25s ease-out",
        "bubble-in":    "bubbleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        "typing":       "typing 1s steps(3, end) infinite",
      },
      keyframes: {
        fadeIn:   { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp:  { "0%": { opacity: 0, transform: "translateY(10px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        bubbleIn: { "0%": { opacity: 0, transform: "scale(0.92) translateY(6px)" }, "100%": { opacity: 1, transform: "scale(1) translateY(0)" } },
        typing:   { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.2 } },
      },
    },
  },
  plugins: [],
};