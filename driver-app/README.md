# Bus Driver app (Expo SDK 58)

What drivers use on the road: sign in or apply to drive, start/end trips, live next-stop ETA,
navigation with automatic re-routing, breakdown reports, SOS, and location-off warnings.

## Run

```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npx expo start                # press "a" for Android
```

Background location, push notifications and the native map webview need a **development build**
(Expo Go can't run them all):

```bash
npx eas-cli@latest build --profile development --platform android
```

For a quick look without a phone: `npx expo start --web` (tracking features are limited on web).

Demo accounts (with `npm run demo` in `../backend`): `demo.driver1@transit.local` … `demo.driver12@transit.local` (Indore), password `Demo@1234`.

## How it works

- `src/app/` — screens (Expo Router): `login`, `register` (4-step application with document photos), `application` (review status), `home` (cockpit), `settings` (language, sign out).
- `src/lib/tracking.js` — background location task, foreground sending, offline queue (points are queued on the phone without signal and sent in order via `/locations/batch`).
- `src/lib/hooks.js` — trip loop, **location-off warnings** (15 s → warning, 2 warnings → depot notified; rules in `../shared/locationWarnings.js`), **re-routing** (off the route for 3 fixes → road directions back to the next stops).
- `src/components/RouteMap.js` — MapLibre map as an Expo DOM component (OpenFreeMap tiles).
- Shared code (`../shared`) is imported as `transit-shared/...` (see `metro.config.js`).
- Night stock: the app follows the phone's dark mode.
