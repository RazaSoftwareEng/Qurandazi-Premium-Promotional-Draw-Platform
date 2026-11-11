/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0A1222',
          900: '#101B31',
          800: '#1D2B45',
          700: '#283955',
          600: '#3A4C6D',
          500: '#56698B',
        },
        gold: {
          100: '#F6EDD5',
          200: '#EEDDAE',
          300: '#E5CC88',
          400: '#DCBD6E',
          500: '#D4AF57',
          600: '#B8933D',
          700: '#8C6E2B',
          800: '#6B5321',
        },
        ivory: { DEFAULT: '#F7F5EF', 100: '#FBFAF6', 200: '#EFEBE0', 300: '#E3DDCC' },
        ink: { DEFAULT: '#263247', soft: '#4A5568', muted: '#6B7385' },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,27,49,0.04), 0 4px 16px rgba(16,27,49,0.06)',
        lift: '0 2px 4px rgba(16,27,49,0.06), 0 12px 32px rgba(16,27,49,0.10)',
        gold: '0 0 0 1px rgba(212,175,87,0.35), 0 8px 24px rgba(212,175,87,0.12)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [],
}
