import { stocks, glass, neon, neonForStock, THEME_DEFAULTS } from '../shared/theme/tokens.js';

// The admin panel renders in Night Glass (THEME_DEFAULTS.admin = 'dark'). The class names stay the
// Ticket Stock ones (ink, paper, counterfoil, rule, stocks), so every page restyles from here:
//   ink → text on glass · paper → map ground · counterfoil → raised surface · rule → hairline
//   stock fill → 16% neon wash · stock ink → the neon twin (mint→lime, buff→amber, sky→cyan, rose→pink, lilac→violet)
const dark = THEME_DEFAULTS.admin === 'dark';
const stockColors = Object.fromEntries(
  Object.entries(stocks).flatMap(([name, s]) => [
    [name, dark ? `${neonForStock(s)}29` : s.stock],
    [`${name}-ink`, dark ? neonForStock(s) : s.ink]
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: glass.text.primary, soft: glass.text.secondary, faint: glass.text.muted },
        paper: glass.bg.map,
        counterfoil: glass.bg.raised,
        rule: '#262E44', // glass.border (white 13%) flattened over bg.map, so opacity modifiers work
        signal: { DEFAULT: neon.alert, stock: '#FF4D6D29' },
        deep: glass.bg.deep,
        raised: glass.bg.raised,
        glass: { DEFAULT: glass.fill, solid: glass.fillSolid, border: glass.border },
        neon,
        ...stockColors
      },
      fontFamily: {
        sans: ['"Anek Latin"', 'system-ui', 'sans-serif'],
        // Latin-only numerals, codes and tracked labels (bus numbers, plates, timestamps, KPIs)
        grotesk: ['"Space Grotesk"', '"Anek Latin"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        sm: '8px',
        md: `${glass.radius.chip}px`,
        lg: `${glass.radius.card}px`,
        panel: `${glass.radius.panel}px`,
        card: `${glass.radius.card}px`,
        chip: `${glass.radius.chip}px`
      },
      boxShadow: {
        rest: `${glass.shadow}, ${glass.highlight}`,
        lifted: `0 30px 60px -20px rgba(0,0,0,.85), ${glass.highlight}`,
        glow: '0 0 18px rgba(62,230,255,.5)'
      },
      backgroundImage: {
        accent: glass.gradient.accent,
        progress: glass.gradient.progress
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        stamp: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    }
  },
  plugins: []
};
