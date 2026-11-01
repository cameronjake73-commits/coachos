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
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        surface: '#121831',     // cards
        sidebar: '#0d1226',
        slate: {
          50: '#090d1c', 100: '#1a2142', 200: '#232b4a', 300: '#313a5f', 400: '#69729a',
          500: '#8b93b5', 600: '#a6aecb', 700: '#c5cae0', 800: '#dfe2f0', 900: '#f3f4fb',
        },
        brand: {
          50: 'rgba(124,92,255,0.14)', 100: '#ddd5ff', 200: 'rgba(124,92,255,0.35)', 300: '#b9a8ff',
          400: '#9a83ff', 500: '#7c5cff', 600: '#6a46f5', 700: '#a28cff', 800: '#5232d6', 900: '#2a1a73',
        },
        emerald: { 50: 'rgba(34,197,94,0.14)', 100: 'rgba(34,197,94,0.2)', 200: 'rgba(34,197,94,0.35)', 400: '#4ade80', 500: '#22c55e', 600: '#22c55e', 700: '#4ade80', 800: '#86efac' },
        red: { 50: 'rgba(239,68,68,0.14)', 100: 'rgba(239,68,68,0.2)', 200: 'rgba(239,68,68,0.38)', 400: '#f87171', 500: '#ef4444', 600: '#e5484d', 700: '#ff7b7b', 800: '#fca5a5' },
        amber: { 50: 'rgba(249,115,22,0.15)', 100: 'rgba(249,115,22,0.22)', 200: 'rgba(249,115,22,0.4)', 400: '#fb923c', 500: '#f97316', 600: '#f97316', 700: '#fdba74', 800: '#fdba74' },
        sky: { 50: 'rgba(59,130,246,0.15)', 100: 'rgba(59,130,246,0.22)', 200: 'rgba(59,130,246,0.4)', 400: '#60a5fa', 500: '#3b82f6', 600: '#3b82f6', 700: '#93c5fd', 800: '#93c5fd' },
      },
      boxShadow: { glow: '0 0 0 1px rgba(124,92,255,0.35), 0 10px 40px -10px rgba(124,92,255,0.45)' },
    },
  },
  plugins: [],
} satisfies Config;
