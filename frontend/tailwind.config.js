export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      animation: {
        'pulse-scale': 'pulse-scale 1.8s cubic-bezier(.68,-0.55,.27,1.55) infinite'
      },
      keyframes: {
        'pulse-scale': {
          '0%':   { transform: 'scale(1) rotate(-22deg)' },
          '10%':  { transform: 'scale(1.15) rotate(-22deg)' },
          '20%':  { transform: 'scale(1.01) rotate(-22deg)' },
          '30%':  { transform: 'scale(1.10) rotate(-22deg)' },
          '40%':  { transform: 'scale(1) rotate(-22deg)' },
          '100%': { transform: 'scale(1) rotate(-22deg)' }
        }
      }
    }
  },
  plugins: []
};
