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
      }
    },
  },
  plugins: [],
}
