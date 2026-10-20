import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04060E',
          900: '#070A16',
          800: '#0B1022',
          700: '#111731',
          600: '#19203F',
          500: '#232C52',
        },
        neon: {
          cyan: '#2DE2E6',
          blue: '#4C7DFF',
          violet: '#9B5CFF',
          pink: '#FF5CA8',
          lime: '#A6FF57',
          amber: '#FFC94D',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'system-ui', '-apple-system', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 18px -2px rgb(45 226 230 / 0.55)',
        'glow-violet': '0 0 22px -4px rgb(155 92 255 / 0.6)',
        dock: '0 12px 40px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06) inset',
      },
      backgroundImage: {
        'grid-tech':
          'linear-gradient(to right, rgb(255 255 255 / 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.045) 1px, transparent 1px)',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 14px -3px rgb(45 226 230 / 0.5)' },
          '50%': { boxShadow: '0 0 26px 0px rgb(45 226 230 / 0.85)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'grid-drift': {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '44px 44px' },
        },
        'sheen-x': {
          from: { transform: 'translateX(-120%)' },
          to: { transform: 'translateX(220%)' },
        },
        // 王者满级进度条：背景位置横向扫过，配 300% 尺寸的多段渐变用
        'rank-flow': {
          from: { backgroundPosition: '0% 50%' },
          to: { backgroundPosition: '300% 50%' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'grid-drift': 'grid-drift 12s linear infinite',
        'sheen-x': 'sheen-x 2.6s ease-in-out infinite',
        'rank-flow': 'rank-flow 2.8s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
