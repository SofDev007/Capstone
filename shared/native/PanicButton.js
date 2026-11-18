// SOS: hold for 2 seconds (a ring fills); releasing early cancels. Prevents pocket presses.
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import T from './T';
import { useTheme } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const HOLD_MS = 2000;

export default function PanicButton({ onTrigger, size = 76, disabled }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const r = size / 2 + 6;
  const box = r * 2 + 8;
  const circumference = 2 * Math.PI * r;

  const start = () => {
    if (disabled) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      setHolding(false);
      progress.setValue(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      onTrigger();
    });
  };
  const cancel = () => {
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={box / 2} cy={box / 2} r={r}
            stroke={theme.signal} strokeWidth={5} fill="none" strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        </Svg>
        <Pressable
          onPressIn={start}
          onPressOut={cancel}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t('panic.label')}
          accessibilityHint={t('panic.holdHint')}
          style={[styles.button, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.signal, shadowColor: theme.signal, opacity: disabled ? 0.5 : 1 }]}
        >
          <T variant="title" weight={800} color={theme.onSignal} style={{ fontSize: size * 0.27, lineHeight: size * 0.32 }}>{t('panic.sos')}</T>
        </Pressable>
      </View>
      <T variant="label" color={holding ? theme.signal : theme.inkFaint} style={{ marginTop: -2, textAlign: 'center' }}>
        {holding ? t('panic.holding') : t('panic.label')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D0202F',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  }
});
