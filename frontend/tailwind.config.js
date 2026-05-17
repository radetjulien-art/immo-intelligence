/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["Inter", "sans-serif"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
        mono:    ["JetBrains Mono", "Courier New", "monospace"],
      },
      colors: {
        cream: {
          DEFAULT: "#F8F6F2",
          deep:    "#F2EFE9",
        },
        border: {
          DEFAULT: "#E5DFD8",
          strong:  "#C9BFB4",
        },
        ink: {
          900: "#18150F",
          700: "#3D3429",
          500: "#6B6057",
          400: "#7D7167",
          300: "#9C8F83",
        },
        gold: {
          DEFAULT: "#B8965A",
          light:   "#D4B07A",
          bg:      "#FDF8EF",
        },
        navy: {
          DEFAULT: "#1B2A4A",
          light:   "#253b68",
        },
        signal: {
          green: "#059669",
          amber: "#C8810A",
          red:   "#C0392B",
        },
        // Keep legacy aliases for compatibility
        brand: {
          50:  "#F2EFE9",
          100: "#E8E2D8",
          200: "#D4B07A",
          300: "#C9A563",
          400: "#C09A58",
          500: "#B8965A",
          600: "#1B2A4A",
          700: "#152038",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          page:    "#F8F6F2",
          muted:   "#F2EFE9",
        },
        line: {
          DEFAULT: "#E5DFD8",
          strong:  "#C9BFB4",
        },
        "signal-green": "#059669",
        "signal-amber": "#C8810A",
        "signal-red":   "#C0392B",
        "ink-900": "#18150F",
        "ink-700": "#3D3429",
        "ink-500": "#6B6057",
        "ink-400": "#7D7167",
        "ink-300": "#9C8F83",
      },
      borderRadius: {
        DEFAULT: "4px",
        sm:  "2px",
        md:  "4px",
        lg:  "6px",
        xl:  "8px",
        "2xl": "8px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(24,21,15,0.05)",
        sm: "0 1px 4px rgba(24,21,15,0.06), 0 0 1px rgba(24,21,15,0.08)",
        md: "0 4px 16px rgba(24,21,15,0.08), 0 0 1px rgba(24,21,15,0.08)",
        lg: "0 8px 32px rgba(24,21,15,0.1), 0 0 1px rgba(24,21,15,0.08)",
      },
    },
  },
  plugins: [],
};
