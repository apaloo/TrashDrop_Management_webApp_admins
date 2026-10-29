/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
