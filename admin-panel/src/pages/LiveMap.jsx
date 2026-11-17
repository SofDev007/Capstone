import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, History } from 'lucide-react';
import { routeStock, neonForRoute } from '@shared/theme/tokens.js';
import { useFleet } from '@/lib/useFleet';
import { locationAPI } from '@/lib/api';
import MapView from '@/components/MapView';
import FleetTicket from '@/components/FleetTicket';
import { RouteBadge, Serial, Stamp, EmptyTicket, RuledLines, busStamps, timeAgo, useTick, ageSeconds } from '@/components/ticket';
import { cn } from '@/lib/utils';

/** Remaining stops with live ETAs — a vertical stage strip. */
function Timetable({ bus, route }) {
  const etas = new Map((bus.live?.etas || []).map((e) => [e.stopId, e.minutes]));
  const stock = routeStock(bus.route);
  const nextId = bus.live?.nextStop?.id;
  const nextIndex = route.stops.findIndex((s) => s.id === nextId);
  return (
    <ol className="relative mt-3">
      {route.stops.map((stop, i) => {
        const passed = nextIndex === -1 ? true : i < nextIndex;
        return (
          <li key={stop.id} className="flex items-center gap-3 py-1.5">
            <span className="relative flex flex-col items-center self-stretch w-3">
              {i > 0 && <span className="absolute top-0 h-1/2 w-[2px]" style={{ background: passed || i === nextIndex ? stock.ink : '#C9CDC4' }} />}
              {i < route.stops.length - 1 && <span className="absolute bottom-0 h-1/2 w-[2px]" style={{ background: passed ? stock.ink : '#C9CDC4' }} />}
              <span className="hole relative z-[1] my-auto" data-punched={passed} data-next={i === nextIndex} style={{ '--hole-ring': passed ? stock.ink : undefined, '--hole-bg': '#EEF0EA' }} />
            </span>
            <span className={cn('flex-1 min-w-0 truncate', passed ? 'text-ink-faint' : i === nextIndex ? 'font-semibold' : '')}>{stop.name}</span>
            {!passed && etas.has(stop.id) && <span className="num text-[18px] tabular-nums">{etas.get(stop.id)}<span className="text-[12px] font-semibold ml-0.5">min</span></span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function LiveMap() {
  useTick(5000);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('bus');
  const [routeFilter, setRouteFilter] = useState(null);
  const [trail, setTrail] = useState(null);
  const { fleet, routes, loading } = useFleet();

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

  const focusRouteId = selected?.route?._id || routeFilter;
  const mapRoutes = useMemo(() => Object.values(routes).map((r) => ({
    id: r._id, coordinates: r.path, color: neonForRoute(r),
    highlighted: r._id === focusRouteId, dimmed: Boolean(focusRouteId) && r._id !== focusRouteId
  })), [routes, focusRouteId]);
  const mapStops = useMemo(() => {
    const r = routes[focusRouteId];
    return r ? r.stops.map((s) => ({ ...s, color: neonForRoute(r), highlighted: s.id === selected?.live?.nextStop?.id })) : [];
  }, [routes, focusRouteId, selected]);
  const mapBuses = useMemo(() => visible.filter((b) => b.live?.location).map((b) => ({
    id: b._id, lat: b.live.location.lat, lng: b.live.location.lng, label: b.busNumber,
    color: neonForRoute(b.route), selected: b._id === selectedId,
    alert: b.status === 'breakdown', stale: ageSeconds(b.live.lastUpdate) > 60
  })), [visible, selectedId]);

  const showTrail = async () => {
    if (!selected?.live?.tripId) return;
    const res = await locationAPI.byTrip(selected.live.tripId);
    setTrail(res.data.map((p) => [p.lng, p.lat]));
  };

  return (
    <div className="h-full flex">
      <section className="w-[400px] flex-none border-r border-rule bg-paper flex flex-col" aria-label="Buses on the road">
        <div className="p-5 pb-4">
          <h1 className="text-[24px] font-bold">Live map</h1>
          <p className="text-ink-soft text-[14px]">{fleet.length} {fleet.length === 1 ? 'bus' : 'buses'} on the road · positions glide in as drivers report</p>
          {routeChips.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Filter by route">
              <button type="button" onClick={() => setRouteFilter(null)}
                className={cn('h-8 px-3 rounded-sm text-[14px] font-semibold border-[1.5px]', !routeFilter ? 'bg-ink text-counterfoil border-ink' : 'border-rule hover:border-ink')}>All</button>
              {routeChips.map((r) => (
                <button key={r._id} type="button" onClick={() => setRouteFilter(routeFilter === r._id ? null : r._id)} aria-pressed={routeFilter === r._id}
                  className={cn('rounded-sm p-0.5 border-[1.5px]', routeFilter === r._id ? 'border-ink' : 'border-transparent')}>
                  <RouteBadge route={r} size="sm" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">
          {loading ? <RuledLines rows={8} /> : visible.length === 0 ? (
            <EmptyTicket title="No buses on the road">They appear when a driver starts a trip.</EmptyTicket>
          ) : visible.map((bus) => (
            <FleetTicket key={bus._id} bus={bus} route={routes[bus.route?._id]} compact selected={bus._id === selectedId}
              onClick={() => select(bus._id === selectedId ? null : bus._id)} />
          ))}
        </div>
      </section>

      <div className="flex-1 relative">
        <MapView routes={mapRoutes} stops={mapStops} buses={mapBuses} trail={trail}
          fitKey={`${selectedId || ''}|${routeFilter || ''}|${Object.keys(routes).length}|${trail ? 't' : ''}`}
          fitPadding={{ top: 60, bottom: 60, left: 60, right: selected ? 400 : 60 }}
          onBusClick={(id) => select(id)} />

        <AnimatePresence>
          {selected && (
            <motion.aside
              key={selected._id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-4 right-4 w-[340px] max-h-[calc(100%-32px)] overflow-y-auto ticket shadow-lifted p-5"
              aria-label={`Bus ${selected.busNumber} details`}
            >
              <button type="button" onClick={() => select(null)} className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-paper" aria-label="Close details"><X size={18} /></button>
              <div className="flex items-center gap-3">
                <RouteBadge route={selected.route} size="lg" />
                <div>
                  <div className="font-bold text-[20px] leading-tight">Bus {selected.busNumber}</div>
                  <Serial>{selected.plateNumber}</Serial>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {busStamps(selected.live, { status: selected.status }).map(([k, l]) => <Stamp key={k} kind={k}>{l}</Stamp>)}
              </div>

              <dl className="grid grid-cols-3 gap-2 mt-4 text-[13px]">
                <div><dt className="text-ink-faint">Speed</dt><dd className="num text-[22px]">{selected.live?.speed ?? '–'}<span className="text-[12px] font-semibold ml-0.5">km/h</span></dd></div>
                <div><dt className="text-ink-faint">Delay</dt><dd className="num text-[22px]">{selected.live?.delayMinutes ?? '–'}{selected.live?.delayMinutes != null && <span className="text-[12px] font-semibold ml-0.5">min</span>}</dd></div>
                <div><dt className="text-ink-faint">Updated</dt><dd className="font-semibold text-[14px] mt-1">{timeAgo(selected.live?.lastUpdate)}</dd></div>
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
                  <button type="button" onClick={trail ? () => setTrail(null) : showTrail} className="btn btn-sm btn-ghost"><History size={15} /> {trail ? 'Hide trail' : 'Show trip trail'}</button>
                </div>
                {selectedRoute ? <Timetable bus={selected} route={selectedRoute} /> : <RuledLines rows={4} />}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
