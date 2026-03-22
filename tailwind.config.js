/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#12180F',
          'bg-soft': '#182014',
          surface: '#1B2416',
          'surface-light': '#27321F',
          'surface-strong': '#324029',
          border: '#34402C',
          'border-strong': '#4A5D3D',
          overlay: '#10150EE0',
          'overlay-soft': '#182013C7',
          gold: '#D8B24E',
          'gold-soft': '#E6CB86',
          'gold-muted': '#A88D47',
          text: '#F6F3E8',
          'text-muted': '#C4C9B6',
          'text-dim': '#869078',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'nav': ['13px', { lineHeight: '1', fontWeight: '600' }],
        'product-name': ['15px', { lineHeight: '1.3', fontWeight: '600' }],
        'product-price': ['17px', { lineHeight: '1.2', fontWeight: '700' }],
        'section-heading': ['19px', { lineHeight: '1.2', fontWeight: '700' }],
        'page-heading': ['22px', { lineHeight: '1.2', fontWeight: '800' }],
      },
      boxShadow: {
        'card': '0 6px 18px rgba(8, 12, 7, 0.34)',
        'card-hover': '0 10px 26px rgba(8, 12, 7, 0.44), 0 0 1px rgba(216,178,78,0.12)',
        'elevated': '0 14px 40px rgba(8, 12, 7, 0.52)',
        'glass': '0 10px 34px rgba(8, 12, 7, 0.42)',
        'glow-gold': '0 0 22px rgba(216,178,78,0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'bounce-subtle': 'bounceSubtle 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'marquee': 'marquee 25s linear infinite',
        'confetti': 'confetti 3s ease-out forwards',
        'glow-gold-pulse': 'glowGoldPulse 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'shimmer-sweep': 'shimmerSweep 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSubtle: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(400px) rotate(720deg)', opacity: '0' },
        },
        glowGoldPulse: {
          '0%': { boxShadow: '0 0 0 0 rgba(216,178,78,0.4)' },
          '50%': { boxShadow: '0 0 16px 6px rgba(216,178,78,0.2)' },
          '100%': { boxShadow: '0 0 0 0 rgba(216,178,78,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmerSweep: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
