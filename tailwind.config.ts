import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pixel: {
          grass: "#4CAF50",
          "dark-green": "#388E3C",
          "bird-red": "#E74C3C",
          "bird-yellow": "#FFD700",
          "bird-blue": "#3498DB",
          "bird-orange": "#FF8C00",
          navy: "#1A1A2E",
          "text-white": "#E8E8E8",
          "text-green": "#66BB6A",
          "text-dim": "#5A5A7A",
          panel: "#2A2A3E",
          black: "#0C0C0F",
          gold: "#FFD700",
          silver: "#C0C0C0",
          bronze: "#CD7F32",
        },
      },
      fontFamily: {
        heading: ['"Press Start 2P"', "monospace"],
        typing: ['"Silkscreen"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
