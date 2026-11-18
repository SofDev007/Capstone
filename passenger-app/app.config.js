// Passenger app (Android, iOS and web).
// Google Sign-In: set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and for iOS EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) in .env.
const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

module.exports = {
  expo: {
    name: 'City Bus Tracker',
    slug: 'bus-tracker-user',
    version: '2.1.0',
    scheme: 'citybus',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: { supportsTablet: true, bundleIdentifier: 'com.transport.usertracker' },
    android: {
      package: 'com.transport.usertracker',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#16213E' },
      permissions: ['CALL_PHONE', 'VIBRATE']
    },
    web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single', name: 'City Bus Tracker', themeColor: '#16213E' },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-localization',
      ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#16213E' }],
      ['expo-location', {
        locationWhenInUsePermission: 'City Bus Tracker uses your location to find the nearest bus stop and the best bus for your trip.'
      }],
      ['expo-notifications', { color: '#16213E' }],
      ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]] : [])
    ],
    // OTA updates reach builds with the same `version`. Bump `version` after native changes.
    runtimeVersion: { policy: 'appVersion' },
    updates: { url: 'https://u.expo.dev/42311cb6-254a-461d-9566-76b9958a5ba6' },
    owner: 'devansh_korde',
    extra: { eas: { projectId: '42311cb6-254a-461d-9566-76b9958a5ba6' } }
  }
};
