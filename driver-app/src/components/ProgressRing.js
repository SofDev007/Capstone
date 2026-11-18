// Driver HUD progress ring (220 px): fills violet → lime as the distance to the next stop shrinks.
// On arrival it completes, an 18-particle burst plays once, the centre morphs to "Arrived ✓", then
// the next stop slides in and the ring resets. Nothing loops (driver safety). Reduced motion: fades.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, withSequence, withDelay, useReducedMotion, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import T from 'transit-shared/native/T';
import { formatDistance } from 'transit-shared/geo.js';

const SIZE = 220;
const R = 96;
const C = 2 * Math.PI * R;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PARTICLES = Array.from({ length: 18 }, (_, i) => i);

function Particle({ i, burst }) {
  const a = (i / 18) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const p = burst.value;
    const r = R + p * 60;
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }, { scale: 1 - p }]
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: i % 2 ? '#B6FF5C' : '#3EE6FF' }, style]} />;
}

/** meters: distance to the next stop; total: distance between the previous and the next stop. */
export default function ProgressRing({ meters, total, stopName, stopIndex }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const progress = meters == null || !total ? 0 : Math.max(0, Math.min(1, 1 - meters / total));
  const ring = useSharedValue(progress);
  const burst = useSharedValue(0);
  const arrived = useSharedValue(0); // 0 = distance, 1 = "Arrived ✓"
  const [shown, setShown] = useState({ meters, stopName }); // what the centre shows (held during arrival)
  const lastStop = useRef(stopIndex);
  const arriving = useRef(false);

  // Arrival: the stop index advanced.
  useEffect(() => {
    if (stopIndex == null || lastStop.current == null || stopIndex <= lastStop.current) { lastStop.current = stopIndex; return undefined; }
    lastStop.current = stopIndex;
    arriving.current = true;
    const hold = reduce ? 1200 : 1400;
    ring.value = reduce ? 1 : withTiming(1, { duration: 400, easing: EASE });
    arrived.value = withSequence(withTiming(1, { duration: reduce ? 150 : 300 }), withDelay(hold - 300, withTiming(0, { duration: reduce ? 150 : 300 })));
    if (!reduce) burst.value = withSequence(withTiming(0, { duration: 0 }), withDelay(300, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })), withTiming(0, { duration: 0 }));
    const timer = setTimeout(() => { arriving.current = false; setShown({ meters, stopName }); ring.value = reduce ? progress : withTiming(progress, { duration: 600, easing: EASE }); }, hold);
    return () => clearTimeout(timer);
  }, [stopIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Distance updates (ignored while the arrival plays).
  useEffect(() => {
    if (arriving.current) return;
    setShown({ meters, stopName });
    ring.value = reduce ? progress : withTiming(progress, { duration: 800, easing: EASE });
  }, [meters, stopName, progress, reduce, ring]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - ring.value) }));
  const centre = useAnimatedStyle(() => ({ opacity: 1 - arrived.value, transform: [{ translateY: arrived.value * -8 }] }));
  const ok = useAnimatedStyle(() => ({ opacity: arrived.value, transform: [{ scale: 0.6 + 0.4 * arrived.value }] }));
  const dist = shown.meters == null ? '–' : formatDistance(shown.meters);
  const [num, unit] = dist.split(' ');

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`${dist} ${t('driver.toStop', { stop: shown.stopName || '' })}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#8B7CFF" />
            <Stop offset="1" stopColor="#B6FF5C" />
          </LinearGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={14} />
        {/* soft glow: a wider, faint copy (SVG blur filters are unreliable on Android) */}
        <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#ring)" strokeWidth={24} strokeOpacity={0.18} strokeLinecap="round"
          strokeDasharray={`${C} ${C}`} animatedProps={ringProps} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
        <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#ring)" strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${C} ${C}`} animatedProps={ringProps} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Animated.View style={[{ alignItems: 'center' }, centre]}>
          <T variant="display" style={{ fontSize: 50, lineHeight: 52 }}>{num}<T variant="title" color="#9AA6C7"> {unit}</T></T>
          <T variant="small" color="#9AA6C7" numberOfLines={2} style={{ textAlign: 'center', maxWidth: 150, marginTop: 4 }}>{t('driver.toStop', { stop: shown.stopName || '—' })}</T>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centre, ok]}>
          <T variant="headline" color="#B6FF5C" style={{ fontSize: 30, lineHeight: 36 }}>{t('driver.arrived')}</T>
        </Animated.View>
        <View style={styles.burst}>
          {PARTICLES.map((i) => <Particle key={i} i={i} burst={burst} />)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', left: SIZE / 2, top: SIZE / 2, width: 0, height: 0 },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 }
});
