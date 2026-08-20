import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/mainview/**/*.{js,ts,jsx,tsx,html}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};

export default config;
