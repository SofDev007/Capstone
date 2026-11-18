// Map-first home: From / Where to → nearest stop + best buses (journey planner), live buses, SOS.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PASSENGER_PANIC_REASONS } from 'transit-shared/incidents.js';
import { haversine, slicePath } from 'transit-shared/geo.js';
import T from 'transit-shared/native/T';
import { Ticket, RouteBadge, Stamp, Banner, Button } from 'transit-shared/native/ui';
import PanicButton from 'transit-shared/native/PanicButton';
import PanicSheet from 'transit-shared/native/PanicSheet';
import { useTheme, routeStock, stocks, stockInk } from 'transit-shared/native/theme';
import { neonForRoute, neon } from 'transit-shared/theme/tokens.js';
import Glass from 'transit-shared/native/Glass';
import { useReducedMotion } from 'react-native-reanimated';
import PassengerMap from '../components/PassengerMap';
import BottomSheet from '../components/BottomSheet';
import LivePill from '../components/LivePill';
import { JourneyTicket, JourneyCarousel, LegList, Row } from '../components/Journey';
import { useLive } from '../lib/live';
import { useAuth } from '../lib/auth';
import { usePosition } from '../lib/position';
import { useTrip, tripStore } from '../lib/tripStore';
import { api, errorText } from '../lib/api';
import { getDeviceId } from '../lib/device';

const TRAIL_MS = 15 * 60 * 1000;
const ageSec = (d) => (d ? Math.round((Date.now() - new Date(d).getTime()) / 1000) : Infinity);

function SearchTicket({ fromLabel, toLabel, hasTo, onFrom, onTo, onSwap, onClear }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Glass overMap radius={18} style={[styles.searchTicket, !theme.night && { borderRadius: 10 }]}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onFrom} style={styles.searchRow} accessibilityRole="button" accessibilityLabel={`${t('passenger.from')}: ${fromLabel}`}>
          <View style={[styles.dot, { backgroundColor: theme.night ? neon.cyan : '#1D4F8F' }]} />
          <View style={{ flex: 1 }}>
            <T variant="label" color={theme.inkFaint}>{t('passenger.from')}</T>
            <T variant="bodyStrong" numberOfLines={1}>{fromLabel}</T>
          </View>
        </Pressable>
        <View style={{ height: 0, borderTopWidth: theme.night ? 1 : 1.5, borderStyle: theme.night ? 'solid' : 'dashed', borderColor: theme.rule, marginLeft: 26 }} />
        <Pressable onPress={onTo} style={styles.searchRow} accessibilityRole="button" accessibilityLabel={t('passenger.to')}>
          <View style={[styles.dot, { backgroundColor: theme.night ? neon.pink : '#A3184A', borderRadius: 2 }]} />
          <View style={{ flex: 1 }}>
            {hasTo ? <T variant="label" color={theme.inkFaint}>{t('passenger.chooseTo')}</T> : null}
            <T variant={hasTo ? 'bodyStrong' : 'title'} color={hasTo ? theme.ink : theme.inkSoft} numberOfLines={1}>{hasTo ? toLabel : t('passenger.to')}</T>
          </View>
        </Pressable>
      </View>
      <View style={{ justifyContent: 'center', gap: 6, paddingLeft: 6 }}>
        <Pressable onPress={onSwap} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('passenger.swap')}>
          <Ionicons name="swap-vertical" size={22} color={theme.ink} />
        </Pressable>
        {hasTo && (
          <Pressable onPress={onClear} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={22} color={theme.ink} />
          </Pressable>
        )}
      </View>
    </Glass>
  );
}

/** Round floating button (glass in Night Glass). */
function Fab({ icon, label, onPress, active }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={active != null ? { selected: active } : undefined} hitSlop={4}>
      <Glass overMap radius={24} style={styles.fab}>
        <Ionicons name={icon} size={21} color={active ? (theme.night ? neon.cyan : theme.ink) : theme.ink} />
      </Glass>
    </Pressable>
  );
}

