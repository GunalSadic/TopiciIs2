import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "sans-serif"] },
      colors: {
        brand: {
          dark:    "#65647C", // primary purple-gray
          mid:     "#8B7E74", // warm brown-gray
          light:   "#C7BCA1", // warm beige accent
          lighter: "#EDE9E2", // very light beige
          bg:      "#F8F6F3", // page background
          deep:    "#1A1927", // hero dark
        },
      },
    },
  },
  plugins: [],
};

export default config;
