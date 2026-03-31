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
          sky: "#87CEEB",
          "deep-sky": "#5B9BD5",
          cloud: "#F0F0F0",
          grass: "#4CAF50",
          "dark-green": "#388E3C",
          brown: "#8B6914",
          "bird-red": "#E74C3C",
          "bird-yellow": "#FFD700",
          "bird-blue": "#3498DB",
          "bird-orange": "#FF8C00",
          navy: "#1A1A2E",
          "text-white": "#E8E8E8",
          "text-green": "#66BB6A",
          "text-dim": "#5A5A7A",
          panel: "#2A2A3E",
          black: "#0A0A14",
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
