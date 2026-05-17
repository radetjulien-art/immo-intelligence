/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Palette "terminal data pro"
        navy: {
          950: "#020917",
          900: "#050e1f",
          800: "#0a1628",
          700: "#0f2040",
          600: "#152a52",
        },
        electric: {
          500: "#2563eb",
          400: "#3b82f6",
          300: "#60a5fa",
        },
        signal: {
          green: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Sora", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
