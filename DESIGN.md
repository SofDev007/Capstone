---
name: Ticket Stock
description: The visual system of the bus tracker — Indian bus-ticket paper, one ink, punched stages and rubber stamps, built for sunlight and a moving cab.
colors:
  ink: "#16213E"
  ink-soft: "#3D4866"
  ink-faint: "#5C647C"
  paper: "#EEF0EA"
  counterfoil: "#FBFBF8"
  rule: "#C9CDC4"
  rose-stock: "#F6C9D3"
  rose-ink: "#A3184A"
  mint-stock: "#BFE6CF"
  mint-ink: "#17633F"
  buff-stock: "#F5DE9A"
  buff-ink: "#7A5600"
  sky-stock: "#C3DBF3"
  sky-ink: "#1D4F8F"
  lilac-stock: "#D9CDF2"
  lilac-ink: "#5B3A9E"
  signal: "#D0202F"
  signal-stock: "#FBD5D8"
  night-paper: "#0F1420"
  night-counterfoil: "#1A2132"
  night-ink: "#E9ECF3"
  night-rule: "#2C3548"
typography:
  display:
    fontFamily: "Anek Latin, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.9
    fontVariation: "'wdth' 75"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Anek Latin, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Anek Latin, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Anek Latin, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Anek Latin, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  hole: "999px"
  sm: "4px"
  md: "8px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.counterfoil}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.counterfoil}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.counterfoil}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  ticket:
    backgroundColor: "{colors.counterfoil}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  route-badge:
    backgroundColor: "{colors.mint-stock}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  stamp:
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.counterfoil}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "48px"
  panic-button:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.counterfoil}"
    rounded: "{rounded.hole}"
    size: "64px"
---

# Design System: Ticket Stock

## Overview

**Creative North Star: "Ticket Stock"**

Every Indian bus rider has held one: a small slip of coloured paper from the conductor's rack, printed in a single dark ink, torn along a perforation, punched at the fare stage. This system builds the whole product — admin dashboard, driver app, passenger app — from that object. Information sits on **tickets**: counterfoil-white stock with a body and a tear-off stub. Routes are **coloured stocks** (rose, mint, buff, sky, lilac), the way fare denominations are. A bus's progress along its route is a **stage strip**: one punch hole per stop, punched out as the bus passes. Status arrives as **rubber stamps**.

The layout stays conventional and scannable — this is an operating tool for people at a roadside, in a cab, and at a depot desk. The world lives in precise details (perforations, holes, stamps, serial lines), never in decoration that slows reading. Light surfaces for sunlight and offices; the driver app switches to a night stock after dark, because a white screen in a dark cab is a hazard.

**Key Characteristics:**
- One ink (blue-black) on cool paper; colour comes from ticket stocks, never gradients.
- Tickets with perforated stubs carry the key number (minutes, route) on the stub.
- Stage strips with punch holes show route progress everywhere a route appears.
- Stamps (LIVE, DELAYED, BREAKDOWN, OFF ROUTE) announce state; red is reserved for emergencies.
- Anek in condensed weight for big numbers; normal width for reading; Indic scripts in the matching Anek family.

## Colors

One ink, cool paper, five ticket stocks and one emergency red.

### Primary
- **Conductor's Ink** (#16213E): all primary text, primary buttons, the admin sidebar (the "ticket rack"), map markers for buses. The blue-black of ticket printing and ballpoint.

