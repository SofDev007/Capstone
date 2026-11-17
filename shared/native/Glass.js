// Night Glass primitives for React Native: <Glass> panel, <GlassScreen> (blur target + aurora),
// <Gradient> fill. In the light theme <Glass> is a plain Ticket Stock surface.
//
// Blur strategy (expo-blur, SDK 58):
// - iOS and web: real blur (web uses CSS backdrop-filter).
// - Android 12+ (API 31+): real blur with blurMethod "dimezisBlurViewSdk31Plus", but only for panels
//   inside a <GlassScreen>, which wraps the background in a BlurTargetView.
// - Solid fallback (glass.fillSolid) on Android < 31, when "Reduce effects" is on, and for panels
//   over the map webview (`overMap`): a BlurView can't sample a WebView reliably. See DESIGN.md.
import { createContext, useContext, useId, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView, BlurTargetView } from 'expo-blur';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import { useTheme, useThemePrefs, glass } from './theme';

const TargetContext = createContext(null);

const canBlurHere = (target, overMap, reduceEffects) => {
  if (reduceEffects) return false;
  if (Platform.OS === 'web') return true;
  if (overMap) return false;
  if (Platform.OS === 'ios') return true;
  return Platform.OS === 'android' && Platform.Version >= 31 && Boolean(target);
};

/** Frosted panel. radius: 18 panel · 16 card · 12 chip · 999 pill. `tint` overrides the fill colour. */
export default function Glass({ children, style, radius = glass.radius.panel, overMap = false, tint, ...rest }) {
  const theme = useTheme();
  const { reduceEffects } = useThemePrefs();
  const target = useContext(TargetContext);

  if (!theme.night) {
    return <View style={[{ backgroundColor: theme.surface, borderColor: theme.rule, borderWidth: 1, borderRadius: Math.min(radius, 14) }, style]} {...rest}>{children}</View>;
  }

  const base = [styles.glass, { borderRadius: radius }, style];
  if (!canBlurHere(target, overMap, reduceEffects)) {
    return <View style={[base, { backgroundColor: tint || glass.fillSolid }]} {...rest}>{children}</View>;
  }
  return (
    <BlurView
      intensity={45}
      tint="dark"
      blurTarget={target || undefined}
      blurMethod="dimezisBlurViewSdk31Plus"
      style={[base, { backgroundColor: tint || glass.fill, overflow: 'hidden' }]}
      {...rest}
    >
      {children}
    </BlurView>
  );
}

/** Static aurora: three soft radial blobs (no filter blur, no loop — cheap on low-end phones). */
export function Aurora({ style, opacity = 0.45 }) {
  const id = useId().replace(/:/g, '');
  const blobs = [
    { c: glass.aurora.colors[0], cx: '10%', cy: '18%', r: '55%' },
    { c: glass.aurora.colors[1], cx: '95%', cy: '55%', r: '50%' },
    { c: glass.aurora.colors[2], cx: '40%', cy: '105%', r: '45%' }
  ];
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        {blobs.map((b, i) => (
          <RadialGradient key={i} id={`${id}a${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.c} stopOpacity={opacity} />
            <Stop offset="1" stopColor={b.c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((b, i) => <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${id}a${i})`} />)}
    </Svg>
  );
}

/**
 * Screen root for Night Glass: the background (deep + aurora) is the blur target on Android,
 * everything in `children` floats above it. Light theme: plain paper.
 */
export function GlassScreen({ children, style, aurora = true }) {
  const theme = useTheme();
  const ref = useRef(null);
  if (!theme.night) return <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>{children}</View>;
  const background = aurora ? <Aurora /> : null;
  return (
    <TargetContext.Provider value={Platform.OS === 'android' ? ref : null}>
      <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
        {Platform.OS === 'android'
          ? <BlurTargetView ref={ref} style={StyleSheet.absoluteFill} pointerEvents="none">{background}</BlurTargetView>
          : <View style={StyleSheet.absoluteFill} pointerEvents="none">{background}</View>}
        {children}
      </View>
    </TargetContext.Provider>
  );
}

/** Linear gradient fill behind its parent's content (parent needs overflow: 'hidden' + borderRadius). */
export function Gradient({ colors = ACCENT, angle = 135, style }) {
  const id = useId().replace(/:/g, '');
  const rad = (angle - 90) * (Math.PI / 180);
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
          {colors.map((c, i) => <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export const ACCENT = ['#3EE6FF', '#8B7CFF']; // gradient.accent (135°)
export const PROGRESS = ['#8B7CFF', '#3EE6FF']; // gradient.progress (90°)

const styles = StyleSheet.create({
  glass: {
    borderWidth: 1,
    borderColor: glass.border,
    borderTopColor: 'rgba(255,255,255,.2)', // the inset top highlight
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 20 } },
      web: { boxShadow: `${glass.shadow}, ${glass.highlight}` },
      default: {}
    })
  }
});
