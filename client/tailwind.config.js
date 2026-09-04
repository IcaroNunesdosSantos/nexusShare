/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0d14",
          900: "#11141d",
          800: "#181c28",
          700: "#222738",
          600: "#2c3348",
        },
        accent: {
          400: "#7c9cff",
          500: "#5b7cfa",
          600: "#3d5ef0",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(91, 124, 250, 0.18)",
      },
    },
  },
  plugins: [],
};
