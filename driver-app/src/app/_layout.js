import '../lib/tracking'; // defines the background location task at startup
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AnekLatin_400Regular, AnekLatin_600SemiBold, AnekLatin_700Bold, AnekLatin_800ExtraBold } from '@expo-google-fonts/anek-latin';
import { AnekDevanagari_400Regular, AnekDevanagari_600SemiBold, AnekDevanagari_700Bold, AnekDevanagari_800ExtraBold } from '@expo-google-fonts/anek-devanagari';
import { AnekGurmukhi_400Regular, AnekGurmukhi_600SemiBold, AnekGurmukhi_700Bold, AnekGurmukhi_800ExtraBold } from '@expo-google-fonts/anek-gurmukhi';
import { initI18n } from 'transit-shared/native/i18n';
import { AuthProvider, useAuth } from '../lib/auth';
import { useTheme, initTheme } from 'transit-shared/native/theme';
import { setupNotifications } from '../lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

const HOME_FOR = { driver: 'home', applicant: 'application', signedOut: 'login' };
const PUBLIC = new Set(['login', 'register', 'settings']);

/** Sends people to the right place for their sign-in state. */
function Gate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (status === 'loading') return;
    SplashScreen.hideAsync().catch(() => {});
    const here = segments[0] || 'index';
    const target = HOME_FOR[status];
    const allowed = here === target || (status === 'signedOut' && PUBLIC.has(here)) || (status !== 'signedOut' && here === 'settings');
    if (!allowed) router.replace(`/${target}`);
  }, [status, segments, router]);

  return (
    <>
      <StatusBar style={theme.night ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: 'fade_from_bottom' }} />
    </>
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({
    AnekLatin_400Regular, AnekLatin_600SemiBold, AnekLatin_700Bold, AnekLatin_800ExtraBold,
    AnekDevanagari_400Regular, AnekDevanagari_600SemiBold, AnekDevanagari_700Bold, AnekDevanagari_800ExtraBold,
    AnekGurmukhi_400Regular, AnekGurmukhi_600SemiBold, AnekGurmukhi_700Bold, AnekGurmukhi_800ExtraBold
  });

  useEffect(() => {
    Promise.all([initI18n(), initTheme('driver')]).finally(() => setI18nReady(true));
    setupNotifications();
  }, []);

  if (!fontsLoaded || !i18nReady) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
