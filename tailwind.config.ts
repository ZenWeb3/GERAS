import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#0b1220',
        surface: '#111a2e',
        surface2: '#182339',
        line: '#26324a',
        ink: '#e7ecf5',
        muted: '#8b98b3',
        critical: '#ff3b3b',
        serious: '#ffb020',
        minor: '#38bdf8',
        teal: '#2dd4bf',
        sms: '#c084fc',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};

export default config;
