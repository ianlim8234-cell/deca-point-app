/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1d1917', 2: '#3a3330', 3: '#6b625c', 4: '#9a918a' },
        washi: { DEFAULT: '#f5efe4', 2: '#ece3d3', 3: '#e0d4bf' },
        paper: '#fffdf8',
        beni: { DEFAULT: '#b23a2b', dark: '#8f2c20', soft: '#f3dcd6' },
        kin: { DEFAULT: '#a8823f', soft: '#efe2c4' },
        matcha: { DEFAULT: '#5f6f4a', soft: '#e3e8d6' },
        ai: { DEFAULT: '#2f3e55', soft: '#dde3ec' },
      },
      fontFamily: {
        display: ['"Shippori Mincho"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(29,25,23,.04), 0 4px 16px rgba(29,25,23,.06)',
        lift: '0 8px 30px rgba(29,25,23,.12)',
      },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        sheen: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        petal: { '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: 0 }, '10%': { opacity: 1 }, '100%': { transform: 'translateY(110vh) rotate(540deg)', opacity: 0 } },
      },
      animation: {
        rise: 'rise .45s ease-out both',
        pop: 'pop .55s cubic-bezier(.2,.9,.3,1.2) both',
        sheen: 'sheen 3.5s linear infinite',
      },
    },
  },
  plugins: [],
};
