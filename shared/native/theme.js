import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, stocks, stamps, radius, space, routeStock, glass, neon, neonForStock, THEME_DEFAULTS } from '../theme/tokens.js';

export { stocks, stamps, radius, space, routeStock, colors, glass, neon };

// Ticket Stock: the light theme (sunlight).
const day = {
  night: false,
  bg: colors.paper,
  surface: colors.counterfoil,
  ink: colors.ink,
  inkSoft: colors.inkSoft,
  inkFaint: colors.inkFaint,
  rule: colors.rule,
  primary: colors.ink,
  onPrimary: colors.counterfoil,
  signal: colors.signal,
  onSignal: colors.counterfoil,
  signalStock: colors.signalStock
};

// Night Glass: the dark theme (see DESIGN.md › Night Glass). `night` stays the flag screens check.
const night = {
  night: true,
  bg: glass.bg.deep,
  surface: glass.bg.raised,
  card: 'rgba(255,255,255,.05)', // card inside a glass panel (never glass on glass)
  ink: glass.text.primary,
  inkSoft: glass.text.secondary,
  inkFaint: glass.text.muted,
  rule: glass.border,
  primary: neon.cyan,
  onPrimary: glass.bg.deep,
  signal: neon.alert,
  onSignal: glass.bg.deep, // dark text on alert red: 6.2:1 (white would be 3.2:1)
  signalStock: 'rgba(255,77,109,.16)'
};

// ─── Theme preference: THEME_DEFAULTS per app, Light/Dark/System choice, "Reduce effects" ───
const MODE_KEY = 'themeMode';
const EFFECTS_KEY = 'reduceEffects';
let prefs = { app: 'passenger', mode: THEME_DEFAULTS.passenger, reduceEffects: false };
const subs = new Set();
const update = (patch) => { prefs = { ...prefs, ...patch }; subs.forEach((fn) => fn()); };
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/** Call once at startup with 'passenger' | 'driver'. Applies the app's default at once, then the saved choice. */
export async function initTheme(app) {
  update({ app, mode: THEME_DEFAULTS[app] || 'system' });
  try {
    const [mode, effects] = await Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(EFFECTS_KEY)]);
    update({ ...(mode && { mode }), reduceEffects: effects === '1' });
  } catch {
    // storage unavailable: keep defaults
  }
}

export function setThemeMode(mode) {
  update({ mode });
  AsyncStorage.setItem(MODE_KEY, mode).catch(() => {});
}

export function setReduceEffects(on) {
  update({ reduceEffects: on });
  AsyncStorage.setItem(EFFECTS_KEY, on ? '1' : '0').catch(() => {});
}

export const useThemePrefs = () => useSyncExternalStore(subscribe, () => prefs, () => prefs);

export function useTheme() {
  const { mode } = useThemePrefs();
  const system = useColorScheme();
  return mode === 'dark' || (mode === 'system' && system === 'dark') ? night : day;
}

/** Text/line colour for a stock: its deep ink on paper, its neon twin on Night Glass. */
export const stockInk = (stock, theme) => (theme.night ? neonForStock(stock) : stock.ink);
/** Fill for a stock: pale stock on paper, a 16% neon wash on Night Glass. */
export const stockFill = (stock, theme) => (theme.night ? `${neonForStock(stock)}29` : stock.stock);

export const FONT_FILES = {
  latin: { 400: 'AnekLatin_400Regular', 600: 'AnekLatin_600SemiBold', 700: 'AnekLatin_700Bold', 800: 'AnekLatin_800ExtraBold' },
  devanagari: { 400: 'AnekDevanagari_400Regular', 600: 'AnekDevanagari_600SemiBold', 700: 'AnekDevanagari_700Bold', 800: 'AnekDevanagari_800ExtraBold' },
  gurmukhi: { 400: 'AnekGurmukhi_400Regular', 600: 'AnekGurmukhi_600SemiBold', 700: 'AnekGurmukhi_700Bold', 800: 'AnekGurmukhi_800ExtraBold' }
};
