import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e8400c",
          dark: "#c23208",
          light: "#fff1ec",
        },
      },
    },
  },
  plugins: [],
};

export default config;
