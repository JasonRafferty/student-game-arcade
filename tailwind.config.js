/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        navy: '#0E1B30',
        'navy-panel': '#13243F',
        ink: '#16233B',
        paper: '#FBF9F3',
        gold: '#C2982E',
        'gold-deep': '#A87C20',
        'gold-soft': '#F2E7C6',
        whatsapp: '#1FA855',
        'arcade-screen': '#091426',
        'arcade-blue': '#35D9FF',
        'arcade-pink': '#FF4FA3',
        'arcade-purple': '#8B6CFF',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Figtree"', 'sans-serif'],
        arcade: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
