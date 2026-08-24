import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF4FD',
          100: '#DDEAFC',
          200: '#B8D1F5',
          300: '#84B0EC',
          400: '#5B8FE0',
          500: '#3B6BC8',
          600: '#2453A8',
          700: '#1C3D6E',
          800: '#142D52',
          900: '#0D1E38',
          950: '#070F1E',
          DEFAULT: '#1C3D6E',
        },
        accent: {
          DEFAULT: '#0EA5D8',
          light:   '#7DD3EE',
          dark:    '#0878A4',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle:  '#F5F8FC',
          muted:   '#EDF2F9',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(28 61 110 / 0.08), 0 1px 2px -1px rgb(28 61 110 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(28 61 110 / 0.15)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
