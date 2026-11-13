import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#082554",
        brand: "#082554",
        sky: "#539DDF",
        success: "#3E871D",
        accent: "#F6BA2A",
        soft: "#f6f8fb",
      },
    },
  },
  plugins: [],
};

export default config;
