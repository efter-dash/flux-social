/** @type {import('tailwindcss').Config} */

// Every colour resolves to a CSS variable holding space-separated RGB channels,
// so Tailwind opacity modifiers (bg-panel/60) keep working and the whole theme
// can be swapped by redefining the variables in styles/tokens.css.
const c = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Elevation ladder — darker sits lower, lighter rises toward the viewer.
        void: c('--void'),
        base: c('--base'),
        sunken: c('--sunken'),
        panel: c('--panel'),
        raised: c('--raised'),
        overlay: c('--overlay'),

        // Foreground
        ink: c('--ink'),
        'ink-dim': c('--ink-dim'),
        'ink-faint': c('--ink-faint'),

        // Edges
        line: c('--line'),

        // Brand
        primary: c('--primary'),
        'on-primary': c('--on-primary'),
        accent: c('--accent'),
        'on-accent': c('--on-accent'),

        // Semantic
        violet: c('--violet'),
        emerald: c('--emerald'),
        amber: c('--amber'),
        danger: c('--danger'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Hanken Grotesk"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        // name: [size, { lineHeight, letterSpacing, fontWeight }]
        'display-lg': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'body-md': ['1rem', { lineHeight: '1.5rem' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'body-xs': ['0.8125rem', { lineHeight: '1.125rem' }],
        'label-caps': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em', fontWeight: '500' }],
        'label-micro': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.06em', fontWeight: '500' }],
        'data-numeral': ['1.25rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'data-hero': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      spacing: {
        // 4px baseline grid, named to match the design system
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        widget: '1.25rem',
        sidebar: '17.5rem', // fixed 280px navigation rail
        bottomnav: '4.5rem',
      },
      boxShadow: {
        // Ambient occlusion, never a hard drop shadow.
        ambient: '0 24px 40px -10px rgb(0 0 0 / 0.45)',
        float: '0 32px 64px -16px rgb(0 0 0 / 0.55)',
        'glow-primary': '0 0 0 4px rgb(var(--accent) / 0.18)',
      },
      backdropBlur: { panel: '12px', modal: '16px' },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'draw-line': { from: { strokeDashoffset: '1000' }, to: { strokeDashoffset: '0' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'fade-in': 'fade-in 240ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-up': 'slide-up 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'sheet-in': 'sheet-in 340ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'draw-line': 'draw-line 900ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
