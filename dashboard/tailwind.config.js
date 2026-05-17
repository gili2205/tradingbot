/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        'surface-2': '#334155',
        border: '#334155',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        accent: '#3b82f6',
        green: {
          400: '#4ade80',
          500: '#22c55e',
          900: '#14532d',
        },
        red: {
          400: '#f87171',
          500: '#ef4444',
          900: '#7f1d1d',
        },
      },
    },
  },
  plugins: [],
}
