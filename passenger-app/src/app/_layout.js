import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AnekLatin_400Regular, AnekLatin_600SemiBold, AnekLatin_700Bold, AnekLatin_800ExtraBold } from '@expo-google-fonts/anek-latin';
import { AnekDevanagari_400Regular, AnekDevanagari_600SemiBold, AnekDevanagari_700Bold, AnekDevanagari_800ExtraBold } from '@expo-google-fonts/anek-devanagari';
import { AnekGurmukhi_400Regular, AnekGurmukhi_600SemiBold, AnekGurmukhi_700Bold, AnekGurmukhi_800ExtraBold } from '@expo-google-fonts/anek-gurmukhi';
import { initI18n } from 'transit-shared/native/i18n';
import { useTheme, initTheme } from 'transit-shared/native/theme';
import { AuthProvider } from '../lib/auth';
import { LiveProvider } from '../lib/live';

SplashScreen.preventAutoHideAsync().catch(() => {});
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false })
});

export default function RootLayout() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    AnekLatin_400Regular, AnekLatin_600SemiBold, AnekLatin_700Bold, AnekLatin_800ExtraBold,
    AnekDevanagari_400Regular, AnekDevanagari_600SemiBold, AnekDevanagari_700Bold, AnekDevanagari_800ExtraBold,
    AnekGurmukhi_400Regular, AnekGurmukhi_600SemiBold, AnekGurmukhi_700Bold, AnekGurmukhi_800ExtraBold
  });

  useEffect(() => { Promise.all([initI18n(), initTheme('passenger')]).finally(() => setReady(true)); }, []);
  useEffect(() => { if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LiveProvider>
          <StatusBar style={theme.night ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="signin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </LiveProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
