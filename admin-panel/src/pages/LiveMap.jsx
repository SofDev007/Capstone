import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Phone, History, List } from 'lucide-react';
import { neonForRoute, neon } from '@shared/theme/tokens.js';
import { useFleet, attentionRank } from '@/lib/useFleet';
import { useRealtimeEvents, incidentTitle } from '@/lib/realtime';
import { locationAPI } from '@/lib/api';
import MapView from '@/components/MapView';
import FleetTicket from '@/components/FleetTicket';
import { KpiCards, LiveFeed, ReplayScrubber, SosOverlay, FEED_COLORS } from '@/components/liveops';
import { RouteBadge, Serial, Stamp, EmptyTicket, RuledLines, busStamps, timeAgo, useTick, ageSeconds } from '@/components/ticket';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1];

/** Remaining stops with live ETAs: a vertical stage strip. */
function Timetable({ bus, route }) {
  const etas = new Map((bus.live?.etas || []).map((e) => [e.stopId, e.minutes]));
  const ink = neonForRoute(bus.route);
  const nextId = bus.live?.nextStop?.id;
  const nextIndex = route.stops.findIndex((s) => s.id === nextId);
  return (
    <ol className="relative mt-3">
      {route.stops.map((stop, i) => {
        const passed = nextIndex === -1 ? true : i < nextIndex;
        return (
          <li key={stop.id} className="flex items-center gap-3 py-1.5">
            <span className="relative flex flex-col items-center self-stretch w-3">
              {i > 0 && <span className="absolute top-0 h-1/2 w-[2px]" style={{ background: passed || i === nextIndex ? ink : '#262E44' }} />}
              {i < route.stops.length - 1 && <span className="absolute bottom-0 h-1/2 w-[2px]" style={{ background: passed ? ink : '#262E44' }} />}
              <span className="hole relative z-[1] my-auto" data-punched={passed} data-next={i === nextIndex} style={{ '--hole-ring': passed ? ink : undefined }} />
            </span>
            <span className={cn('flex-1 min-w-0 truncate', passed ? 'text-ink-faint' : i === nextIndex ? 'font-semibold' : '')}>{stop.name}</span>
            {!passed && etas.has(stop.id) && <span className="kpi-num text-[17px]">{etas.get(stop.id)}<span className="text-[12px] font-semibold ml-0.5 text-ink-soft">min</span></span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Position of a bus at time t from its (oldest-first) history. */
function positionAt(points, t) {
  let hit = null;
  for (const p of points) {
    if (p.t > t) break;
    hit = p;
  }
  return hit;
}

export default function LiveMap() {
  useTick(5000);
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('bus');
  const [routeFilter, setRouteFilter] = useState(null);
  const [trail, setTrail] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const { fleet, routes, loading } = useFleet();
  const map = useRef(null);

  const visible = routeFilter ? fleet.filter((b) => b.route?._id === routeFilter) : fleet;
  const selected = fleet.find((b) => b._id === selectedId) || null;
  const selectedRoute = selected ? routes[selected.route?._id] : null;

  const select = (id) => {
    setTrail(null);
    setParams(id ? { bus: id } : {});
  };

  useEffect(() => { setTrail(null); }, [selectedId]);

  const routeChips = useMemo(() => {
    const seen = new Map();
    fleet.forEach((b) => b.route && seen.set(b.route._id, b.route));
    return [...seen.values()].sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  }, [fleet]);

  // ─── KPIs (from data already on the page) + sparkline history sampled every 10 s ───
  const kpiNow = useMemo(() => {
    const live = fleet.filter((b) => b.live?.location && ageSeconds(b.live.lastUpdate) <= 60);
    const timed = fleet.filter((b) => b.live?.delayMinutes != null);
    return {
      live: live.length,
      onTime: timed.length ? (timed.filter((b) => b.live.delayMinutes <= 5).length / timed.length) * 100 : null,
      delay: timed.length ? timed.reduce((s, b) => s + Math.max(0, b.live.delayMinutes), 0) / timed.length : null
    };
  }, [fleet]);
  const kpiRef = useRef(kpiNow);
  kpiRef.current = kpiNow;
  const [history, setHistory] = useState({ live: [], onTime: [], delay: [] });
  useEffect(() => {
    const sample = () => setHistory((h) => Object.fromEntries(Object.keys(h).map((k) => [k, [...h[k], kpiRef.current[k] ?? 0].slice(-12)])));
    sample();
    const t = setInterval(sample, 10000);
    return () => clearInterval(t);
  }, []);
  const kpis = [
    { label: 'Buses live', value: kpiNow.live, history: history.live, color: neon.cyan },
    { label: 'On time', value: kpiNow.onTime, decimals: 1, unit: '%', history: history.onTime, color: neon.lime },
    { label: 'Avg delay', value: kpiNow.delay, decimals: 1, unit: 'min', history: history.delay, color: neon.pink }
  ];

  // ─── Live feed, built from the realtime events the page already receives ───
  const [feed, setFeed] = useState([]);
  const prev = useRef({}); // busId -> last bus view
  const fleetRef = useRef(fleet);
  fleetRef.current = fleet;
  const busNo = (busId) => fleetRef.current.find((b) => b._id === busId)?.busNumber;
  const push = useCallback((item) => setFeed((f) => [{ id: `${Date.now()}-${Math.random()}`, at: Date.now(), ...item }, ...f].slice(0, 40)), []);

  // ─── SOS choreography ───
  const [sos, setSos] = useState(null); // { incident, at, lngLat, camera }
  const [sosPoint, setSosPoint] = useState(null);

  const startSos = (incident) => {
    const m = map.current;
    const bus = fleetRef.current.find((b) => b._id === (incident.bus?._id || incident.bus));
    const loc = incident.location?.lat != null ? incident.location : bus?.live?.location;
    if (!m || !loc) { setSos({ incident, at: Date.now(), lngLat: null, camera: null }); return; }
    const camera = { center: m.getCenter(), zoom: m.getZoom() };
    m.flyTo({ center: [loc.lng, loc.lat], zoom: Math.min(17, m.getZoom() + 1.5), duration: reduce ? 0 : 1200, easing: (x) => 1 - Math.pow(1 - x, 3) });
    setSos({ incident, at: Date.now(), lngLat: [loc.lng, loc.lat], camera, busId: bus?._id });
  };
  const dismissSos = () => {
    const m = map.current;
    if (m && sos?.camera) m.flyTo({ ...sos.camera, duration: reduce ? 0 : 1000, easing: (x) => 1 - Math.pow(1 - x, 3) });
    setSos(null);
  };
  useEffect(() => {
    const m = map.current;
    if (!m || !sos?.lngLat) { setSosPoint(null); return undefined; }
    const place = () => setSosPoint(m.project(sos.lngLat));
    place();
    m.on('move', place);
    return () => m.off('move', place);
  }, [sos]);

  useRealtimeEvents((event, data) => {
    if (event === 'location-update') {
      const p = prev.current[data.busId];
      prev.current[data.busId] = data;
      if (!p) return;
      const color = neonForRoute(fleetRef.current.find((b) => b._id === data.busId)?.route || { number: data.routeNumber });
      const label = data.busNumber;
      if (p.nextStop?.id && data.nextStop?.id !== p.nextStop.id) {
        push({ badge: label, color, title: `Bus ${label} reached ${p.nextStop.name}`, meta: data.delayMinutes > 5 ? `+${data.delayMinutes} min` : 'on time' });
      }
      if (p.offRoute && !data.offRoute) push({ badge: label, color: FEED_COLORS.ok, title: `Bus ${label} back on route` });
      const gap = (new Date(data.lastUpdate) - new Date(p.lastUpdate)) / 1000;
      if (gap > 60) push({ badge: label, color: FEED_COLORS.flag, title: `Signal restored · Bus ${label}`, meta: `gap ${Math.round(gap)} s` });
      if ((p.delayMinutes ?? 0) <= 5 && data.delayMinutes > 5) push({ badge: label, color: FEED_COLORS.warn, title: `Bus ${label} delayed +${data.delayMinutes} min` });
    } else if (event === 'trip-started' || event === 'trip-ended') {
      const n = busNo(data.busId);
      const verb = event === 'trip-started' ? 'started a trip' : 'ended its trip';
      push({ badge: n ?? '•', color: FEED_COLORS.info, title: n ? `Bus ${n} ${verb}` : `A bus ${verb}` });
      delete prev.current[data.busId];
    } else if (event === 'breakdown-alert') {
      push({ badge: data.bus?.busNumber ?? '!', color: FEED_COLORS.warn, title: `Breakdown · Bus ${data.bus?.busNumber ?? ''}`, meta: data.reason });
    } else if (event === 'incident:new') {
      const panic = data.type === 'panic';
      push({ badge: '!', color: panic ? FEED_COLORS.sos : FEED_COLORS.flag, sos: panic, title: incidentTitle(data), meta: data.bus?.busNumber ? `Bus ${data.bus.busNumber}` : undefined, incident: data });
      if (panic) startSos(data);
    }
  });

  // ─── Replay: the last 15 minutes from the existing trip location history ───
  const [secondsBack, setSecondsBack] = useState(0);
  const [replay, setReplay] = useState({ status: 'idle', tracks: {} }); // tracks: busId -> [{ t, lat, lng }]
  const scrub = async (s) => {
    setSecondsBack(s);
    if (s === 0) { setReplay({ status: 'idle', tracks: {} }); return; } // refetch next time: history keeps growing
    if (replay.status !== 'idle') return;
    setReplay({ status: 'loading', tracks: {} });
    try {
      const entries = await Promise.all(fleetRef.current.filter((b) => b.live?.tripId).map(async (b) => {
        const res = await locationAPI.byTrip(b.live.tripId);
        return [b._id, res.data.map((p) => ({ t: new Date(p.timestamp).getTime(), lat: p.lat, lng: p.lng }))];
      }));
      setReplay({ status: 'ready', tracks: Object.fromEntries(entries) });
    } catch {
      setReplay({ status: 'failed', tracks: {} });
    }
  };
  const replayAt = secondsBack ? Date.now() - secondsBack * 1000 : null;

  // ─── Map data ───
  const focusRouteId = selected?.route?._id || routeFilter;
  const mapRoutes = useMemo(() => Object.values(routes).map((r) => ({
    id: r._id, coordinates: r.path, color: neonForRoute(r),
    highlighted: r._id === focusRouteId, dimmed: Boolean(focusRouteId) && r._id !== focusRouteId
  })), [routes, focusRouteId]);
  const mapStops = useMemo(() => {
    const r = routes[focusRouteId];
    return r ? r.stops.map((s) => ({ ...s, color: neonForRoute(r), highlighted: s.id === selected?.live?.nextStop?.id })) : [];
  }, [routes, focusRouteId, selected]);
  const mapBuses = visible.map((b) => {
    const at = replayAt && replay.status === 'ready' ? positionAt(replay.tracks[b._id] || [], replayAt) : null;
    const loc = replayAt ? at : b.live?.location;
    if (!loc) return null;
    const eta = b.live?.nextStop?.etaMinutes;
    return {
      id: b._id, lat: loc.lat, lng: loc.lng, label: b.busNumber, path: routes[b.route?._id]?.path,
      color: neonForRoute(b.route), selected: b._id === selectedId,
      alert: b.status === 'breakdown' || sos?.busId === b._id, stale: !replayAt && ageSeconds(b.live.lastUpdate) > 60,
      chip: !replayAt && eta != null ? { route: b.route?.number ?? b.busNumber, text: `${eta} min`, priority: (b._id === selectedId ? -1 : 0) + attentionRank(b) } : null
    };
  }).filter(Boolean);

  const showTrail = async (bus = selected) => {
    if (!bus?.live?.tripId) return;
    const res = await locationAPI.byTrip(bus.live.tripId);
    setTrail(res.data.map((p) => [p.lng, p.lat]));
  };
  const sosBus = sos ? fleet.find((b) => b._id === sos.busId) : null;
  const sosTrail = () => {
    if (sosBus) { select(sosBus._id); setTimeout(() => showTrail(sosBus), 0); }
    else if (sos?.incident.trail?.length > 1) setTrail(sos.incident.trail.map((p) => [p.lng, p.lat]));
  };

  return (
    <div className="h-full relative over-map">
      <MapView routes={mapRoutes} stops={mapStops} buses={mapBuses} trail={trail} onMap={(m) => { map.current = m; }}
        incidents={sos?.lngLat ? [{ id: sos.incident._id, lng: sos.lngLat[0], lat: sos.lngLat[1], title: incidentTitle(sos.incident) }] : []}
        fitKey={`${selectedId || ''}|${routeFilter || ''}|${Object.keys(routes).length}|${trail ? 't' : ''}`}
        fitPadding={{ top: 180, bottom: 100, left: 110, right: 340 }}
        onBusClick={(id) => select(id)} />
      {/* Vignette, as in the reference */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(5,7,13,.85))]" />

      {/* Top-left: KPIs, route filter, bus list */}
      <div className="absolute left-[90px] top-4 z-10 space-y-3 pointer-events-none [&>*]:pointer-events-auto">
        <KpiCards kpis={kpis} />
        <div className="flex flex-wrap gap-2 items-center max-w-[534px]">
          <button type="button" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}
            className={cn('glass !rounded-full h-9 px-3.5 flex items-center gap-2 text-[14px] font-semibold', listOpen && '!border-neon-cyan/60')}>
            <List size={16} /> {fleet.length} {fleet.length === 1 ? 'bus' : 'buses'} on the road
          </button>
          {routeChips.length > 1 && (
            <div className="glass !rounded-full h-9 px-1.5 flex items-center gap-1" role="group" aria-label="Filter by route">
              <button type="button" onClick={() => setRouteFilter(null)} aria-pressed={!routeFilter}
                className={cn('h-7 px-2.5 rounded-full text-[13px] font-semibold', !routeFilter ? 'bg-ink text-deep' : 'hover:bg-white/10')}>All</button>
              {routeChips.map((r) => (
                <button key={r._id} type="button" onClick={() => setRouteFilter(routeFilter === r._id ? null : r._id)} aria-pressed={routeFilter === r._id}
                  className={cn('rounded-[10px] p-0.5 border-2', routeFilter === r._id ? 'border-ink' : 'border-transparent')}>
                  <RouteBadge route={r} size="sm" />
                </button>
              ))}
            </div>
          )}
        </div>
        <AnimatePresence>
          {listOpen && (
            <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
              className="glass w-[380px] max-h-[calc(100vh-330px)] overflow-y-auto p-3 space-y-2.5" aria-label="Buses on the road">
              {loading ? <RuledLines rows={6} /> : visible.length === 0 ? (
                <EmptyTicket title="No buses on the road">They appear when a driver starts a trip.</EmptyTicket>
              ) : visible.map((bus) => (
                <FleetTicket key={bus._id} bus={bus} route={routes[bus.route?._id]} compact selected={bus._id === selectedId}
                  onClick={() => select(bus._id === selectedId ? null : bus._id)} />
              ))}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Right: live feed, or the selected bus */}
      <div className="absolute right-4 top-4 z-10 max-h-[calc(100%-100px)] flex">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.aside
              key={selected._id}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="glass w-[320px] overflow-y-auto p-5 relative"
              aria-label={`Bus ${selected.busNumber} details`}
            >
              <button type="button" onClick={() => select(null)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10" aria-label="Close details"><X size={18} /></button>
              <div className="flex items-center gap-3">
                <RouteBadge route={selected.route} size="lg" />
                <div>
                  <div className="font-bold text-[20px] leading-tight">Bus <span className="font-grotesk">{selected.busNumber}</span></div>
                  <Serial>{selected.plateNumber}</Serial>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {busStamps(selected.live, { status: selected.status }).map(([k, l]) => <Stamp key={k} kind={k}>{l}</Stamp>)}
              </div>

              <dl className="grid grid-cols-3 gap-2 mt-4 text-[13px]">
                <div className="glass-card p-2"><dt className="serial text-ink-faint">Speed</dt><dd className="kpi-num text-[20px] mt-1">{selected.live?.speed ?? '–'}<span className="text-[11px] text-ink-faint ml-0.5">km/h</span></dd></div>
                <div className="glass-card p-2"><dt className="serial text-ink-faint">Delay</dt><dd className="kpi-num text-[20px] mt-1">{selected.live?.delayMinutes ?? '–'}{selected.live?.delayMinutes != null && <span className="text-[11px] text-ink-faint ml-0.5">min</span>}</dd></div>
                <div className="glass-card p-2"><dt className="serial text-ink-faint">Seen</dt><dd className="font-semibold text-[13px] mt-1">{timeAgo(selected.live?.lastUpdate)}</dd></div>
              </dl>

              {selected.assignedDriver && (
                <div className="mt-4 pt-4 perf-h flex items-center justify-between gap-2">
                  <div>
                    <div className="text-ink-faint text-[13px]">Driver</div>
                    <div className="font-semibold">{selected.assignedDriver.name}</div>
                  </div>
                  {selected.assignedDriver.phone && (
                    <a href={`tel:${selected.assignedDriver.phone}`} className="btn btn-sm btn-secondary"><Phone size={15} /> Call</a>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 perf-h">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Stops</span>
                  <button type="button" onClick={trail ? () => setTrail(null) : () => showTrail()} className="btn btn-sm btn-ghost"><History size={15} /> {trail ? 'Hide trail' : 'Show trip trail'}</button>
                </div>
                {selectedRoute ? <Timetable bus={selected} route={selectedRoute} /> : <RuledLines rows={4} />}
              </div>
            </motion.aside>
          ) : (
            <motion.div key="feed" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.28, ease: EASE }}>
              <LiveFeed items={feed} onItemClick={(f) => (f.incident?.type === 'panic' ? startSos(f.incident) : null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom: replay scrubber */}
      <div className="absolute left-[90px] right-[322px] bottom-4 z-10">
        <ReplayScrubber secondsBack={secondsBack} onChange={scrub} events={feed}
          note={replay.status === 'loading' ? 'Loading trip history…' : replay.status === 'failed' ? 'History unavailable — live only' : secondsBack ? 'Replaying recorded positions' : null} />
      </div>

      <SosOverlay sos={sos} point={sosPoint} onDismiss={dismissSos} onTrail={sosTrail}
        driverPhone={sos?.incident.driver?.phone || sosBus?.assignedDriver?.phone} />
    </div>
  );
}
