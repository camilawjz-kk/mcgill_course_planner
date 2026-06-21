import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202A",
        paper: "#F7F3EA",
        mist: "#EEF4F1",
        clay: "#A45D44",
        moss: "#55715C",
        teal: "#1E6F73",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 42, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
