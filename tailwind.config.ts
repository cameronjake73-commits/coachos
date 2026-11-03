import type { Config } from 'tailwindcss';

/**
 * Dark theme. The slate scale is inverted (50 = page background, 900 = main text) and the
 * light tint shades (50/100/200) of status colours are translucent, so every page picks up
 * the dark look without per-page changes.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: { '2xs': ['11px', '14px'] },
      colors: {
        surface: '#10121d',       // cards
        raised: '#151827',        // hover / nested panels
        sidebar: '#0c0d17',
        slate: {
          50: '#0a0b13', 100: '#171a2a', 200: '#212436', 300: '#2e3249', 400: '#5f6583',
          500: '#878da9', 600: '#a4a9c1', 700: '#c5c9da', 800: '#e1e3ed', 900: '#f5f6fa',
        },
        brand: {
          50: 'rgba(124,92,255,0.12)', 100: '#ddd5ff', 200: 'rgba(124,92,255,0.32)', 300: '#b9a8ff',
          400: '#9a83ff', 500: '#7c5cff', 600: '#6a46f5', 700: '#a28cff', 800: '#5232d6', 900: '#2a1a73',
        },
        emerald: { 50: 'rgba(34,197,94,0.12)', 100: 'rgba(34,197,94,0.2)', 200: 'rgba(34,197,94,0.32)', 400: '#4ade80', 500: '#22c55e', 600: '#22c55e', 700: '#4ade80', 800: '#86efac' },
        red: { 50: 'rgba(239,68,68,0.12)', 100: 'rgba(239,68,68,0.2)', 200: 'rgba(239,68,68,0.34)', 400: '#f87171', 500: '#ef4444', 600: '#e5484d', 700: '#ff8080', 800: '#fca5a5' },
        amber: { 50: 'rgba(245,158,11,0.12)', 100: 'rgba(245,158,11,0.2)', 200: 'rgba(245,158,11,0.34)', 400: '#fbbf24', 500: '#f59e0b', 600: '#f59e0b', 700: '#fcd34d', 800: '#fde68a' },
        sky: { 50: 'rgba(59,130,246,0.12)', 100: 'rgba(59,130,246,0.2)', 200: 'rgba(59,130,246,0.34)', 400: '#60a5fa', 500: '#3b82f6', 600: '#3b82f6', 700: '#93c5fd', 800: '#bfdbfe' },
        pink: { 50: 'rgba(236,72,153,0.12)', 400: '#f472b6', 500: '#ec4899' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.3), 0 12px 40px -12px rgba(124,92,255,0.45)',
        card: 'inset 0 1px 0 0 rgba(255,255,255,0.035), 0 1px 2px 0 rgba(0,0,0,0.25)',
        pop: '0 16px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .2s ease-out both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
