/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'yellow-linoleum': '#e8d96a',
        'dirty-wall': '#c9b87a',
        'roach-brown': '#3d2b1f',
        'neon-green': '#39ff14',
        'blood-red': '#cc0000',
      },
      fontFamily: {
        'korean': ['Noto Sans KR', 'sans-serif'],
        'game': ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
