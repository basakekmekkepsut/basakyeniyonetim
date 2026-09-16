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
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem'
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(59, 35, 23, 0.06), 0 2px 8px -2px rgba(59, 35, 23, 0.08)',
        card: '0 4px 20px -6px rgba(59, 35, 23, 0.12)',
        elevated: '0 16px 40px -12px rgba(59, 35, 23, 0.22)'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'scale(0.95) translateY(4px)' }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } }
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
}
