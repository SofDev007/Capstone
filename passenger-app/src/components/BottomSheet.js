// Map-first bottom sheet with three snap points (peek / half / full). Drag the grip to move it.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, glass } from 'transit-shared/native/theme';

export const SNAPS = ['peek', 'half', 'full'];

export default function BottomSheet({ snap = 'half', onSnapChange, onScrolled, header, children, scrollRef }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heights = useMemo(() => ({ peek: 168 + insets.bottom, half: Math.round(height * 0.48), full: Math.round(height * 0.9) }), [height, insets.bottom]);
  const y = useRef(new Animated.Value(height - heights[snap])).current;
  const current = useRef(snap);

  const go = (name, velocity = 0) => {
    current.current = name;
    Animated.spring(y, { toValue: height - heights[name], velocity, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }).start();
  };

  useEffect(() => { go(snap); }, [snap, heights]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(null);
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => y.stopAnimation(),
    onPanResponderMove: (_, g) => y.setValue(Math.max(height - heights.full, height - heights[current.current] + g.dy)),
    onPanResponderRelease: (_, g) => {
      const top = height - heights[current.current] + g.dy;
      const projected = top + g.vy * 120;
      const best = SNAPS.reduce((a, b) => (Math.abs(height - heights[b] - projected) < Math.abs(height - heights[a] - projected) ? b : a));
      go(best, g.vy);
      onSnapChange?.(best);
    }
  });

  return (
    <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.rule, height: heights.full, transform: [{ translateY: Animated.subtract(y, height - heights.full) }] },
      // Night Glass: the sheet floats over the map webview, so it uses the solid glass fill (see DESIGN.md › Blur over the map)
      theme.night && styles.glass]}>
      <View {...pan.current.panHandlers} style={styles.handleArea}>
        <View style={[styles.grip, { backgroundColor: theme.night ? 'rgba(255,255,255,.25)' : theme.rule }]} />
        {header}
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled"
        scrollEventThrottle={64} onScroll={onScrolled ? (e) => onScrolled(e.nativeEvent.contentOffset.y > 24) : undefined}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, top: 0,
    borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, borderBottomWidth: 0,
    shadowColor: '#16213E', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12
  },
  glass: {
    // Long text lives here: opaque raised surface so neon glows behind never cut contrast (fillSolid .88 let them through)
    backgroundColor: glass.bg.raised, borderColor: glass.border, borderTopColor: 'rgba(255,255,255,.2)',
    borderTopLeftRadius: 18, borderTopRightRadius: 18, shadowColor: '#000', shadowOpacity: 0.7
  },
  handleArea: { paddingTop: 8, paddingBottom: 6, paddingHorizontal: 16 },
  grip: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 }
});
