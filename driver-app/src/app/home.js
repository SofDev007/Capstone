// Driver cockpit. Before a trip: your bus + route, slide to start. During a trip: next stop and
// minutes (stub), punched stage strip, following map with re-routing, breakdown + SOS, slide to end.
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import T from 'transit-shared/native/T';
import RouteMap from '../components/RouteMap';
import PanicButton from 'transit-shared/native/PanicButton';
import PanicSheet from 'transit-shared/native/PanicSheet';
import SlideToConfirm from '../components/SlideToConfirm';
import Sheet from 'transit-shared/native/Sheet';
import { Ticket, RouteBadge, StageStrip, Stamp, Banner, Button } from 'transit-shared/native/ui';
import { useAuth } from '../lib/auth';
import { useTheme, routeStock, stockInk, neon } from 'transit-shared/native/theme';
import { neonForRoute } from 'transit-shared/theme/tokens.js';
import { haversine } from 'transit-shared/geo.js';
import Glass, { GlassScreen } from 'transit-shared/native/Glass';
import { useReducedMotion } from 'react-native-reanimated';
import ProgressRing from '../components/ProgressRing';
import { api, errorText } from '../lib/api';
import { setActiveTrip, startBackgroundTracking, stopBackgroundTracking, flushQueue, fromLocation } from '../lib/tracking';
import { useDriverState, useWatchPosition, useTripLoop, useLocationWarnings, useReroute, useOnline, turnOnLocation } from '../lib/hooks';

function LocationPill({ on }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const color = on ? (theme.night ? neon.lime : '#17633F') : theme.signal;
  const label = theme.night ? (on ? t('driver.liveGps') : t('driver.gpsOff')) : on ? t('location.on') : t('location.off');
  return (
    <View style={[styles.pill, { borderColor: theme.night ? 'transparent' : color }]} accessibilityLabel={on ? t('location.on') : t('location.off')}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <T variant="label" color={color}>{label}</T>
    </View>
  );
}

/** HUD chip: tracked label + value (Latin-only labels stay in the serial style; T skips uppercase for Indic). */
function Chip({ label, value, color }) {
  const theme = useTheme();
  return (
    <Glass radius={14} style={styles.chip}>
      <T variant="label" color={theme.inkFaint} numberOfLines={1}>{label}</T>
      <T variant="title" color={color || theme.ink} numberOfLines={1} style={{ fontSize: 17, lineHeight: 22, marginTop: 2 }}>{value}</T>
    </Glass>
  );
}

