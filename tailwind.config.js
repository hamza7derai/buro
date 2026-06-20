/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          500: '#4f8ef7',
          600: '#3b7cf5',
          700: '#2563eb',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          0: '#0f1117',
          1: '#181c27',
          2: '#1e2333',
          3: '#252b3b',
        },
        bord: '#2a3148',
        success: '#38d9a9',
        warn: '#f7c948',
        danger: '#f55f5f',
        txt: {
          1: '#e8ecf4',
          2: '#8b92a8',
          3: '#5a6175',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
