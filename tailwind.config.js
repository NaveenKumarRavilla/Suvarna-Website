/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#071B3D',
        secondary: '#0D5DB8',
        accent: {
          DEFAULT: '#F59E0B',
          dark: '#D97706',
        },
        surface: '#F5F7FA',
        navy: {
          900: '#04122B',
          DEFAULT: '#071B3D',
          700: '#0D2F66',
          800: '#0A2552',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(7, 27, 61, 0.08)',
        'card-hover': '0 12px 32px rgba(7, 27, 61, 0.16)',
      },
      maxWidth: {
        '8xl': '1440px',
      },
    },
  },
  plugins: [],
};
