
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)', 'sans-serif'],
        headline: ['var(--font-headline)', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
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
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        '3xl': 'calc(var(--radius) + 16px)',
        '2xl': 'calc(var(--radius) + 8px)',
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'lg': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'xl': '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        '2xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'neon-sky': '0 0 20px hsl(var(--chart-1) / 0.25)',
        'neon-emerald': '0 0 25px hsl(var(--chart-2) / 0.35)',
        'neon-rose': '0 0 20px hsl(var(--chart-4) / 0.3)',
        'neon-slate': '0 0 15px hsl(var(--muted-foreground) / 0.2)',
      },
      transitionTimingFunction: {
        'overshoot': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'fade-in-out': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'slide-in-from-bottom-4': {
          from: {
            transform: 'translateY(16px)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        'peek': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(8px)' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-to-left': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-to-right': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'shake': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(1.25deg)' },
          '75%': { transform: 'rotate(-1.25deg)' },
        },
        'bounce-down': {
          '0%, 100%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
        'pulse-green': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)',
          },
          '70%': {
            boxShadow: '0 0 0 6px rgba(34, 197, 94, 0)',
          },
        },
        'pulse-blue': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)',
          },
          '70%': {
            boxShadow: '0 0 0 6px rgba(59, 130, 246, 0)',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.4s ease-out',
        'accordion-up': 'accordion-up 0.4s ease-out',
        'in': 'fade-in 0.4s ease-out, slide-in-from-bottom-4 0.4s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.6s ease-out',
        'slide-out-to-left': 'slide-out-to-left 0.6s ease-in',
        'slide-in-from-left': 'slide-in-from-left 0.6s ease-out',
        'slide-out-to-right': 'slide-out-to-right 0.6s ease-in',
        'shake': 'shake 1.0s ease-in-out infinite',
        'fade-in-out': 'fade-in-out 2.0s ease-in-out infinite',
        'bounce-down': 'bounce-down 1.5s infinite',
        'pulse-green': 'pulse-green 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-blue': 'pulse-blue 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require("@tailwindcss/typography"), require('tailwind-scrollbar'),],
} satisfies Config;
