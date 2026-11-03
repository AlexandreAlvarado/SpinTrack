import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1726",
        brand: "#d52a36",
        soft: "#f6f8fb",
      },
    },
  },
  plugins: [],
};

export default config;
