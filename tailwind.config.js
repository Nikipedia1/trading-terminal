/** @type {import('tailwindcss').Config} */
/**
 * Fluid pro desk — cool neutrals, restrained accent
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          void: '#06080c',
          bg: '#0a0d12',
          panel: '#0f141b',
          elevated: '#151b24',
          hover: '#1a222d',
          border: '#1c2430',
          'border-strong': '#2a3444',
          text: '#eef1f6',
          secondary: '#c5ccd8',
          muted: '#8b95a8',
          dim: '#6b7588',
          faint: '#4f5868',
          green: '#2dd4a0',
          red: '#f2556d',
          yellow: '#e8c547',
          gold: '#e8c547',
          'gold-dim': '#b8972e',
          'gold-bright': '#f5dfa0',
          blue: '#6b9fff',
          'blue-bright': '#8bb4ff',
          cyan: '#3dd6c6',
        },
        'terminal-bg': '#0a0d12',
        'terminal-panel': '#0f141b',
        'terminal-border': '#1c2430',
        'terminal-text': '#eef1f6',
        'terminal-muted': '#8b95a8',
        'terminal-green': '#2dd4a0',
        'terminal-red': '#f2556d',
        'terminal-yellow': '#e8c547',
        'terminal-blue': '#6b9fff',
        'terminal-hover': '#1a222d',
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
          '0 0 0 1px rgba(255, 255, 255, 0.04), 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'nacs-gold': '0 0 32px rgba(232, 197, 71, 0.12)',
        'nacs-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      backgroundImage: {
        'nacs-gold-bar':
          'linear-gradient(90deg, #b8972e 0%, #e8c547 50%, #f5dfa0 100%)',
        'nacs-panel':
          'linear-gradient(165deg, rgba(21, 27, 36, 0.95) 0%, rgba(12, 16, 22, 0.98) 100%)',
        'nacs-header':
          'linear-gradient(180deg, rgba(21, 27, 36, 0.9) 0%, rgba(15, 20, 27, 0.95) 100%)',
        'nacs-void':
          'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(107, 159, 255, 0.07), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 100%, rgba(61, 214, 198, 0.04), transparent 50%), #06080c',
      },
      borderRadius: {
        nacs: '0.75rem',
      },
      transitionTimingFunction: {
        'nacs-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'nacs': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
