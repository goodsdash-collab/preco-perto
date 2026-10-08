import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f9d58", dark: "#0b7a44", soft: "#e7f6ee" },
      },
    },
  },
  plugins: [],
};
export default config;
