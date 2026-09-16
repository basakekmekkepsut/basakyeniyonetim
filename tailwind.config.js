/** @type {import('tailwindcss').Config} */
export default {
  // NOT: Karanlık mod Tailwind'in dark: varyantı yerine CSS custom property
  // devralımıyla uygulanıyor (bkz. index.css :root[data-tema='koyu']) — bu
  // yüzden burada 'class' stratejisine gerek yok, hiçbir yerde dark: öneki
  // kullanılmıyor.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bakery: {
          // Marka rengi — butonlar/başlık çubuğu/overlay'ler için, KASITLI olarak
          // temadan bağımsız (her iki temada da aynı kahverengi tonlar).
          coffee: {
            900: '#3b2317',
            800: '#4a2c1c',
            700: '#5c3823',
            600: '#7c4a2d',
            500: '#96603f'
          },
          // Metin rengi — koyu/açık temaya göre değişir (bkz. index.css :root / .dark).
          ink: {
            900: 'rgb(var(--ink-900) / <alpha-value>)',
            800: 'rgb(var(--ink-800) / <alpha-value>)',
            700: 'rgb(var(--ink-700) / <alpha-value>)',
            600: 'rgb(var(--ink-600) / <alpha-value>)',
            500: 'rgb(var(--ink-500) / <alpha-value>)',
            400: 'rgb(var(--ink-400) / <alpha-value>)',
            300: 'rgb(var(--ink-300) / <alpha-value>)'
          },
          // Sayfa/kart zemin renkleri — koyu/açık temaya göre değişir.
          cream: {
            50: 'rgb(var(--cream-50) / <alpha-value>)',
            100: 'rgb(var(--cream-100) / <alpha-value>)',
            200: 'rgb(var(--cream-200) / <alpha-value>)'
          },
          surface: 'rgb(var(--surface) / <alpha-value>)',
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
