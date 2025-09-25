import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        paragon: {
          primary: "#0f9d8a",
          "primary-content": "#f5fbf9",
          secondary: "#0b5560",
          accent: "#f7b548",
          neutral: "#1f2933",
          "base-100": "#f5f7fb",
          "base-200": "#e6edf2",
          "base-300": "#c8d6dc",
          info: "#1cb6d4",
          success: "#1fba82",
          warning: "#f2c94c",
          error: "#e86969",
          "--rounded-box": "0.75rem",
          "--rounded-btn": "0.5rem",
          "--tab-radius": "0.5rem",
        },
      },
      "business",
    ],
    logs: false,
  },
} satisfies Config & {
  daisyui: {
    themes: unknown;
    logs: boolean;
  };
};

export default config;
