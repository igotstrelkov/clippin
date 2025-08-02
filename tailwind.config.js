/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8b5cf6",
        "primary-hover": "#7c3aed",
        secondary: "#6b7280",
      },
      spacing: {
        section: "2rem",
      },
      borderRadius: {
        container: "0.75rem",
      },
      backgroundColor: {
        "gray-750": "#374151",
      },
    },
  },
  plugins: [],
}
