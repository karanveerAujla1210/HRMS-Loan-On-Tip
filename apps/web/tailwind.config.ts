// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './app/(app)/**/*.{js,ts,jsx,tsx}',
    './app/(auth)/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './features/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand / semantic palette – mirrored from the CSS variables in globals.css
        brand: 'var(--brand)',
        'brand-dark': 'var(--brand-dark)',
        'brand-light': 'var(--brand-light)',
        'brand-contrast': 'var(--brand-contrast)',
        // Material-3-style surface aliases used by the glass-morphism pattern
        primary: 'var(--brand)',
        secondary: 'var(--info)',
        'secondary-dark': 'var(--warning)',
        background: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-light': 'var(--border-light)',
        'border-strong': 'var(--border-strong)',
        'surface-container-lowest': 'var(--surface)',
        text: 'var(--text)',
        'text-strong': 'var(--text-strong)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        purple: 'var(--purple)',
        mint: 'var(--mint)',
        navy: 'var(--navy)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      // Spacing tokens mirroring the CSS custom properties (4 px baseline)
      spacing: {
        0: '0',
        0.5: 'var(--space-1)',   // 4 px
        1: 'var(--space-2)',     // 8 px
        1.5: 'var(--space-3)',    // 12 px
        2: 'var(--space-4)',      // 16 px
        2.5: 'var(--space-5)',    // 20 px
        3: 'var(--space-6)',      // 24 px
        4: 'var(--space-8)',      // 32 px
        5: 'var(--space-10)',     // 40 px
        6: 'var(--space-12)',     // 48 px
        8: 'var(--space-16)',     // 64 px
        10: 'var(--space-20)',    // 80 px
      },
      // Border-radius tokens mirroring the CSS custom properties
      borderRadius: {
        xs: 'var(--radius-xs)',   // 4 px
        sm: 'var(--radius-sm)',   // 6 px
        md: 'var(--radius-md)',   // 8 px
        lg: 'var(--radius-lg)',   // 12 px
        xl: 'var(--radius-xl)',   // 16 px
        '2xl': 'var(--radius-2xl)', // 20 px
        '3xl': 'var(--radius-3xl)', // 24 px
        full: 'var(--radius-full)',  // 9999 px
      },
      // Custom shadow tokens from the design system
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        focus: 'var(--shadow-focus)',
      },
      // Animation helpers for micro-interactions
      transitionDelay: {
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
      },
      transitionDuration: {
        'fast': 'var(--transition-fast)',
        'base': 'var(--transition-base)',
        'slow': 'var(--transition-slow)',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'standard-700': 'cubic-bezier(0.1, 0.8, 0.2, 1)',
        'emphasized': 'cubic-bezier(0.2, 0, 0, 0)',
      },
      keyframes: {
        'spinner': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'progress': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width, 100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'spinner': 'spinner 0.6s linear infinite',
        'progress': 'progress 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};

export default config;