function Arrival({ bus, route, minutes, onPress }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Row onPress={onPress}>
      <RouteBadge route={route} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">Bus {bus.busNumber}</T>
        {bus.nextStop && <T variant="small" color={theme.inkFaint} numberOfLines={1}>→ {bus.nextStop.name}</T>}
      </View>
      {minutes != null && (
        <T variant="displaySm" style={{ fontSize: 26, lineHeight: 28 }}>{minutes <= 0 ? '0' : minutes}<T variant="small" weight={600}> {t('common.min')}</T></T>
      )}
    </Row>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { buses: liveMap, routes, getRoute, alert, clearAlert } = useLive();
  const { user } = useAuth();
  const { position, status: locStatus } = usePosition();
  const trip = useTrip();
  const [snap, setSnap] = useState('half');
  const [nearest, setNearest] = useState([]);
  const [journey, setJourney] = useState({ loading: false, options: null, error: '' });
  const [selected, setSelected] = useState(null); // option index
  const [busId, setBusId] = useState(null);
  const [legPaths, setLegPaths] = useState([]);
  const [notice, setNotice] = useState('');
  const [panic, setPanic] = useState({ incident: null, error: false, at: 0 });
  const [busRoute, setBusRoute] = useState(null);
  const reduceMotion = useReducedMotion();
  const [locateKey, setLocateKey] = useState(0);
  const [showAll, setShowAll] = useState(true); // layers FAB: all live buses vs only the ones for this trip/stop
  const [sheetScrolled, setSheetScrolled] = useState(false);
  const [topH, setTopH] = useState(0);
  const lineColor = (route) => (theme.night ? neonForRoute(route) : routeStock(route).ink);
  const pillStart = useRef({}); // minutes when tracking started, for the progress bar

  const buses = useMemo(() => Object.values(liveMap).filter((b) => b.location), [liveMap]);
  const routeColor = useMemo(() => Object.fromEntries(routes.map((r) => [r._id, r.color])), [routes]);
  const busRouteObj = (b) => ({ number: b.routeNumber, color: routeColor[b.routeId] });

  const from = trip.from || (position && { ...position, name: t('passenger.currentLocation'), current: true });
  const fromKey = from ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}` : '';
  const toKey = trip.to ? `${trip.to.lat.toFixed(5)},${trip.to.lng.toFixed(5)}` : '';

  // Nearest stops to the starting point.
  useEffect(() => {
    if (!from) return;
    api.get(`/public/stops/nearest?lat=${from.lat}&lng=${from.lng}&limit=3`, { token: null }).then(setNearest).catch(() => setNearest([]));
  }, [fromKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Journey planning when both ends are known.
  useEffect(() => {
    setSelected(null);
    if (!from || !trip.to) { setJourney({ loading: false, options: null, error: '' }); return; }
    setJourney({ loading: true, options: null, error: '' });
    setSnap('half');
    api.get(`/public/journey?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${trip.to.lat}&toLng=${trip.to.lng}`, { token: null })
      .then((r) => setJourney({ loading: false, options: r.options, nearestStop: r.nearestStop, error: '' }))
      .catch((e) => setJourney({ loading: false, options: [], error: errorText(e, t) }));
  }, [fromKey, toKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const option = selected != null ? journey.options?.[selected] : journey.options?.[0];

  // Road geometry for the option's ride legs.
  useEffect(() => {
    let alive = true;
    if (!option) { setLegPaths([]); return undefined; }
    Promise.all(option.legs.map(async (leg) => {
      if (leg.type === 'walk') return { coordinates: [[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]], color: theme.night ? neon.cyan : '#1D4F8F', dashed: true };
      const route = await getRoute(leg.route.id).catch(() => null);
      const coords = route?.path?.length > 1 ? slicePath(route.path, leg.from, leg.to) : [[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]];
      return { coordinates: coords, color: lineColor(leg.route), width: 6 };
    })).then((paths) => alive && setLegPaths(paths));
    return () => { alive = false; };
  }, [option, getRoute, theme.night]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected bus: its route for the stops-ahead list.
  const bus = busId ? liveMap[busId] : null;
  useEffect(() => {
    if (!bus?.routeId) { setBusRoute(null); return; }
    getRoute(bus.routeId).then(setBusRoute).catch(() => setBusRoute(null));
  }, [bus?.routeId, getRoute]);

  // Route geometry of every live bus, so the map can keep each bus on its own route line.
  const [busPaths, setBusPaths] = useState({});
  const busRouteIds = [...new Set(buses.map((b) => b.routeId).filter(Boolean))].sort().join(',');
  useEffect(() => {
    let alive = true;
    busRouteIds.split(',').filter(Boolean).forEach((id) => {
      getRoute(id).then((r) => alive && r?.path?.length > 1 && setBusPaths((p) => (p[id] ? p : { ...p, [id]: r.path }))).catch(() => {});
    });
    return () => { alive = false; };
  }, [busRouteIds, getRoute]);

  // ---------- Map data ----------
  const optionRoutes = new Set(option?.legs.filter((l) => l.type === 'ride').map((l) => l.route.id));
  // ETA chips: buses relevant to the selected journey (their boarding stop) or to the nearest stop.
  const chipStopId = option?.legs.find((l) => l.type === 'ride')?.from.id || nearest[0]?.id;
  const mapBuses = buses.map((b) => {
    const eta = chipStopId ? b.etas?.find((e) => e.stopId === chipStopId) : null;
    const relevant = option ? optionRoutes.has(b.routeId) : Boolean(eta);
    return {
      id: b.busId, lat: b.location.lat, lng: b.location.lng, label: b.busNumber, relevant, path: busPaths[b.routeId],
      stock: routeStock(busRouteObj(b)).stock, color: neonForRoute(busRouteObj(b)), selected: b.busId === busId,
      dim: (option && !optionRoutes.has(b.routeId)) || ageSec(b.lastUpdate) > 120,
      chip: eta && relevant ? { route: b.routeNumber ?? b.busNumber, text: t('common.minutes', { count: Math.max(0, eta.minutes) }), priority: eta.minutes } : null
    };
  }).filter((b) => showAll || b.relevant || b.selected);
  const stopInk = theme.night ? '#EAF0FF' : '#16213E';
  const mapStops = option
    ? option.legs.filter((l) => l.type === 'ride').flatMap((l) => [l.from, l.to]).map((s) => ({ ...s, color: stopInk, big: true }))
    : nearest.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, color: stopInk, big: i === 0 }));
  const busLines = busRoute?.path?.length > 1 ? [{ coordinates: busRoute.path, color: lineColor(busRoute), width: 5 }] : [];
  // Refit when the plan changes (and once buses first appear, if we know nothing else yet).
  const fitKey = `${fromKey}|${toKey}|${selected}|${busId}|${nearest[0]?.id || ''}|${legPaths.length}|${!from && buses.length > 0}`;

  // Keep the fitted area between the search ticket and the sheet; never let padding exceed the map.
  const sheetH = snap === 'peek' ? 168 : Math.round(screenH * 0.48);
  const topPad = insets.top + 150;
  const room = screenH - topPad - sheetH;
  const mapPadding = room > 120 ? { top: topPad, bottom: sheetH + 20, left: 40, right: 40 } : { top: 40, bottom: 40, left: 30, right: 30 };
  // Floating controls need ~210 px between the top controls and the sheet.
  // Matches BottomSheet's geometry: its top edge sits at heights.full - heights[snap].
  const sheetTop = Math.round(screenH * 0.9) - (snap === 'peek' ? 168 + insets.bottom : snap === 'half' ? Math.round(screenH * 0.48) : Math.round(screenH * 0.9));
  const fabRoom = snap !== 'full' && sheetTop - Math.max(topH, insets.top + 120) > 210;

  // ---------- Panic ----------
  const nearbyBuses = position ? buses.filter((b) => haversine(position, b.location) < 300).sort((a, b) => haversine(position, a.location) - haversine(position, b.location)) : [];
  const sendPanic = async () => {
    const deviceId = await getDeviceId();
    const where = position || from;
    try {
      const incident = await api.post('/incidents/panic', {
        location: where ? { lat: where.lat, lng: where.lng } : { lat: 0, lng: 0 },
        deviceId,
        ...(nearbyBuses[0] && haversine(position, nearbyBuses[0].location) < 100 && { busId: nearbyBuses[0].busId })
      });
      setPanic({ incident, error: false, at: Date.now() });
    } catch {
      setPanic({ incident: null, error: true, at: 0 });
    }
  };
  // Share live location for 15 minutes while the alert is open.
  const posRef = useRef(position);
  posRef.current = position;
  useEffect(() => {
    if (!panic.incident) return undefined;
    const timer = setInterval(async () => {
      if (Date.now() - panic.at > TRAIL_MS || !posRef.current) return;
      api.patch(`/incidents/${panic.incident.id}/details`, { deviceId: await getDeviceId(), location: posRef.current }).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [panic.incident, panic.at]);

  const notifyMe = async (leg) => {
    if (!user) { router.push('/signin'); setNotice(t('passenger.notifyNeedsSignIn')); return; }
    try {
      await api.post('/passenger/arrival-alerts', { routeId: leg.route.id, stopId: leg.from.id, stopsBefore: 2 });
      setNotice(t('passenger.notifySet'));
    } catch (e) {
      setNotice(errorText(e, t));
    }
  };

  // ---------- Live arrival pill (while tracking a bus) ----------
  useEffect(() => { setSheetScrolled(false); }, [busId]);
  let pill = null;
  if (bus) {
    const atMine = nearest[0] && bus.etas?.find((e) => e.stopId === nearest[0].id);
    const stopName = atMine ? nearest[0].name : bus.nextStop?.name;
    const minutes = atMine ? atMine.minutes : bus.nextStop?.etaMinutes;
    if (stopName) {
      const key = `${bus.busId}|${stopName}`;
      if (minutes != null && !pillStart.current[key]) pillStart.current[key] = Math.max(1, minutes);
      pill = { route: busRouteObj(bus), busNumber: bus.busNumber, stopName, minutes, progress: minutes == null ? 0 : Math.max(0, 1 - minutes / pillStart.current[key]) };
    }
  }

  // ---------- Sheet content ----------
  const nearestStop = nearest[0];
  const arrivalsAt = (stopId) => buses
    .map((b) => ({ bus: b, eta: b.etas?.find((e) => e.stopId === stopId) }))
    .filter((x) => x.eta)
    .sort((a, b) => a.eta.minutes - b.eta.minutes);

  let header = null;
  let body = null;

  if (bus) {
    const etas = new Map((bus.etas || []).map((e) => [e.stopId, e.minutes]));
    const ahead = busRoute?.stops?.filter((s) => etas.has(s.id)) || [];
    header = (
      <View style={styles.sheetHead}>
        <RouteBadge route={busRouteObj(bus)} size="lg" />
        <View style={{ flex: 1 }}>
          <T variant="headline">Bus {bus.busNumber}</T>
          <T variant="small" color={theme.inkFaint}>{t('passenger.updated', { time: ageSec(bus.lastUpdate) < 10 ? t('common.justNow') : t('common.secondsAgo', { count: ageSec(bus.lastUpdate) }) })}</T>
        </View>
        <Pressable onPress={() => setBusId(null)} hitSlop={10} accessibilityLabel={t('common.close')}><Ionicons name="close" size={26} color={theme.ink} /></Pressable>
      </View>
    );
    body = (
      <>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {ageSec(bus.lastUpdate) > 60 ? <Stamp kind="stale">{t('common.stale')}</Stamp> : <Stamp kind="live">{t('common.live')}</Stamp>}
          {bus.delayMinutes > 5 && <Stamp kind="delayed">{t('common.delayed', { count: bus.delayMinutes })}</Stamp>}
          {bus.offRoute && <Stamp kind="offRoute">{t('common.offRoute')}</Stamp>}
        </View>
        <T variant="title" style={{ marginBottom: 4 }}>{t('passenger.stopsAhead')}</T>
        {ahead.map((s, i) => (
          <Row key={s.id}>
            <View style={[styles.holeSm, { borderColor: i === 0 ? theme.ink : theme.rule, borderWidth: i === 0 ? 3 : 2 }]} />
            <T variant={i === 0 ? 'bodyStrong' : 'body'} style={{ flex: 1 }} numberOfLines={1}>{s.name}</T>
            <T variant="bodyStrong">{t('common.minutes', { count: etas.get(s.id) })}</T>
          </Row>
        ))}
      </>
    );
  } else if (trip.to) {
    if (selected != null && option) {
      const firstRide = option.legs.find((l) => l.type === 'ride');
      header = (
        <Pressable onPress={() => setSelected(null)} style={styles.sheetHead} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
          <T variant="title" style={{ flex: 1 }}>{t('passenger.options')}</T>
          <T variant="displaySm" style={{ fontSize: 28, lineHeight: 30 }}>{option.totalMinutes}<T variant="small" weight={600}> {t('common.min')}</T></T>
        </Pressable>
      );
      body = (
        <>
          <LegList option={option} />
          {firstRide && <Button title={t('passenger.notifyMe')} variant="secondary" onPress={() => notifyMe(firstRide)} icon={<Ionicons name="notifications-outline" size={19} color={theme.ink} />} />}
        </>
      );
    } else {
      header = (
        <View style={styles.sheetHead}>
          <T variant="headline" style={{ flex: 1 }}>{t('passenger.options')}</T>
          {journey.loading && <ActivityIndicator color={theme.ink} />}
        </View>
      );
      body = (
        <View style={{ gap: 12 }}>
          {journey.error ? <Banner tone="danger">{journey.error}</Banner> : null}
          {journey.options?.length === 0 && !journey.error && <Banner tone="info">{t('passenger.noRoute')}</Banner>}
          {theme.night && journey.options?.length > 0
            ? <JourneyCarousel options={journey.options} destination={trip.to.name} onSelect={(i) => { setSelected(i); setSnap('half'); }} />
            : journey.options?.map((o, i) => <JourneyTicket key={i} option={o} best={i === 0} onPress={() => { setSelected(i); setSnap('half'); }} />)}
        </View>
      );
    }
  } else {
    header = (
      <View style={styles.sheetHead}>
        <T variant="headline" style={{ flex: 1 }}>{t('passenger.nearYou')}</T>
      </View>
    );
    body = (
      <View style={{ gap: 14 }}>
        {locStatus === 'denied' && !trip.from && <Banner tone="info">{t('passenger.locationDenied')}</Banner>}
        {nearestStop && (
          <Ticket
            stubStock={stocks.sky}
            notchColor={theme.surface}
            stub={<View style={{ alignItems: 'center' }}><Ionicons name="walk" size={22} color={stockInk(stocks.sky, theme)} /><T variant="bodyStrong" color={stockInk(stocks.sky, theme)}>{t('common.minutes', { count: Math.max(1, nearestStop.walkMinutes) })}</T></View>}
          >
            <T variant="label" color={theme.inkFaint}>{t('passenger.nearestStop')}</T>
            <T variant="title" style={{ marginTop: 2 }}>{nearestStop.name}</T>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {nearestStop.routes.map((r) => <RouteBadge key={r.id} route={r} />)}
            </View>
          </Ticket>
        )}
        {nearestStop && (() => {
          const arrivals = arrivalsAt(nearestStop.id);
          return arrivals.length
            ? <View>{arrivals.slice(0, 4).map(({ bus: b, eta }) => <Arrival key={b.busId} bus={b} route={busRouteObj(b)} minutes={eta.minutes} onPress={() => setBusId(b.busId)} />)}</View>
            : <T variant="small" color={theme.inkFaint}>{t('passenger.noArrivals')}</T>;
        })()}
        <T variant="title" style={{ marginTop: 6 }}>{t('passenger.liveBuses')}</T>
        {buses.length === 0 ? <T variant="small" color={theme.inkFaint}>{t('passenger.noBusesLive')}</T> : (
          <View>
            {buses.map((b) => <Arrival key={b.busId} bus={b} route={busRouteObj(b)} minutes={b.nextStop?.etaMinutes} onPress={() => { setBusId(b.busId); setSnap('half'); }} />)}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={StyleSheet.absoluteFill}>
        <PassengerMap
          buses={mapBuses}
          lines={busId ? busLines : legPaths}
          stops={busId ? [] : mapStops}
          me={position}
          from={trip.from}
          to={trip.to}
          fitKey={fitKey}
          locateKey={locateKey}
          padding={mapPadding}
          night={theme.night}
          reduceMotion={reduceMotion}
          onBusPress={async (id) => { setBusId(id); setSnap('half'); }}
          dom={{ style: { flex: 1 } }}
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none" onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
        {pill && (
          <View style={{ marginBottom: 10 }}>
            <LivePill {...pill} compact={snap === 'full' || sheetScrolled} onPress={() => { setSnap('half'); setSheetScrolled(false); }} />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <SearchTicket
              fromLabel={from?.name || t('passenger.chooseFrom')}
              toLabel={trip.to?.name}
              hasTo={Boolean(trip.to)}
              onFrom={() => router.push({ pathname: '/search', params: { field: 'from' } })}
              onTo={() => router.push({ pathname: '/search', params: { field: 'to' } })}
              onSwap={() => (trip.to ? tripStore.set({ from: trip.to, to: trip.from || (position && { ...position, name: t('passenger.currentLocation') }) }) : null)}
              onClear={() => { tripStore.set({ to: null }); setBusId(null); }}
            />
          </View>
          <Pressable onPress={() => router.push('/settings')} accessibilityLabel={t('common.settings')}>
            <Glass overMap radius={24} style={styles.roundBtn}>
              <Ionicons name={user ? 'person' : 'person-outline'} size={22} color={theme.ink} />
            </Glass>
          </Pressable>
        </View>
        {alert && (
          <Pressable onPress={clearAlert} style={{ marginTop: 10 }}><Banner tone="ok">{alert.text}</Banner></Pressable>
        )}
        {notice ? <Pressable onPress={() => setNotice('')} style={{ marginTop: 10 }}><Banner tone="info">{notice}</Banner></Pressable> : null}
      </View>

      <BottomSheet snap={snap} onSnapChange={setSnap} onScrolled={setSheetScrolled} header={header}>{body}</BottomSheet>

      {/* Floating controls: locate, layers, SOS (rendered after the sheet so SOS is always reachable) */}
      {/* The stack sits on the sheet's top edge; with the sheet full (or no room), only SOS stays, bottom-right. */}
      <View style={[styles.fabs, fabRoom ? { bottom: screenH - sheetTop + 8 } : { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
        {fabRoom && position && <Fab icon="locate" label={t('passenger.locateMe')} onPress={() => setLocateKey((k) => k + 1)} />}
        {fabRoom && <Fab icon="layers-outline" label={showAll ? t('passenger.showTripBuses') : t('passenger.showAllBuses')} active={!showAll} onPress={() => setShowAll((s) => !s)} />}
        <PanicButton onTrigger={sendPanic} size={52} />
      </View>

      <PanicSheet
        incident={panic.incident}
        error={panic.error}
        reasons={PASSENGER_PANIC_REASONS}
        onClose={() => setPanic({ incident: null, error: false, at: 0 })}
        fetchStatus={async (id) => (await api.get(`/incidents/${id}/status?deviceId=${encodeURIComponent(await getDeviceId())}`)).status}
        sendDetails={async (id, details) => api.patch(`/incidents/${id}/details`, { ...details, deviceId: await getDeviceId() })}
      >
        {nearbyBuses.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <T variant="title">{t('panic.whichBus')}</T>
            <T variant="small" color={theme.inkSoft} style={{ marginBottom: 8 }}>{t('passenger.panicBusHint')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {nearbyBuses.slice(0, 4).map((b) => (
                <Button key={b.busId} size="sm" variant="secondary" title={`Bus ${b.busNumber}`}
                  onPress={async () => api.patch(`/incidents/${panic.incident.id}/details`, { busId: b.busId, deviceId: await getDeviceId() }).catch(() => {})} />
              ))}
              <Button size="sm" variant="ghost" title={t('panic.notOnBus')} onPress={() => {}} />
            </View>
          </View>
        )}
      </PanicSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  searchTicket: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4, shadowColor: '#16213E', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, minHeight: 52 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  roundBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fabs: { position: 'absolute', right: 14, alignItems: 'center', gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  holeSm: { width: 14, height: 14, borderRadius: 7 }
});
