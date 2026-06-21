/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#A47148", // Desert Clay
        secondary: "#577590", // Muted Ocean
        warmSand: "#F8F4EE", // Warm Sand background
        cardSurface: "#FFFFFF",
        textPrimary: "#2B2D42",
        textSecondary: "#6B7280",
        borderClay: "#E7DED2",
        successGreen: "#6B8F71",
        warningAmber: "#D4A373",
        errorRust: "#BC6C25",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Courier New", "Courier", "monospace"],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
