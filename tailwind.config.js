/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        p: {
          bg: '#1a1c23',
          'bg-light': '#22242d',
          panel: 'rgba(40, 42, 53, 0.7)',
          'panel-solid': '#282a35',
          border: 'rgba(255, 255, 255, 0.08)',
          'sidebar-bg': 'rgba(61, 70, 48, 0.4)',
          lime: '#AEC911',
          'lime-light': '#C7DF5D',
          red: '#FF5757',
          blue: '#60CAFF',
          yellow: '#F4CD29',
          'gray-dark': '#55575E',
          'gray-light': '#D5D5D7',
          muted: '#8e919e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
      boxShadow: {
        glass: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        glow: '0 0 20px rgba(174, 201, 17, 0.2)',
        'glow-red': '0 0 15px rgba(255, 87, 87, 0.1)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
