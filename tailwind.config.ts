import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}", "./app/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}", "./lib/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary, #6C63FF)",
          50: "rgb(from var(--primary, #6C63FF) r g b / 0.05)",
          100: "rgb(from var(--primary, #6C63FF) r g b / 0.10)",
          200: "rgb(from var(--primary, #6C63FF) r g b / 0.20)",
          300: "rgb(from var(--primary, #6C63FF) r g b / 0.30)",
          400: "rgb(from var(--primary, #6C63FF) r g b / 0.40)",
          500: "rgb(from var(--primary, #6C63FF) r g b / 0.55)",
          600: "rgb(from var(--primary, #6C63FF) r g b / 0.70)",
        },
        base: {
          900: "#0B1220",
          800: "#0F1A2F",
          700: "#15223D",
        },
      },
      boxShadow: {
        glass: "0 8px 40px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.06)",
      },
      borderRadius: {
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
}

export default config
