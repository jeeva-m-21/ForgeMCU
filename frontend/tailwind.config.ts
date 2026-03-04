/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vercel: {
          '950': '#000000',
          '900': '#0a0a0a',
          '800': '#111111',
          '700': '#171717',
          '600': '#1a1a1a',
          '500': '#222222',
          '400': '#333333',
          '300': '#444444',
          '200': '#666666',
          '100': '#888888',
          '50':  '#a1a1aa',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e5e7eb',
            maxWidth: 'none',
            a: { color: '#fff', textDecoration: 'underline', '&:hover': { color: '#ccc' } },
            h1: { color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.4em' },
            h2: { color: '#fff' },
            h3: { color: '#fff' },
            h4: { color: '#fff' },
            strong: { color: '#fff' },
            code: { color: '#e5e7eb', backgroundColor: '#171717', padding: '0.15em 0.4em', borderRadius: '4px', fontSize: '0.85em' },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            pre: { backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #222' },
            'pre code': { backgroundColor: 'transparent', padding: '0', color: 'inherit' },
            blockquote: { color: '#888', borderLeftColor: '#333' },
            table: { width: '100%' },
            thead: { color: '#fff', borderBottomColor: '#333' },
            'thead th': { padding: '0.75em' },
            'tbody td': { padding: '0.75em' },
            'tbody tr': { borderBottomColor: '#1a1a1a' },
            hr: { borderColor: '#222' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
