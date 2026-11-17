import { Pressable, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LANGUAGES } from 'transit-shared/i18n/languages.js';
import Screen from 'transit-shared/native/Screen';
import T from 'transit-shared/native/T';
import { Button, Ticket } from 'transit-shared/native/ui';
import { setLanguage } from 'transit-shared/native/i18n';
import { useTheme, useThemePrefs, setThemeMode, setReduceEffects, neon } from 'transit-shared/native/theme';
import { useAuth } from '../lib/auth';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const prefs = useThemePrefs();
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={theme.ink} />
        <T variant="bodyStrong">{t('passenger.backToMap')}</T>
      </Pressable>
      <T variant="headline">{t('settings.title')}</T>

      <T variant="title" style={{ marginTop: 26, marginBottom: 10 }}>{t('settings.account')}</T>
      <Ticket>
        {user ? (
          <>
            <T variant="bodyStrong">{t('passenger.signedInAs', { name: user.name })}</T>
            <T variant="small" color={theme.inkFaint}>{user.email}</T>
            <Button title={t('common.signOut')} variant="secondary" size="sm" style={{ marginTop: 12 }} onPress={signOut} />
          </>
        ) : (
          <>
            <T variant="body" color={theme.inkSoft}>{t('passenger.signInBody')}</T>
            <Button title={t('passenger.signInTitle')} size="sm" style={{ marginTop: 12 }} onPress={() => router.push('/signin')} />
          </>
        )}
      </Ticket>

      <T variant="title" style={{ marginTop: 26, marginBottom: 10 }}>{t('settings.theme')}</T>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {['light', 'dark', 'system'].map((m) => {
          const active = prefs.mode === m;
          const label = t(`settings.theme${m[0].toUpperCase()}${m.slice(1)}`);
          return (
            <Pressable key={m} onPress={() => setThemeMode(m)} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={label}
              style={{ flex: 1, minHeight: 56, borderRadius: theme.night ? 14 : 8, borderWidth: active ? 2 : 1, alignItems: 'center', justifyContent: 'center', gap: 2,
                borderColor: active ? (theme.night ? neon.cyan : theme.ink) : theme.rule, backgroundColor: theme.night ? 'rgba(255,255,255,.05)' : theme.surface }}>
              <Ionicons name={{ light: 'sunny-outline', dark: 'moon-outline', system: 'phone-portrait-outline' }[m]} size={20} color={theme.ink} />
              <T variant="small" weight={600}>{label}</T>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={() => setReduceEffects(!prefs.reduceEffects)} accessibilityRole="switch" accessibilityState={{ checked: prefs.reduceEffects }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{t('settings.reduceEffects')}</T>
          <T variant="small" color={theme.inkFaint}>{t('settings.reduceEffectsHint')}</T>
        </View>
        <Switch value={prefs.reduceEffects} onValueChange={setReduceEffects} trackColor={{ true: theme.night ? neon.cyan : theme.ink }} />
      </Pressable>

      <T variant="title" style={{ marginTop: 26, marginBottom: 10 }}>{t('common.chooseLanguage')}</T>
      <View style={{ borderWidth: 1, borderColor: theme.rule, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.surface }}>
        {LANGUAGES.map((lang, i) => {
          const active = i18n.language === lang.code;
          return (
            <Pressable key={lang.code} onPress={() => setLanguage(lang.code)} accessibilityRole="radio" accessibilityState={{ checked: active }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderColor: theme.rule, backgroundColor: pressed ? theme.bg : 'transparent' })}>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{lang.native}</T>
                {lang.native !== lang.name && <T variant="small" color={theme.inkFaint}>{lang.name}</T>}
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: active ? 7 : 2, borderColor: active ? (theme.night ? neon.cyan : theme.ink) : theme.rule }} />
            </Pressable>
          );
        })}
      </View>

      <T variant="small" color={theme.inkFaint} style={{ marginTop: 24 }}>{t('passenger.about')}</T>
      <T variant="small" color={theme.inkFaint} style={{ marginTop: 6 }}>{t('settings.version', { version: Constants.expoConfig?.version || '' })}</T>
    </Screen>
  );
}
