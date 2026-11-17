// "Ticket Stock" design tokens — single source for admin (Tailwind), driver app and passenger app.
// See DESIGN.md for where and why each token is used.

export const colors = {
  ink: '#16213E',
  inkSoft: '#3D4866',
  inkFaint: '#5C647C',
  paper: '#EEF0EA',
  counterfoil: '#FBFBF8',
  rule: '#C9CDC4',
  signal: '#D0202F',
  signalStock: '#FBD5D8',
  night: {
    paper: '#0F1420',
    counterfoil: '#1A2132',
    ink: '#E9ECF3',
    inkSoft: '#B4BCCD',
    rule: '#2C3548'
  }
};

// Ticket stocks: pale fill + its own deep ink.
export const stocks = {
  rose: { stock: '#F6C9D3', ink: '#A3184A' },
  mint: { stock: '#BFE6CF', ink: '#17633F' },
  buff: { stock: '#F5DE9A', ink: '#7A5600' },
  sky: { stock: '#C3DBF3', ink: '#1D4F8F' },
  lilac: { stock: '#D9CDF2', ink: '#5B3A9E' }
};

// Semantic stamps.
export const stamps = {
  live: stocks.mint,
  onTime: stocks.mint,
  delayed: stocks.buff,
  breakdown: stocks.buff,
  offRoute: stocks.buff,
  stale: { stock: '#E2E4DE', ink: '#5C647C' },
  info: stocks.sky,
  pending: stocks.buff,
  approved: stocks.mint,
  rejected: stocks.rose,
  emergency: { stock: colors.signalStock, ink: colors.signal }
};

export const radius = { sm: 4, md: 8, lg: 14, hole: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

export const type = {
  family: 'Anek Latin',
  display: { size: 56, weight: '800', lineHeight: 0.9 },
  headline: { size: 26, weight: '700', lineHeight: 1.15 },
  title: { size: 18, weight: '600', lineHeight: 1.3 },
  body: { size: 15, weight: '400', lineHeight: 1.55 },
  label: { size: 12, weight: '600', letterSpacing: 0.96 } // 0.08em at 12px
};

export const motion = {
  // Exponential ease-out; default for every state change.
  easeOut: [0.16, 1, 0.3, 1],
  // Stamps land with a small overshoot.
  easeStamp: [0.34, 1.56, 0.64, 1],
  fast: 180,
  base: 280,
  slow: 420,
  markerGlide: 1000 // bus marker interpolation between GPS points
};

export const shadow = {
  rest: '0 1px 0 rgba(22,33,62,.06), 0 2px 6px -2px rgba(22,33,62,.14)',
  lifted: '0 10px 24px -8px rgba(22,33,62,.28)'
};

const STOCK_ORDER = ['mint', 'buff', 'sky', 'rose', 'lilac'];

/** Map any route color (hex from the DB) to the nearest ticket stock, so routes always render as stocks. */
export function stockForColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return stocks.mint;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best = 'mint';
  let bestD = Infinity;
  for (const name of STOCK_ORDER) {
    const [R, G, B] = rgb(stocks[name].ink);
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return stocks[best];
}

/** Stable stock for a route without a color (by route number). */
export function stockForKey(key = '') {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return stocks[STOCK_ORDER[h % STOCK_ORDER.length]];
}

export const routeStock = (route) => (route?.color ? stockForColor(route.color) : stockForKey(route?.number));

// ─── Night Glass (the dark theme of the whole product) ────────────────────────────────────────
// Frosted panels over a dark map, neon routes. See DESIGN.md › Night Glass.

/**
 * Theme policy, one place: 'dark' | 'light' | 'system'. The passenger app lets riders override
 * it in Settings (Light / Dark / System); the admin and driver app always use their default.
 */
export const THEME_DEFAULTS = {
  admin: 'dark',
  driver: 'dark',
  passenger: 'system'
};

export const glass = {
  bg: { deep: '#04060C', map: '#0A0F1C', raised: '#0E1424' },
  fill: 'rgba(22,30,52,.55)',
  fillSolid: 'rgba(22,30,52,.88)', // no-blur fallback (old Android, "Reduce effects")
  // No-blur panels over the neon map: .88 lets a lime route under small muted text drop to 4.15:1;
  // .92 keeps ≥ 4.6:1 in the worst case. Web panels over the map use .72 (blur spreads the line).
  fillMap: 'rgba(22,30,52,.92)',
  fillMapWeb: 'rgba(22,30,52,.72)',
  border: 'rgba(255,255,255,.13)',
  highlight: 'inset 0 1px 0 rgba(255,255,255,.08)',
  shadow: '0 20px 40px -18px rgba(0,0,0,.7)',
  blur: 18,
  saturate: '150%',
  radius: { panel: 18, pill: 999, card: 16, chip: 12 },
  text: { primary: '#EAF0FF', secondary: '#9AA6C7', muted: '#8B97B8' },
  gradient: {
    accent: 'linear-gradient(135deg, #3EE6FF, #8B7CFF)',
    progress: 'linear-gradient(90deg, #8B7CFF, #3EE6FF)',
    ring: ['#8B7CFF', '#B6FF5C']
  },
  aurora: { colors: ['#2B3BFF', '#7A2BFF', '#0FB5C9'], blur: 90, opacity: [0.35, 0.55], drift: 14000 }
};

export const neon = {
  cyan: '#3EE6FF',
  violet: '#8B7CFF',
  lime: '#B6FF5C',
  pink: '#FF6BD6',
  amber: '#FFC857',
  alert: '#FF4D6D' // emergencies only: SOS, panic, critical flags
};

export const glassMotion = {
  ...motion,
  spring: { damping: 14, stiffness: 180 }
};

// Each ticket stock has a neon twin, so a route keeps one stable identity in both themes.
const NEON_FOR_STOCK = { mint: neon.lime, buff: neon.amber, sky: neon.cyan, rose: neon.pink, lilac: neon.violet };
const stockName = (s) => Object.keys(stocks).find((k) => stocks[k] === s) || 'mint';

/** Neon colour of a route (same mapping as routeStock, so colours never change between themes). */
export const neonForRoute = (route) => NEON_FOR_STOCK[stockName(routeStock(route))];
export const neonForStock = (stock) => NEON_FOR_STOCK[stockName(stock)];

/** Live status → neon. */
export const statusNeon = {
  live: neon.lime,
  onTime: neon.lime,
  delayed: neon.amber,
  offRoute: neon.pink,
  signalLost: neon.pink,
  stale: neon.pink,
  emergency: neon.alert
};
