import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#213044',
          light: '#26405c',
          dark: '#1b2a3d',
          darkest: '#10161f',
        },
        gold: {
          DEFAULT: '#c9a24a',
          alt: '#c79a4d',
          light: '#e6c878',
          cream: '#f4ecda',
          muted: '#a07d3e',
        },
        litred: {
          DEFAULT: '#c8102e',
          alt: '#b0412f',
        },
        canvas: '#f4f1ec',
        card: '#ffffff',
        warm: {
          DEFAULT: '#fbfaf7',
          deep: '#fbf7ee',
        },
        text: {
          primary: '#1b2230',
          secondary: '#5b6473',
          muted: '#8b8478',
          faint: '#a99f8d',
        },
        border: {
          DEFAULT: '#e8e3da',
          warm: '#eee5d6',
          light: '#ddd5c6',
        },
        status: {
          green: '#2f7d5b',
          'green-bg': '#eef5f1',
          amber: '#b07d2a',
          'amber-bg': '#f7efe1',
          blue: '#3f6b8a',
          'blue-bg': '#e9f0f5',
        },
        ms: '#0F6CBD',
      },
      fontFamily: {
        spectral: ['var(--font-spectral)', 'Georgia', 'serif'],
        sans: ['var(--font-public-sans)', 'system-ui', 'sans-serif'],
        anton: ['var(--font-anton)', 'sans-serif'],
        vibes: ['var(--font-great-vibes)', 'cursive'],
      },
      borderRadius: {
        card: '10px',
        pill: '20px',
        ctrl: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(20,25,40,.12)',
      },
    },
  },
  plugins: [],
};

export default config;
