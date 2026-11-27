/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#12100E',
        spotlight: '#241F1B',
        obsidian: '#1C1917',
        alabaster: '#F7F3EC',
        stone: '#A8A29E',
        saffron: {
          DEFAULT: '#D96B27',
          hover: '#E87A35'
        },
        veg: '#22C55E',
        nonveg: '#EF4444'
      },
      fontFamily: {
        serif: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        saffron: '0 8px 28px -6px rgba(217, 107, 39, 0.45)',
        glass: '0 16px 40px -12px rgba(0, 0, 0, 0.7)'
      }
    }
  },
  plugins: []
};