### Secondary
- **Ticket stocks** — each a pale stock (fill) paired with its own deep ink (text on that stock, markers, route lines):
  - **Rose** (#F6C9D3 / #A3184A), **Mint** (#BFE6CF / #17633F), **Buff** (#F5DE9A / #7A5600), **Sky** (#C3DBF3 / #1D4F8F), **Lilac** (#D9CDF2 / #5B3A9E).
  - Routes get a stock. Mint also means *live / on time*; Buff means *delayed / waiting*; Sky marks *information and walking legs*.

### Tertiary
- **Signal Red** (#D0202F, stock #FBD5D8): panic buttons, emergency incidents, destructive confirmation. Nothing else.

### Neutral
- **Paper** (#EEF0EA): app ground. Cool, slightly green-grey — newsprint, not cream.
- **Counterfoil** (#FBFBF8): ticket and panel surfaces sitting on paper.
- **Rule** (#C9CDC4): hairlines, perforation dots, unpunched hole outlines on light surfaces.
- **Ink Soft** (#3D4866): secondary text. **Ink Faint** (#5C647C): meta text (≥4.5:1 on paper).
- **Night stock** (driver app after dark): Night Paper (#0F1420), Night Counterfoil (#1A2132), Night Ink (#E9ECF3), Night Rule (#2C3548). Stocks keep their pale fill for badges; deep inks are not used on night paper.

### Named Rules
**The One Ink Rule.** Text is Conductor's Ink or its soft/faint steps, or a stock's own deep ink on that stock. No grey text on coloured stock, no coloured text on paper except stock inks for route labels.

**The Red Means Help Rule.** Signal Red appears only for emergencies (panic, emergency incidents, destructive confirmation). A breakdown is buff, a delay is buff, off-route is buff — not red.

## Typography

**Display Font:** Anek Latin, condensed width (wdth 75), weight 800
**Body Font:** Anek Latin, normal width, weights 400–700
**Indic scripts:** Anek Devanagari, Anek Gurmukhi, Anek Bangla, Anek Tamil, Anek Telugu, Anek Kannada, Anek Malayalam, Anek Odia, Anek Gujarati (same family, same voice; system Noto as fallback)

**Mobile note:** the Expo apps bundle static weights (Latin, Devanagari, Gurmukhi at 400/600/700/800); the condensed width axis is web-only, so mobile Display numbers use ExtraBold with tight tracking (−1.5).

**Character:** A single multi-script family from an Indian foundry. Condensed and heavy for the printed numbers of a ticket (route, minutes, serials); open and plain for reading.

### Hierarchy
- **Display** (800, condensed, 44–64px, line-height 0.9, tabular): minutes-to-arrival, route numbers on stubs, the one number a screen exists to show.
- **Headline** (700, 22–28px, 1.15): screen titles, stop names on the arrival view.
- **Title** (600, 17–19px, 1.3): ticket headings, table group titles.
- **Body** (400, 15–16px, 1.55): everything read. Line-height never below 1.5 (Indic matras and descenders).
- **Label** (600, 12px, 0.08em, uppercase Latin only): the **serial line** — the small printed line on a ticket (bus plate, trip serial, column heads in tables). Never uppercase Indic text.

### Named Rules
**The Serial Line Rule.** Tracked uppercase labels exist only as a ticket's serial line or a table column head — never as an eyebrow above every section.

**The Numbers Print Rule.** Minutes, times, distances and counts use tabular figures so live numbers don't jitter.

## Layout

- **Passenger app:** map-first. The map fills the screen; a bottom sheet of tickets slides over it (peek → half → full). Search ("From" / "Where to?") is a ticket pinned at the top.
- **Driver app:** single-column cockpit. The next stop and its ETA dominate the top third; the map below; actions at the thumb zone. Nothing that matters below the fold during a trip.
- **Admin:** fixed ink sidebar (the ticket rack, 248px; collapses to 72px), paper main area with a 24px gutter, max content width 1440px. Tables are waybills: ruled rows, tabular figures, sticky column heads.
- Spacing rhythm: 4 / 8 / 16 / 24 / 40. Tight inside a ticket (8–12), generous between tickets (16) and sections (40). More space above a heading than below it.
- Breakpoints (web): 640, 1024, 1280.

## Elevation & Depth

Paper on paper. Tickets lie flat on the ground with a 1px rule border and a crisp, short shadow (`0 1px 0 rgba(22,33,62,.06), 0 2px 6px -2px rgba(22,33,62,.14)`). A ticket in hand (selected, dragged, the open sheet) lifts: `0 10px 24px -8px rgba(22,33,62,.28)`. No glass, no glow, no blur except the map dimming behind an emergency sheet.

**The Flat Stack Rule.** Depth means "in hand" — only the item being acted on lifts.

## Shapes

- Die-cut corners: 8px on tickets and panels, 4px on badges and stamps, 14px on sheets, full round only for punch holes, the panic button and map markers.
- **Perforation:** a dotted rule (2px dots every 6px) with a semicircular notch (10px radius) cut into both edges where a stub tears off.
- **Punch hole:** 12px circle. Unpunched: 1.5px ring in Rule (light) or the stock ink (on stock). Punched: filled with the surface behind the ticket, as if cut through.

## Components

### Buttons
- **Shape:** die-cut rectangle (8px), minimum 48px tall (56px in the driver app).
- **Primary:** Conductor's Ink fill, counterfoil text, weight 600.
- **Secondary:** counterfoil fill, 1.5px ink border.
- **Danger:** Signal Red fill — only for emergency and destructive actions.
- **Hover / Focus:** hover darkens 6%; focus ring is a 2px ink outline offset 2px (on ink buttons: a 2px stock-mint ring). Press: translateY(1px).

### Tickets (cards)
- **Body + stub.** The stub (right side on wide screens, bottom on narrow) carries the key number in Display type; a perforation separates it from the body.
- **Background:** counterfoil; a route ticket's stub is the route's stock.
- **States:** selected lifts and tears slightly (stub rotates 2°); loading shows ruled placeholder lines, not grey blocks.

### Stage strip (signature)
- A horizontal (or vertical in lists) row of punch holes, one per stop, joined by a 2px line in the route's stock ink.
- Passed stops are punched; the next stop is ringed in ink and labelled; the bus sits between holes.
- When the bus passes a stop, the hole punches: the disc scales out and a small paper chad falls away (420ms). Reduced motion: the hole simply fills.

### Stamps
- Rotated −3°, 2px border in the stamp's ink, uppercase label type, transparent fill with 85% ink opacity.
- LIVE (mint), DELAYED n MIN (buff), BREAKDOWN (buff), OFF ROUTE (buff), EMERGENCY (signal), PENDING / APPROVED / REJECTED (buff / mint / rose).
- Lands with a thump: scale 1.25 → 1, rotate −8° → −3°, 260ms overshoot.

### Route badge
- Route number in Display weight on the route's stock, deep ink text, 4px corners. Never a circle.

### Inputs / Fields
- Counterfoil fill, 1.5px Rule border, 8px corners, 48px tall; label above in Title-small.
- Focus: border becomes ink + 3px mint-stock ring. Error: border Signal Red, message below names the problem and the fix.

### Navigation
- **Admin:** the ticket rack — ink sidebar, items in counterfoil text; active item gets a counterfoil pill and a 4px stock notch on its left edge (the colour of the ticket pad). Badges for open incidents (red) and pending applications (buff).
- **Apps:** bottom-sheet and stack navigation; no tab bar during a trip.

### Panic button
- Signal Red circle, 64px (passenger) / 72px (driver), white "SOS" in Display type.
- **Hold for 2 seconds** to send: a counterfoil ring fills clockwise; releasing early cancels. On send: stamp "SENT" lands and the reason sheet opens. A "Call 112" button is always beside it.

## Do's and Don'ts

### Do:
- **Do** put the one number that matters (minutes, route) on a ticket stub in condensed Display.
- **Do** show freshness on every live number ("updated 12 s ago"); fade a ticket's stamp from LIVE to STALE after 60 s.
- **Do** punch the stage strip as buses move; it is the product's signature.
- **Do** keep body line-height ≥ 1.5 for Indic scripts and test long Tamil/Malayalam strings.
- **Do** use the night stock in the driver app when the system is in dark mode.

### Don't:
- **Don't** use Signal Red for anything that isn't an emergency or destructive action.
- **Don't** use cream or warm paper grounds; the paper is cool newsprint (#EEF0EA).
- **Don't** use gradients, glass, glows, or icon-tile cards.
- **Don't** put tracked uppercase eyebrows above sections; the serial line is the only tracked label.
- **Don't** use grey text on a coloured stock; use that stock's own ink.

(These Don'ts are for Ticket Stock, the light theme. The dark theme is Night Glass, below.)

---

# Night Glass (dark theme)

**Creative North Star: "Control room at night."** A dark map fills the screen. Frosted-glass panels float over it. Routes glow as neon lines, buses are glowing dots that leave short light trails, ETAs ride on the markers, and alerts pull the camera in. Motion explains a change of state and is never there just for decoration.

Live reference: `nightglass design/night-glass-reference.html` (loops 14 s) and the `.mp4` beside it. Values below are copied from it.

## Theme policy

`THEME_DEFAULTS` in `shared/theme/tokens.js` sets the theme for each app:

| App | Default | Override |
|---|---|---|
| Admin panel | `dark` (Night Glass) | none |
| Driver app | `dark` (replaces the old night stock) | none |
| Passenger app | `system` | Settings → Theme: Light / Dark / System |

The light theme stays Ticket Stock, because passengers use the app in direct sunlight. Change a value there (`'dark' | 'light' | 'system'`) to change the policy.

## Principles

1. **Glass over a dark map.** UI floats as glass panels. The map is the ground.
2. **Neon means data.** Route and status colour only. Text stays `text.primary/secondary/muted`.
3. **Red means help.** Alert `#FF4D6D` is used only for SOS, panic and critical flags. Delays are amber; off-route and signal-lost are pink.
4. **Motion explains state.** Things slide in when they arrive, rings fill as distance shrinks, the camera flies to an SOS. Loops are limited to "live" indicators. They stop under reduced motion, and are never in a driver's eye line.
5. **Readable first.** Glass must be tinted enough for WCAG AA (4.5:1 body, 3:1 large) over the busiest map.

## Tokens (`glass`, `neon`, `glassMotion` in tokens.js)

| Token | Value |
|---|---|
| bg.deep / bg.map / bg.raised | `#04060C` / `#0A0F1C` / `#0E1424` |
| glass.fill / fillSolid | `rgba(22,30,52,.55)` / `rgba(22,30,52,.88)` (no-blur fallback) |
| glass.fillMap / fillMapWeb | `rgba(22,30,52,.92)` native panels over the map · `.72` web panels over the map (contrast, see below) |
| glass.border / highlight | `rgba(255,255,255,.13)` / `inset 0 1px 0 rgba(255,255,255,.08)` |
| glass.shadow / blur / saturate | `0 20px 40px -18px rgba(0,0,0,.7)` / 18 px / 150% |
| radius | panel 18 · card 16 · chip 12 · pill 999 |
| text | primary `#EAF0FF` · secondary `#9AA6C7` · muted `#8B97B8` |
| neon | cyan `#3EE6FF` · violet `#8B7CFF` · lime `#B6FF5C` · pink `#FF6BD6` · amber `#FFC857` · alert `#FF4D6D` |
| gradients | accent 135° cyan→violet · progress 90° violet→cyan · ring violet→lime |
| aurora | `#2B3BFF`, `#7A2BFF`, `#0FB5C9`, blur 90 px, opacity .35–.55, 14 s drift |
| motion | easeOut `[0.16,1,0.3,1]` · spring `{damping 14, stiffness 180}` · fast 180 · base 280 · slow 420 · markerGlide 1000 |

**Route colours.** `neonForRoute(route)` maps each route's ticket stock to a neon colour: mint→lime, buff→amber, sky→cyan, rose→pink, lilac→violet. A route therefore keeps the same identity in both themes.

**Status.** live/on time → lime, delayed → amber `#FFC857`, off-route/signal lost → pink, emergency → alert (`statusNeon`).

**Type.** Anek stays the family for all body and UI text, because it covers the Indic scripts. Space Grotesk and JetBrains Mono may be used only for Latin-only numerals, codes and tracked labels (bus numbers, plates, timestamps, KPIs).

## Components

- **Glass panel** (`.glass` on web, `<Glass>` on native): fill, 1 px border, top highlight, shadow, `backdrop-filter: blur(18px) saturate(150%)`. It falls back to `fillSolid` when backdrop-filter is unsupported, on Android below API 31, when "Reduce effects" is on, and over the map webview (see the blur note).
- **Neon route line:** a glow layer (width 8, blur 6, opacity .75), a core layer (3.5, neon) and a white flow layer (dash animation). Flow stops under reduced motion and when the tab is hidden. It is off in the driver app.
- **Bus marker:** a neon dot with a white core and a pulsing ring, plus a 12-point light trail (`line-gradient`, transparent → route colour) and the 1000 ms glide.
- **ETA chip:** a glass pill `12 · 4 min` with a pointer, anchored above the bus. Lower-priority chips are hidden when chips collide.
- **Buttons:** primary has the accent gradient fill with `#04060C` text. Secondary is glass. Danger is alert-red fill and is used only for emergency actions.
- **Route badge:** route number on its neon colour with `#04060C` text, 8 px corners.
- **Status chip:** neon text with a neon hairline on glass, unrotated. It replaces the rubber stamp in the dark theme.
- **Progress ring (driver):** 220 px with a violet→lime stroke. It completes on arrival and an 18-particle burst plays once.
- **Admin dock:** a floating vertical glass icon dock with tooltip labels. The active item has a gradient pill that slides between items (`layoutId`).

## Blur over the map

Both apps draw the map in an Expo DOM component, which is a WebView on phones. On Android, `BlurView` blurs only what is inside a `BlurTargetView`, and a WebView's GPU surface is not captured reliably, so the result is blank or stale. **Panels that float over the map therefore use the solid fallback (`fillSolid`) on native** (`<Glass overMap>`). Real blur is used everywhere else. On web the map is in the same document, so CSS `backdrop-filter` works and was verified there. The native result has not been checked on a physical device yet. If blur over the map turns out to work, remove `overMap` from those panels.

## Contrast (measured)

The worst case is a lime route line (`#B6FF5C`) directly under a panel. At `.55`, an 18 px blur spreads the line to about 25% coverage. At that coverage muted text measures 4.59:1, which only just passes, and without the blur it would fail. Panels over the map therefore get a stronger tint:

- **Web:** `.72` gives muted 4.98:1 after blur (`.over-map .glass`).
- **Native:** `.92` gives muted 4.66:1 even with no blur at all (`<Glass overMap>`).

Sheets and dialogs use the opaque raised surface: primary 16.1:1, secondary 7.6:1, muted 6.3:1. Dark text `#04060C` on every neon colour is ≥ 6.2:1, and 6.3:1 on alert red, which is why SOS labels are dark. White on alert red would be only 3.2:1.

## Do / Don't

- **Do** float every control over the map as glass, and keep text on glass at AA or better.
- **Do** use the neon twin of a route's stock (`neonForRoute`), never an arbitrary colour.
- **Do** make every loop (flow, pulse, aurora, blink) stop under `prefers-reduced-motion` / `useReducedMotion()`.
- **Don't** use alert red for anything that isn't an emergency.
- **Don't** animate decoration on the driver screen. Only the progress ring, arrival confirmation and alerts may move. Tap targets are ≥ 56 px.
- **Don't** put Space Grotesk / JetBrains Mono on translated text.
- **Don't** stack glass on glass more than one level deep, because the contrast gets muddy.
