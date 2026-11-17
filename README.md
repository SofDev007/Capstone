# City Bus Tracker

Real-time public bus tracking for Indian cities: live bus positions from the drivers' phones,
arrival times for every stop, journey planning (with transfers), and a safety layer — SOS for
drivers and passengers, location-off and off-route flags — that reaches the depot in seconds.

| Folder | What it is | Stack |
|---|---|---|
| `backend/` | API + realtime server | Node 24, Express 5, MongoDB, Socket.IO |
| `admin-panel/` | Depot dashboard (web) | React 18, Vite, Tailwind, MapLibre |
| `driver-app/` | Driver app (Android/iOS) | Expo SDK 58, Expo Router |
| `passenger-app/` | Passenger app (Android/iOS/web) | Expo SDK 58, Expo Router |
| `shared/` | Code used by all of the above | design tokens, i18n packs, geo helpers, native UI kit |

Design system: [DESIGN.md](DESIGN.md) ("Ticket Stock"). Product context: [PRODUCT.md](PRODUCT.md).

## Try it in 2 minutes (no database to install)

```bash
cd backend && npm install && npm run demo      # in-memory DB + demo city + 4 simulated buses
cd admin-panel && npm install && npm run dev   # http://localhost:3000
cd passenger-app && npm install && npx expo start --web
cd driver-app && npm install && npx expo start --web
```

Demo accounts (local only): admin `admin@demo.local` / `Demo@1234`;
drivers `demo.driver1@transit.local` … `demo.driver4@transit.local` / `Demo@1234`.
The demo city is Chandigarh–Mohali–Zirakpur (20 stops, 4 routes with timetables, 2 pending driver applications).

## Run for real

1. **Backend** — copy `backend/.env.example` to `.env`, set `MONGODB_URI` and `JWT_SECRET`, then:
   ```bash
   cd backend && npm install
   node create-admin.js you@example.com "a-strong-password"   # see CREATE_ADMIN.md
   npm run seed        # optional demo data
   npm start
   ```
   Load a real city from GTFS: `node scripts/importGtfs.js <unzipped-gtfs-folder> --prefix=DL-`.
2. **Admin panel** — `VITE_API_URL=https://your-backend/api` in `admin-panel/.env`, then `npm run build` and deploy `dist/`.
3. **Apps** — set `EXPO_PUBLIC_API_URL` in `driver-app/.env` and `passenger-app/.env`. Phones need a development build
   (`npx eas-cli@latest build --profile development`); the passenger web app deploys with `npx expo export --platform web`.

### Optional integrations (all free tiers; everything works without them)

| Variable (backend `.env`) | Adds | Without it |
|---|---|---|
| `ORS_API_KEY` (openrouteservice.org) | Real road paths + driver re-routing | Straight lines between stops |
| `CLOUDINARY_URL` | Private cloud storage for driver documents | Stored on the server disk |
| `GOOGLE_WEB_CLIENT_ID` (+ Android/iOS) | "Continue with Google" for passengers | Button hidden; email sign-in |
| `CORS_ORIGINS` | Allowed web origins in production | Any `localhost` port (dev only) |

Free hosting: Render (backend) + MongoDB Atlas M0 + Vercel (admin, passenger web). Keep the free Render
instance awake with a cron-job.org request to `/api/health` every 10 minutes.

## Features

- **Live tracking** — GPS pings are handled in memory (no DB reads); history is sampled into a
  time-series collection and expires after 14 days. Bus markers glide between positions.
- **Arrival times** per stop, delay against the timetable, **off-route** (> 150 m for 2 min) and
  **signal-lost** (no ping for 60 s) flags.
- **Journey planner** — time-dependent Dijkstra over the stop network: walking, waiting (live bus →
  timetable → estimate), transfers; up to 3 options. Nearest stop + best bus in the passenger app.
- **Safety** — hold-to-send SOS (drivers and passengers, no login needed), reason picked afterwards,
  15-minute live location trail, Call 112; location-off warnings for drivers (15 s → warning, after
  2 warnings the depot is notified); admin Alerts center with sound and desktop notifications.
- **Driver applications** — drivers apply in the app with licence/ID photos; the depot approves or
  rejects with a reason.
- **Route & stop editor** in the admin, with timetable generator and road-path generation.
- **11 languages** — English, Hindi, Punjabi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada,
  Malayalam, Odia (`shared/i18n/locales/*.json`; add a language = one JSON file + one line in
  `shared/i18n/languages.js` and `resources.js`). Non-English packs are machine drafts — have a native speaker review them.
- **Maps** — OpenFreeMap vector tiles (OpenStreetMap data, no key). For a public launch in India,
  consider Ola Maps or Mappls for official boundaries; change `shared/mapConfig.js`.

## Tests

```bash
cd backend && npm test    # unit (geo, Dijkstra, warnings, schedule), e2e with in-memory MongoDB + sockets, migrations, GTFS
```

## Security notes

- No default admin; admins are created with `backend/create-admin.js`..
- Logins are rate-limited; deactivated or unapproved drivers are rejected immediately.
- Panic/incident and application events go only to an authenticated admin socket room.
- Driver documents are never publicly reachable; admins view them through an authenticated endpoint.
