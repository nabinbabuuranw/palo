/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F2EDE3', card: '#FAF7F0', sunk: '#E9E2D5', line: '#D9CFBE', 'line-2': '#C7BBA6',
        ink: '#1D2925', 'ink-2': '#3F4D47', muted: '#68746E',
        pine: { DEFAULT: '#24493D', deep: '#183229', soft: '#DCE5DD' },
        sindoor: { DEFAULT: '#B5432A', soft: '#F1DDD4' },
        marigold: { DEFAULT: '#B87A12', soft: '#F3E6C8' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        deva: ['Mukta', 'Noto Sans Devanagari', 'Kohinoor Devanagari', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '3px', sm: '2px', md: '5px', lg: '8px' },
      boxShadow: { slip: '0 1px 0 rgba(29,41,37,.06), 0 6px 18px -10px rgba(29,41,37,.25)', lift: '0 10px 30px -18px rgba(29,41,37,.35)' },
      transitionTimingFunction: { out: 'cubic-bezier(.22,.8,.24,1)' },
    },
  },
  plugins: [],
};
