import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { GlassScreen } from './Glass';

/** Scrollable page with safe-area padding. */
export default function Screen({ children, scroll = true, padded = true, style, refreshControl }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: padded ? 20 : 0 };
  return (
    <GlassScreen>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.night ? 'transparent' : theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={[pad, style]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>{children}</ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </GlassScreen>
  );
}
