// Ticket Stock primitives for React Native (see DESIGN.md). In the dark theme the same components
// render as Night Glass; props and APIs are identical in both themes.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import T from './T';
import { useTheme, routeStock, stamps, glass, neon } from './theme';
import { neonForRoute, neonForStock } from '../theme/tokens.js';
import { Gradient, ACCENT } from './Glass';

// Night Glass colour for each stamp kind (status mapping in DESIGN.md › Night Glass).
const STAMP_NEON = {
  live: neon.lime, onTime: neon.lime, approved: neon.lime,
  delayed: neon.amber, breakdown: neon.amber, pending: neon.amber,
  offRoute: neon.pink, stale: neon.pink, rejected: neon.pink,
  info: neon.cyan, emergency: neon.alert
};

/** Vertical tear line with semicircle notches cut at both ends. */
export function Perforation({ notchColor }) {
  const theme = useTheme();
  const bg = notchColor || theme.bg;
  if (theme.night) return <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: glass.border }} />;
  return (
    <View style={styles.perf}>
      <View style={[styles.notch, { top: -10, backgroundColor: bg, borderColor: theme.rule }]} />
      <View style={styles.dots}>
        {Array.from({ length: 24 }).map((_, i) => <View key={i} style={[styles.dot, { backgroundColor: theme.rule }]} />)}
      </View>
      <View style={[styles.notch, { bottom: -10, backgroundColor: bg, borderColor: theme.rule }]} />
    </View>
  );
}

/** Ticket: body + perforation + stub (the stub carries the one number that matters). */
export function Ticket({ children, stub, stubStock, style, bodyStyle, onPress, notchColor }) {
  const theme = useTheme();
  const base = theme.night
    ? [styles.ticket, styles.card, { backgroundColor: theme.card, borderColor: glass.border }, style]
    : [styles.ticket, { backgroundColor: theme.surface, borderColor: theme.rule }, style];
  const stubBg = theme.night ? (stubStock ? `${neonForStock(stubStock)}1F` : 'transparent') : stubStock?.stock || theme.bg;
  const content = (
    <>
      <View style={[{ flex: 1, padding: 16 }, bodyStyle]}>{children}</View>
      {stub !== undefined && (
        <>
          <Perforation notchColor={notchColor} />
          <View style={[styles.stub, { backgroundColor: stubBg }, theme.night && { borderTopRightRadius: 15, borderBottomRightRadius: 15 }]}>{stub}</View>
        </>
      )}
    </>
  );
  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, { transform: [{ translateY: pressed ? 1 : 0 }] }]}>
      {content}
    </Pressable>
  );
}

/** Rubber stamp; lands with a thump when it first appears. Night Glass: a neon status chip that fades in. */
export function Stamp({ kind = 'live', children, land = true, style }) {
  const theme = useTheme();
  const s = stamps[kind] || stamps.info;
  const ink = theme.night ? STAMP_NEON[kind] || neon.cyan : s.ink;
  const anim = useRef(new Animated.Value(land ? 0 : 1)).current;
  useEffect(() => {
    if (land) Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start();
  }, [anim, land]);
  if (theme.night) {
    return (
      <Animated.View style={[styles.chip, { borderColor: `${ink}66`, backgroundColor: `${ink}1A`, opacity: anim }, style]}>
        <View style={[styles.chipDot, { backgroundColor: ink }]} />
        <T variant="label" color={ink} serial>{children}</T>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.stamp, {
      borderColor: ink,
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
      transform: [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] }) },
        { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-3deg'] }) }
      ]
    }, style]}>
      <T variant="label" color={ink} serial>{children}</T>
    </Animated.View>
  );
}

export function RouteBadge({ route, size = 'md' }) {
  const theme = useTheme();
  if (!route) return null;
  const s = routeStock(route);
  const big = size === 'lg';
  const bg = theme.night ? neonForRoute(route) : s.stock;
  const fg = theme.night ? glass.bg.deep : s.ink;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, theme.night && { borderRadius: 8 }, big && { minWidth: 56, height: 48, paddingHorizontal: 10 }, big && theme.night && { borderRadius: 12 }]}>
      <T variant={big ? 'displaySm' : 'title'} weight={800} color={fg} style={big ? null : { fontSize: 20, lineHeight: 24 }}>{route.number}</T>
    </View>
  );
}

