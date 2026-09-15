/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bakery: {
          coffee: {
            900: '#3b2317',
            800: '#4a2c1c',
            700: '#5c3823',
            600: '#7c4a2d',
            500: '#96603f'
          },
          cream: {
            50: '#fdf6ec',
            100: '#f8ecd8',
            200: '#f0ddbc'
          },
          amber: {
            600: '#c9711f',
            500: '#e08a2e',
            400: '#f0a44b'
          },
          success: '#3f7d4a',
          danger: '#b3402e'
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
