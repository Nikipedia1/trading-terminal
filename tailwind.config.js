/** @type {import('tailwindcss').Config} */
/**
 * Design system locked to SplashLoader / login aesthetic:
 * void #05070a · surface #0b0e11 · panel #12161c · gold #f0b90b · blue #5b8def
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          void: '#05070a',
          bg: '#0b0e11',
          panel: '#12161c',
          elevated: '#161b22',
          hover: '#1a1f27',
          border: '#1e2329',
          'border-strong': '#2b3139',
          text: '#eaecef',
          secondary: '#c8cdd5',
          muted: '#848e9c',
          dim: '#7a8494',
          faint: '#5e6673',
          green: '#0ecb81',
          red: '#f6465d',
          yellow: '#f0b90b',
          gold: '#f0b90b',
          'gold-dim': '#c99400',
          'gold-bright': '#ffe08a',
          blue: '#5b8def',
          'blue-bright': '#7aa2f7',
        },
        /* legacy aliases (same hex) */
        'terminal-bg': '#0b0e11',
        'terminal-panel': '#12161c',
        'terminal-border': '#1e2329',
        'terminal-text': '#eaecef',
        'terminal-muted': '#848e9c',
        'terminal-green': '#0ecb81',
        'terminal-red': '#f6465d',
        'terminal-yellow': '#f0b90b',
        'terminal-blue': '#5b8def',
        'terminal-hover': '#1a1f27',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xxs: '0.65rem',
      },
      boxShadow: {
        'nacs-card':
          '0 0 0 1px rgba(240, 185, 11, 0.06), 0 24px 64px rgba(0, 0, 0, 0.55)',
        'nacs-gold': '0 0 24px rgba(240, 185, 11, 0.28)',
        'nacs-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'nacs-gold-bar':
          'linear-gradient(90deg, #c99400 0%, #f0b90b 50%, #ffe08a 100%)',
        'nacs-panel': 'linear-gradient(165deg, #12161c 0%, #0d1117 100%)',
        'nacs-header': 'linear-gradient(180deg, #141a22 0%, #12161c 100%)',
        'nacs-void':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(240, 185, 11, 0.1), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(91, 141, 239, 0.07), transparent 50%), #05070a',
      },
      borderRadius: {
        nacs: '0.75rem',
      },
    },
  },
  plugins: [],
}
