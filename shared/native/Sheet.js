// Bottom sheet: a ticket slid up from the bottom of the screen.
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import T from './T';

// Android: apps are edge-to-edge (SDK 58), so the window no longer shrinks for the keyboard and a
// full-screen modal ends up under it (text box and typing hidden). Lift the sheet by the keyboard height.
function useAndroidKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

export default function Sheet({ visible, onClose, title, children, dismissable = true }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAndroidKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissable ? onClose : undefined} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingBottom: keyboard }}>
        <Pressable style={[styles.backdrop, theme.night && { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: (keyboard ? 0 : insets.bottom) + 16 }, theme.night && styles.glass]}>
          <View style={[styles.grip, { backgroundColor: theme.rule }]} />
          {title ? <T variant="headline" style={{ marginBottom: 14 }}>{title}</T> : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(22,33,62,0.45)' },
  sheet: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 20, paddingTop: 10, maxHeight: '88%' },
  // Night Glass: raised solid surface (a Modal can't blur the screen behind it on Android)
  glass: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,.13)', borderTopColor: 'rgba(255,255,255,.2)' },
  grip: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 }
});