/** Signature: punch holes per stop; passed stops are punched out and their chad falls away. */
export function StageStrip({ stops, nextIndex = 0, route, labels = true }) {
  const theme = useTheme();
  const s = routeStock(route);
  const ink = theme.night ? neonForRoute(route) : s.ink;
  const prev = useRef(nextIndex);
  const [chad, setChad] = useState(null);
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (nextIndex > prev.current && nextIndex - 1 >= 0) {
      setChad(nextIndex - 1);
      fall.setValue(0);
      Animated.timing(fall, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setChad(null));
    }
    prev.current = nextIndex;
  }, [nextIndex, fall]);

  return (
    <View>
      <View style={styles.strip}>
        {stops.map((stop, i) => {
          const punched = i < nextIndex;
          const next = i === nextIndex;
          return (
            <View key={stop.id || i} style={[styles.stripCell, i === stops.length - 1 && { flex: 0 }]}>
              <View>
                <View style={[styles.hole, {
                  borderColor: next ? theme.ink : punched ? ink : theme.rule,
                  borderWidth: next ? 2.5 : 1.5,
                  backgroundColor: punched ? (theme.night ? ink : theme.bg) : theme.surface
                }]} />
                {chad === i && (
                  <Animated.View style={[styles.hole, styles.chad, { backgroundColor: theme.surface, borderColor: theme.rule,
                    opacity: fall.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
                      { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '120deg'] }) }
                    ] }]} />
                )}
              </View>
              {i < stops.length - 1 && <View style={[styles.stripLine, { backgroundColor: punched ? ink : theme.rule }]} />}
            </View>
          );
        })}
      </View>
      {labels && stops.length > 1 && (
        <View style={styles.stripLabels}>
          <T variant="small" color={theme.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{stops[0].name}</T>
          <T variant="small" color={theme.inkSoft} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>{stops[stops.length - 1].name}</T>
        </View>
      )}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, size = 'lg' }) {
  const theme = useTheme();
  const palette = theme.night ? {
    primary: { bg: 'transparent', fg: glass.bg.deep, border: 'transparent', gradient: true },
    secondary: { bg: 'rgba(255,255,255,.06)', fg: theme.ink, border: glass.border },
    ghost: { bg: 'transparent', fg: theme.ink, border: 'transparent' },
    danger: { bg: theme.signal, fg: theme.onSignal, border: theme.signal }
  }[variant] : {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    secondary: { bg: theme.surface, fg: theme.ink, border: theme.ink },
    ghost: { bg: 'transparent', fg: theme.ink, border: 'transparent' },
    danger: { bg: theme.signal, fg: theme.onSignal, border: theme.signal }
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && { height: 44, paddingHorizontal: 14 },
        theme.night && { borderRadius: size === 'sm' ? 12 : 18, borderWidth: 1, overflow: 'hidden' },
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : 1, transform: [{ translateY: pressed ? 1 : 0 }] },
        style
      ]}
    >
      {palette.gradient && <Gradient colors={ACCENT} />}
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon}
          <T variant="bodyStrong" color={palette.fg} style={size === 'lg' ? { fontSize: 17 } : null}>{title}</T>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, hint, style, inputStyle, ...input }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const idle = theme.night ? glass.border : theme.rule;
  const focus = theme.night ? neon.cyan : theme.ink;
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <T variant="bodyStrong" style={{ marginBottom: 6, fontSize: 15 }}>{label}</T>
      <TextInput
        placeholderTextColor={theme.inkFaint}
        {...input}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={[styles.input, theme.night && { borderRadius: 14, borderWidth: 1 }, {
          backgroundColor: theme.night ? 'rgba(255,255,255,.06)' : theme.surface, color: theme.ink,
          borderColor: error ? theme.signal : focused ? focus : idle
        }, inputStyle]}
      />
      {error ? <T variant="small" color={theme.signal} style={{ marginTop: 4 }}>{error}</T>
        : hint ? <T variant="small" color={theme.inkFaint} style={{ marginTop: 4 }}>{hint}</T> : null}
    </View>
  );
}

/** Full-width notice strip. tone: info | warn | danger | ok */
export function Banner({ tone = 'info', children, action }) {
  const theme = useTheme();
  const s = { info: stamps.info, warn: stamps.delayed, danger: stamps.emergency, ok: stamps.live }[tone];
  if (theme.night) {
    const c = { info: neon.cyan, warn: neon.amber, danger: neon.alert, ok: neon.lime }[tone];
    return (
      <View style={[styles.banner, { backgroundColor: glass.fillSolid, borderColor: `${c}80`, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: c }]}>
        <T variant="small" weight={600} color={theme.ink} style={{ flex: 1 }}>{children}</T>
        {action}
      </View>
    );
  }
  return (
    <View style={[styles.banner, { backgroundColor: s.stock, borderColor: 'transparent' }]}>
      <T variant="small" weight={600} color={s.ink} style={{ flex: 1 }}>{children}</T>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: '#16213E',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  card: { borderRadius: 16, shadowOpacity: 0, elevation: 0 },
  perf: { width: 2, alignSelf: 'stretch', overflow: 'visible' },
  dots: { flex: 1, justifyContent: 'space-between', overflow: 'hidden', paddingVertical: 12 },
  dot: { width: 2, height: 2, borderRadius: 1 },
  notch: { position: 'absolute', left: -9, width: 20, height: 20, borderRadius: 10, borderWidth: 1, zIndex: 2 },
  stub: { minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  stamp: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 1 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  badge: { minWidth: 38, height: 30, paddingHorizontal: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  stripCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stripLine: { flex: 1, height: 2, marginHorizontal: 1 },
  stripLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 12 },
  hole: { width: 13, height: 13, borderRadius: 7 },
  chad: { position: 'absolute', top: 0, left: 0, borderWidth: 1 },
  button: { height: 56, borderRadius: 8, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  input: { height: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, fontSize: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 }
});
