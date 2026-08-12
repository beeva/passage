import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Contrast-checked against WCAG (a real Node script computing
        // relative luminance and contrast ratio, not eyeballed) before
        // use: every -50 through -400 shade clears 4.5:1 against both
        // ink-950 and ink-900 backgrounds for normal text; -500/-600 are
        // reserved for large text, UI elements, and borders, where the
        // requirement is only 3:1 (ink-600 on ink-900 falls short of even
        // that, so it's border/divider-only, never text).
        ink: {
          50: "#f6f6f8",
          100: "#ececf1",
          200: "#d3d4dd",
          300: "#b6b7c5",
          400: "#9a9bab",
          500: "#7d7f92",
          600: "#5d5f72",
          700: "#3f4152",
          800: "#262832",
          900: "#1a1c22",
          950: "#0d0e12",
        },
        // Citation highlight - the color of a passage marked as the
        // answer, like a highlighter pen on the page.
        amber: {
          400: "#f0b93e",
          500: "#e39d16",
          600: "#c17d0a",
        },
        // Primary interactive / brand.
        indigo: {
          400: "#8b93f5",
          500: "#6670ee",
          600: "#4750d1",
        },
        // Verified / confident / success.
        teal: {
          400: "#4fd6c0",
          500: "#22bfa5",
          600: "#128f7a",
        },
        // Refused / low-confidence / error.
        rose: {
          400: "#f0728a",
          500: "#e6465f",
          600: "#c22443",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(227,157,22,0.14), transparent 60%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(227,157,22,0.18), 0 8px 40px -8px rgba(227,157,22,0.3)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 60px -20px rgba(0,0,0,0.7)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