/** Full-screen prompt while location is off during a trip. SOS stays reachable. */
function LocationOffOverlay({ visible, count, escalated, onPanic }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: theme.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.overlayIcon, { backgroundColor: theme.signalStock }]}>
          <Ionicons name="location-outline" size={44} color={theme.signal} />
        </View>
        {escalated ? <Stamp kind="emergency" style={{ alignSelf: 'center' }}>{t('location.escalatedTitle')}</Stamp>
          : count > 0 ? <Stamp kind="delayed" style={{ alignSelf: 'center' }}>{t('location.warningTitle', { count })}</Stamp> : null}
        <T variant="headline" style={{ textAlign: 'center', marginTop: 14, fontSize: 30, lineHeight: 36 }}>{t('location.offTitle')}</T>
        <T variant="body" color={theme.inkSoft} style={{ textAlign: 'center', marginTop: 8 }}>
          {escalated ? t('location.escalatedBody') : t('location.offBody')}
        </T>
        <View style={{ flex: 1 }} />
        <Button title={t('location.turnOn')} onPress={turnOnLocation} style={{ alignSelf: 'stretch' }} icon={<Ionicons name="navigate" size={20} color={theme.onPrimary} />} />
        <View style={{ marginTop: 24 }}><PanicButton onTrigger={onPanic} size={64} /></View>
      </View>
    </Modal>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { loading, me, trip, refresh, setTrip } = useDriverState(signOut);
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text }
  const [panic, setPanic] = useState({ incident: null, error: false });
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdown, setBreakdown] = useState('');

  const tripActive = Boolean(trip);
  const reduceMotion = useReducedMotion();
  const positionRef = useRef(null);
  const warnings = useLocationWarnings({ tripId: trip?._id, positionRef, t });
  const { position } = useWatchPosition(true, warnings.locationOn);
  positionRef.current = position;
  const { view, queued } = useTripLoop({ trip, position, online, onUnauthorized: signOut });

  const route = trip?.routeDetails || me?.route || null;
  const stock = routeStock(route);
  const stops = route?.stops || [];
  const nextIndex = tripActive
    ? Math.max(0, view?.nextStop ? stops.findIndex((s) => s.id === view.nextStop.id) : stops.length)
    : 0;
  const nextStop = view?.nextStop;
  const { offRoute, detour } = useReroute({ route: tripActive ? route : null, position: tripActive ? position : null, nextIndex });

  // Resume tracking after an app restart mid-trip.
  useEffect(() => {
    if (!trip) return;
    setActiveTrip(trip._id);
    startBackgroundTracking({ title: t('location.notificationTitle'), body: t('location.notificationBody') }).catch(() => {});
  }, [trip?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (tone, text) => {
    setNotice({ tone, text });
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  };

  const currentFix = async () => {
    if (positionRef.current) return positionRef.current;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return fromLocation(loc);
  };

  const startTrip = async () => {
    setBusy(true);
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        await turnOnLocation();
        flash('warn', t('driver.startNeedsLocation'));
        return;
      }
      const p = await currentFix();
      const started = await api.post('/trips/start', { startLocation: { lat: p.lat, lng: p.lng } });
      await setActiveTrip(started._id);
      setTrip(started);
      flash('ok', t('driver.tripStarted'));
      try {
        await startBackgroundTracking({ title: t('location.notificationTitle'), body: t('location.notificationBody') });
      } catch {
        flash('warn', t('location.backgroundBody'));
      }
    } catch (e) {
      if (e.status === 401) signOut();
      else flash('danger', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const endTrip = () => new Promise((resolve) => {
    Alert.alert(t('driver.endTripTitle'), t('driver.endTripBody'), [
      { text: t('common.cancel'), style: 'cancel', onPress: resolve },
      {
        text: t('driver.endTrip'), style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await flushQueue(trip._id);
            const p = positionRef.current || view?.location || trip.startLocation;
            const ended = await api.post(`/trips/${trip._id}/end`, { endLocation: { lat: p.lat, lng: p.lng } });
            await stopBackgroundTracking();
            await setActiveTrip(null);
            setTrip(null);
            flash('ok', t('driver.tripEnded', { km: (ended.totalDistance / 1000).toFixed(1) }));
          } catch (e) {
            flash('danger', errorText(e, t));
          } finally {
            setBusy(false);
            resolve();
          }
        }
      }
    ]);
  });

  const sendPanic = async () => {
    setPanic({ incident: null, error: false });
    try {
      const p = positionRef.current || (await currentFix().catch(() => null)) || view?.location;
      const incident = await api.post('/incidents/panic', { location: { lat: p?.lat ?? 0, lng: p?.lng ?? 0 } });
      setPanic({ incident, error: false });
    } catch {
      setPanic({ incident: null, error: true });
    }
  };

  const sendBreakdown = async () => {
    try {
      await api.post(`/trips/${trip._id}/breakdown`, { reason: breakdown.trim() });
      setBreakdownOpen(false);
      setBreakdown('');
      flash('warn', t('driver.breakdownSent'));
    } catch (e) {
      flash('danger', errorText(e, t));
    }
  };

  const mapProps = {
    path: route?.path || [],
    stops,
    nextIndex,
    position: tripActive ? position : null,
    detour: detour?.coordinates || null,
    ink: theme.night ? neonForRoute(route) : stock.ink,
    stock: stock.stock,
    night: theme.night,
    follow: tripActive,
    reduceMotion
  };

  // ---------- HUD numbers (all from existing tracking data) ----------
  const target = stops[nextIndex];
  const from = nextIndex > 0 ? stops[nextIndex - 1] : trip?.startLocation;
  const meters = position && target ? haversine(position, target) : null;
  const total = from && target ? Math.max(50, haversine(from, target)) : null;
  // "Trip n of m": the trip's scheduled departure among the route's departures (when the route has a timetable).
  const sched = trip?.scheduledDeparture ? new Date(trip.scheduledDeparture) : null;
  const hhmm = sched && `${String(sched.getHours()).padStart(2, '0')}:${String(sched.getMinutes()).padStart(2, '0')}`;
  const tripN = hhmm ? (route?.departures || []).indexOf(hhmm) + 1 : 0;
  const late = view?.delayMinutes > 5;
  // Turn card only when routing already gave manoeuvres (the off-route detour from ORS).
  const turn = offRoute && detour?.steps?.find((s, i) => i > 0 && s.instruction);

  return (
    <GlassScreen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading && !me} onRefresh={refresh} tintColor={theme.ink} />}
      >
        {/* Header: greeting before a trip; a glass status pill during one */}
        {tripActive && theme.night ? (
          <Glass radius={999} style={styles.topPill}>
            <RouteBadge route={route} />
            <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
              {tripN ? t('driver.tripOf', { n: tripN, m: route.departures.length }) : t('driver.bus', { number: me?.bus?.busNumber ?? '' })}
            </T>
            <LocationPill on={warnings.locationOn} />
            <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel={t('common.settings')} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={22} color={theme.ink} />
            </Pressable>
          </Glass>
        ) : (
          <View style={styles.header}>
            <T variant="title" numberOfLines={1} style={{ flex: 1 }}>{t('driver.hello', { name: (user?.name || '').split(' ')[0] })}</T>
            {tripActive && <LocationPill on={warnings.locationOn} />}
            <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel={t('common.settings')} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={24} color={theme.ink} />
            </Pressable>
          </View>
        )}

        {!online && <Banner tone="warn">{t('common.offline')}</Banner>}
        {queued > 0 && <Banner tone="info">{t('driver.queued', { count: queued })}</Banner>}
        {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

        {!loading && !me?.bus && (
          <Ticket>
            <T variant="headline">{t('driver.noBusTitle')}</T>
            <T variant="body" color={theme.inkSoft} style={{ marginTop: 6 }}>{t('driver.noBusBody')}</T>
          </Ticket>
        )}

        {me?.bus && !tripActive && (
          <Ticket stubStock={stock} stub={route ? <RouteBadge route={route} size="lg" /> : <Ionicons name="bus" size={30} color={theme.ink} />}>
            <T variant="label" color={theme.inkFaint}>{me.bus.plateNumber}</T>
            <T variant="headline" style={{ marginTop: 2 }}>{t('driver.bus', { number: me.bus.busNumber })}</T>
            <T variant="body" color={theme.inkSoft} numberOfLines={2}>{route ? route.name : t('driver.noRoute')}</T>
            {stops.length > 1 && <View style={{ marginTop: 14 }}><StageStrip stops={stops} nextIndex={0} route={route} /></View>}
          </Ticket>
        )}

        {tripActive && theme.night && (
          <>
            {nextStop ? (
              <ProgressRing meters={meters} total={total} stopName={nextStop.name} stopIndex={nextIndex} />
            ) : (
              <Glass radius={18} style={{ padding: 18, alignItems: 'center', gap: 6 }}>
                <Ionicons name="flag" size={30} color={neon.lime} />
                <T variant="headline" style={{ textAlign: 'center' }}>{t('driver.endOfRoute')}</T>
              </Glass>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label={t('driver.speedLabel')} value={view?.speed != null ? `${view.speed} km/h` : '–'} />
              <Chip label={t('driver.statusLabel')} value={view?.delayMinutes == null ? '–' : late ? t('common.delayed', { count: view.delayMinutes }) : t('common.onTime')}
                color={view?.delayMinutes == null ? undefined : late ? neon.amber : neon.lime} />
              <Chip label={t('driver.stopLabel')} value={stops.length ? `${Math.min(nextIndex + 1, stops.length)}/${stops.length}` : '–'} />
            </View>
            {turn && (
              <Glass radius={16} style={styles.turn}>
                <View style={styles.turnArrow}><Ionicons name="return-up-forward" size={26} color={neon.cyan} /></View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" numberOfLines={2}>{turn.instruction}</T>
                  {detour?.toStop && <T variant="small" color={theme.inkSoft} numberOfLines={1}>{t('driver.offRouteBody', { stop: detour.toStop.name })}</T>}
                </View>
              </Glass>
            )}
            {offRoute && !turn && (
              <Banner tone="warn">{detour?.toStop ? `${t('driver.offRouteTitle')} — ${t('driver.offRouteBody', { stop: detour.toStop.name })}` : t('driver.rerouting')}</Banner>
            )}
            {!position && warnings.locationOn && <Banner tone="info">{t('driver.waitingGps')}</Banner>}
          </>
        )}

        {tripActive && !theme.night && (
          <>
            <Ticket
              stubStock={stock}
              stub={nextStop ? (
                <View style={{ alignItems: 'center' }}>
                  <T variant="display" color={stockInk(stock, theme)}>{nextStop.etaMinutes ?? '–'}</T>
                  <T variant="bodyStrong" color={stockInk(stock, theme)} style={{ marginTop: -2 }}>{t('common.min')}</T>
                </View>
              ) : <Ionicons name="flag" size={30} color={stockInk(stock, theme)} />}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <RouteBadge route={route} />
                <T variant="label" color={theme.inkFaint}>{nextStop ? t('driver.nextStop') : t('driver.endOfRoute')}</T>
              </View>
              <T variant="headline" numberOfLines={2} style={{ marginTop: 8 }}>{nextStop?.name || stops[stops.length - 1]?.name || '—'}</T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {nextStop && <T variant="small" color={theme.inkSoft}>{t('driver.stopsLeft', { count: stops.length - nextIndex })}</T>}
                {view?.delayMinutes > 5 && <Stamp kind="delayed">{t('common.delayed', { count: view.delayMinutes })}</Stamp>}
                {view?.speed != null && <T variant="small" color={theme.inkFaint}>{t('driver.speed', { count: view.speed })}</T>}
              </View>
              {stops.length > 1 && <View style={{ marginTop: 14 }}><StageStrip stops={stops} nextIndex={nextIndex} route={route} /></View>}
            </Ticket>

            {offRoute && (
              <Banner tone="warn">
                {detour?.toStop
                  ? `${t('driver.offRouteTitle')} — ${t('driver.offRouteBody', { stop: detour.toStop.name })}${detour.steps?.[1]?.instruction ? `\n${detour.steps[1].instruction}` : ''}`
                  : t('driver.rerouting')}
              </Banner>
            )}
            {!position && warnings.locationOn && <Banner tone="info">{t('driver.waitingGps')}</Banner>}
          </>
        )}

        {route?.path?.length > 1 && (
          <View style={[styles.map, { borderColor: theme.rule, height: tripActive ? (theme.night ? 240 : 320) : 220 }, theme.night && { borderRadius: 18 }]}>
            <RouteMap {...mapProps} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
          </View>
        )}

        {me?.bus && tripActive && theme.night && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <SlideToConfirm label={t('driver.slideToEnd')} onConfirm={endTrip} loading={busy} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => setBreakdownOpen(true)} accessibilityRole="button" accessibilityLabel={t('driver.breakdown')} style={{ flex: 1 }}>
                <Glass radius={18} style={styles.report}>
                  <Ionicons name="warning-outline" size={20} color={neon.amber} />
                  <T variant="bodyStrong" style={{ fontSize: 17 }}>{t('driver.report')}</T>
                </Glass>
              </Pressable>
              <PanicButton onTrigger={sendPanic} size={64} />
            </View>
          </View>
        )}

        {me?.bus && !(tripActive && theme.night) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <View style={{ flex: 1, gap: 10 }}>
              {tripActive ? (
                <>
                  <Button title={t('driver.breakdown')} variant="secondary" onPress={() => setBreakdownOpen(true)} icon={<Ionicons name="construct-outline" size={19} color={theme.ink} />} />
                  <SlideToConfirm label={t('driver.slideToEnd')} onConfirm={endTrip} loading={busy} />
                </>
              ) : (
                route && <SlideToConfirm label={t('driver.slideToStart')} onConfirm={startTrip} loading={busy} />
              )}
            </View>
            <PanicButton onTrigger={sendPanic} />
          </View>
        )}
      </ScrollView>

      <LocationOffOverlay visible={tripActive && !warnings.locationOn} count={warnings.count} escalated={warnings.escalated} onPanic={sendPanic} />
      <PanicSheet
        incident={panic.incident}
        error={panic.error}
        onClose={() => setPanic({ incident: null, error: false })}
        fetchStatus={(id) => api.get(`/incidents/${id}/status`).then((s) => s.status)}
        sendDetails={(id, details) => api.patch(`/incidents/${id}/details`, details)}
      />
      <Sheet visible={breakdownOpen} onClose={() => setBreakdownOpen(false)} title={t('driver.breakdownTitle')}>
        <TextInput
          value={breakdown}
          onChangeText={setBreakdown}
          placeholder={t('driver.breakdownPlaceholder')}
          placeholderTextColor={theme.inkFaint}
          multiline
          autoFocus
          maxLength={300}
          style={[styles.textarea, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.bg }]}
        />
        <Button title={t('driver.breakdownSend')} onPress={sendBreakdown} disabled={breakdown.trim().length < 3} />
      </Sheet>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topPill: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 10, paddingRight: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chip: { flex: 1, minHeight: 60, paddingHorizontal: 10, paddingVertical: 8 },
  turn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, minHeight: 70 },
  turnArrow: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(62,230,255,.14)' },
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 60 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  map: { borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  overlay: { flex: 1, alignItems: 'center', paddingHorizontal: 24, gap: 6 },
  overlayIcon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  textarea: { borderWidth: 1.5, borderRadius: 8, minHeight: 96, padding: 12, fontSize: 16, marginBottom: 14, textAlignVertical: 'top' }
});
