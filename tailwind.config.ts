import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        subink: '#3f3f46',
        muted: '#6b7280',
        line: '#e5e7eb',
        soft: '#f4f4f5',
        surface: '#ffffff',
        accent: '#ff2b2b',       // bold red — primary CTA + critical severity
        accent700: '#c81919',
        success: '#16a34a',
        serious: '#f59e0b',
        minor: '#0ea5e9',
        sms: '#7c3aed',          // reserved only for the SMS channel badge
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
        cta: '0 6px 20px rgba(255,43,43,0.35)',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};

export default config;
