/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        verde: {
          50: '#f0faf4',
          100: '#d4edda',
          500: '#2d8a52',
          600: '#1a6b3c',
          700: '#0f4a28',
        }
      }
    },
  },
  plugins: [],
}