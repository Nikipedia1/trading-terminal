/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KuCoin-inspired dark palette
        'terminal-bg': '#0b0e11',
        'terminal-panel': '#12161c',
        'terminal-border': '#1e2329',
        'terminal-text': '#eaecef',
        'terminal-muted': '#848e9c',
        'terminal-green': '#0ecb81',
        'terminal-red': '#f6465d',
        'terminal-yellow': '#f0b90b',
        'terminal-blue': '#1e90ff',
        'terminal-hover': '#1a1f27',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.65rem',
      },
    },
  },
  plugins: [],
}
