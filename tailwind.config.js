/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // 13px is the smallest text (docs/DESIGN_SYSTEM.md); text-xs was 12px
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
      },
      colors: {
        // The greens used for buttons, links and green text become the
        // design system's dark green, so white on them and them on white
        // pass contrast (#16a34a was 3.3:1). Lighter greens are unchanged.
        'green': {
          '600': '#1b6e35',
          '700': '#155a2b',
          '800': '#114a23',
        },
        'primary': '#38b2ac',
        'secondary': '#4fd1c5',
        'accent': '#2c7a7b',
        'danger': '#e53e3e',
        'warning': '#ed8936',
        'success': '#48bb78',
        'info': '#4299e1',
        // docs/DESIGN_SYSTEM.md; the same values as src/theme/brand.js
        'td': {
          'lime': '#b6ee69',
          'orange': '#f98b38',
          'forest': '#1b6e35',
          'forest-dk': '#155a2b',
          'tonal': '#e6f2e9',
          'ink': '#0a0f0a',
          'sage': '#525c52',
          'sage-dark': '#a9b2a9',
          'cream': '#f6f8f4',
          'border': '#dfe4dc',
          'border-strong': '#8a8f9c',
          'error': '#b91c1c',
        },
      }
    },
  },
  plugins: [],
}
