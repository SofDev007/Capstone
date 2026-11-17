// Slide-to-confirm for starting/ending trips: hard to trigger by accident in a moving cab.
import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import T from 'transit-shared/native/T';
import { useTheme, glass } from 'transit-shared/native/theme';
import { Gradient, PROGRESS } from 'transit-shared/native/Glass';

const KNOB = 56;

export default function SlideToConfirm({ label, onConfirm, tone = 'primary', loading }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, width - KNOB - 8);
  const glassy = theme.night && tone !== 'danger'; // Night Glass: glass track, gradient fill behind the knob
  const bg = tone === 'danger' ? theme.signal : glassy ? glass.fillSolid : theme.primary;
  const fg = tone === 'danger' ? theme.onSignal : glassy ? theme.ink : theme.onPrimary;
  const knobBg = glassy ? '#EAF0FF' : fg;
  const knobFg = glassy ? glass.bg.deep : bg;

  const responder = useRef(null);
  responder.current = PanResponder.create({
    onStartShouldSetPanResponder: () => !loading,
    onMoveShouldSetPanResponder: () => !loading,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(max, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx >= max * 0.85) {
        Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: false }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Promise.resolve(onConfirm()).finally(() => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start());
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
      }
    }
  });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: bg }, glassy && styles.glass]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onConfirm()}
    >
      {glassy && (
        <Animated.View style={[styles.fill, { width: Animated.add(x, KNOB + 8) }]} pointerEvents="none">
          <Gradient colors={PROGRESS} angle={90} />
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.labelWrap, { opacity: x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [1, 0.15] }) }]}>
        <T variant="bodyStrong" color={fg} style={{ fontSize: 17 }}>{label}</T>
      </Animated.View>
      <Animated.View {...responder.current.panHandlers} style={[styles.knob, { backgroundColor: knobBg, transform: [{ translateX: x }] }, glassy && { borderRadius: 14 }]}>
        {loading ? <ActivityIndicator color={knobFg} /> : <Ionicons name="chevron-forward" size={28} color={knobFg} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: KNOB + 8, borderRadius: 10, padding: 4, justifyContent: 'center' },
  labelWrap: { alignItems: 'center', justifyContent: 'center', paddingLeft: KNOB },
  knob: { width: KNOB, height: KNOB, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  glass: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.13)', borderTopColor: 'rgba(255,255,255,.2)', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 18, overflow: 'hidden', opacity: 0.55 }
});
