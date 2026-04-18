/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
      colors: {
        cream: '#FAFAF7',
        ink: {
          DEFAULT: '#1A1A1A',
          2: '#3D3D3A',
          muted: '#8A8A85',
        },
        brand: {
          green: '#2D6A4F',
          'green-light': '#95D5B2',
          'green-pale': '#D8F3DC',
        },
        glass: 'rgba(255,255,255,0.72)',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.08)',
        'glass-lg': '0 20px 60px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
