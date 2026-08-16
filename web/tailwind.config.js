/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#FEF7FF',
          surface: '#FFFFFF',
          variant: '#F3F0F7',
          outline: '#CAC4D0',
          'outline-variant': '#E6E0E9',
          primary: '#6750A4',
          'primary-dark': '#21005D',
          'primary-container': '#E8DEF8',
          text: '#1D1B20',
          muted: '#49454F',
          fab: '#D3E3FD',
          'fab-text': '#001D35'
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        }
      }
    },
  },
  plugins: [],
}
