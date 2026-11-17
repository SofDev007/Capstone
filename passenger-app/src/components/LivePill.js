// Live arrival pill: an island-style black pill at the top. While the rider tracks a bus it springs
// open into a live card (route, "Arriving at <stop>", big minutes, gradient progress); it collapses to
// a compact "● 12 · 2 min" pill when the sheet is opened or scrolled. Reduced motion: plain fades.
// iOS Live Activities are out of scope (they need a native widget extension); see DESIGN.md.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, useReducedMotion, interpolate } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import T from 'transit-shared/native/T';
import { RouteBadge } from 'transit-shared/native/ui';
import { Gradient, PROGRESS } from 'transit-shared/native/Glass';
import { neonForRoute } from 'transit-shared/theme/tokens.js';

const SPRING = { damping: 14, stiffness: 180 };
const COMPACT = { w: 190, h: 36 };

export default function LivePill({ route, busNumber, stopName, minutes, progress = 0, compact, onPress }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const full = { w: Math.min(width - 28, 420), h: 88 };
  const open = useSharedValue(0); // 0 = compact, 1 = full card
  const bar = useSharedValue(progress);

  useEffect(() => {
    const to = compact ? 0 : 1;
    open.value = reduce ? withTiming(to, { duration: 0 }) : withSpring(to, SPRING);
  }, [compact, reduce, open]);
  useEffect(() => {
    bar.value = reduce ? progress : withTiming(progress, { duration: 600 });
  }, [progress, reduce, bar]);

  const shell = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [COMPACT.w, full.w]),
    height: interpolate(open.value, [0, 1], [COMPACT.h, full.h]),
    borderRadius: interpolate(open.value, [0, 1], [18, 28])
  }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.6, 1], [0, 1], 'clamp') }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0, 0.4], [1, 0], 'clamp') }));
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, Math.min(100, bar.value * 100))}%` }));
  const color = neonForRoute(route);
  const mins = minutes == null ? '–' : Math.max(0, minutes);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('passenger.arrivingAt', { stop: stopName })} · ${t('common.minutes', { count: mins })}`}
      style={{ alignSelf: 'center' }}>
      <Animated.View style={[styles.island, shell]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.card, cardStyle]} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RouteBadge route={route} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="small" color="#9AA6C7" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{t('passenger.arrivingAt', { stop: stopName })}</T>
              <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>Bus {busNumber}</T>
            </View>
            <T variant="displaySm" color="#FFFFFF" style={{ fontSize: 30, lineHeight: 32 }}>{mins}<T variant="small" color="#9AA6C7"> {t('common.min')}</T></T>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, barStyle]}><Gradient colors={PROGRESS} angle={90} /></Animated.View>
          </View>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, pillStyle]} pointerEvents="none">
          <T variant="bodyStrong" color={color} style={{ fontSize: 14 }}>● {route?.number ?? busNumber}</T>
          <T variant="bodyStrong" color="#FFFFFF" style={{ fontSize: 14 }}>{t('common.minutes', { count: mins })}</T>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  island: { backgroundColor: '#000', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  card: { paddingHorizontal: 16, paddingTop: 12, justifyContent: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  track: { marginTop: 10, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.12)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, overflow: 'hidden' }
});
