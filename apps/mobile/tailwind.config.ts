import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./App.tsx",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0D9488",
          dark: "#0F766E"
        }
      }
    }
  },
  plugins: []
};

export default config;

