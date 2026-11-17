# Product

<!-- impeccable:product-schema 1 -->

> Written during an unattended run (owner asked work to continue without them). Facts marked *(inferred)* come from the repository and the owner's written brief, not from an interview — confirm or correct them.

## Platform

adaptive

One product, three surfaces: a web admin dashboard (desktop), an Android/iOS driver app (Expo), and a passenger app that runs on Android/iOS and the web (Expo + web).

## Users

- **Passengers** — people in Indian cities waiting for or planning a public bus trip, usually outdoors at a roadside stop, phone in one hand, often in strong sunlight. Job: find which bus to take from where they are (or from another place, for someone else), see when it arrives, and get help in an emergency.
- **Bus drivers** — drivers of city/state buses running fixed routes; phone mounted or held in the cab. Job: start/end trips, follow the route stop by stop, report breakdowns or emergencies, and keep location on. Also: prospective drivers applying to join.
- **Transport admins / depot operators** — staff on a desktop at a depot or control room, often for long shifts *(inferred)*. Job: manage buses, drivers, routes and stops; watch the live fleet; review driver applications; respond immediately to panic alerts and system flags.

## Product Purpose

Real-time public bus tracking for Indian cities: live bus positions, arrival times per stop, journey planning from A to B (including transfers), and a safety layer (panic button for drivers and passengers, location-off and off-route flags) that routes every alert to the admin in seconds. Success: passengers stop guessing at the roadside; admins know about every safety problem as it happens.

## Positioning

Unlike map apps that show schedules, this system is fed directly by the drivers' own phones on every trip, so arrival times come from where the bus actually is, and the same channel carries safety alerts from both drivers and passengers to the operator. *(inferred from the codebase)*

## Operating Context

- Demo/pilot city in the seed data: Indore (12 city routes); designed to work anywhere in India.
- Route numbers + named stops (e.g. "Route 1 — Mhow Naka → CAT"); timetables are departure times ("08:15").
- Drivers use Android phones primarily; passengers use cheap-to-mid Android phones and browsers; connectivity is intermittent.
- Languages: English plus Indian languages (Hindi, Punjabi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Odia) — every surface used by passengers/drivers must work in Indic scripts.
- India's emergency number is 112.

## Capabilities and Constraints

- Live tracking, ETAs per stop, delay vs timetable, off-route and signal-lost detection, location-off warnings (15 s rule, admin flag after 2 warnings).
- Journey planner (Dijkstra over the stop network), nearest stop, stop/place search, arrival alerts.
- Panic button for drivers and passengers (hold to send, reason chosen after), admin Alerts center.
- Driver self-registration with document photos; admin "Driver Applications" review (approve/reject with reason).
- Google sign-in for passengers; browsing works without an account.
- Free-tier hosting: one backend instance; map tiles from OpenFreeMap (OpenStreetMap data).
- Undecided: product name (code says "City Bus Tracker"); final map provider for a public launch (official India boundaries → Ola Maps / Mappls).

## Brand Commitments

None confirmed. The existing name "City Bus Tracker" appears in the old passenger app *(inferred, not binding)*.

## Evidence on Hand

- Demo data only (seed script). No real customers, ridership, testimonials, or performance claims exist — never fabricate them.
- Ad banner in the old passenger app used placeholder images (picsum) — not real sponsors.

## Product Principles

1. **Safety first, always reachable.** Emergency actions are never more than one gesture away and never wait for a login.
2. **Glanceable in the real scene.** Sunlight, one hand, a moving cab: the answer (which bus, how many minutes) must read in one look.
3. **Honest live data.** Show how fresh every number is; never present an old position as live.
4. **Works for everyone.** Indic scripts, low-end phones, and patchy networks are the baseline, not edge cases.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast minimum; outdoor readability (strong contrast) for passenger and driver surfaces.
- Minimum 48 dp touch targets on mobile; driver controls larger (used while in a vehicle).
- Respect reduced-motion settings.
- Full support for Indic scripts (line-height and font fallback must not clip Devanagari/Gurmukhi/Tamil etc.).
