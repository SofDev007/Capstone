import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { neonForRoute } from '@shared/theme/tokens.js';
import { useRealtime, useRealtimeEvents, incidentTitle, incidentSubtitle } from '@/lib/realtime';
import { useFleet } from '@/lib/useFleet';
import { incidentAPI } from '@/lib/api';
import FleetTicket from '@/components/FleetTicket';
import MapView from '@/components/MapView';
import { EmptyTicket, RuledLines, Stamp, timeAgo, useTick, ageSeconds } from '@/components/ticket';

function Figure({ n, tone }) {
  return <span className={`num text-[1.35em] px-1 rounded-sm ${tone || ''}`}>{n}</span>;
}

/** The day's state as one sentence a supervisor can read at a glance. */
function DutyLine({ summary, fleet }) {
  if (!summary) return <RuledLines rows={2} />;
  const late = fleet.filter((b) => b.live?.delayMinutes > 5).length;
  const off = fleet.filter((b) => b.live?.offRoute).length;
  const stale = fleet.filter((b) => b.live && ageSeconds(b.live.lastUpdate) > 60).length;
  const alerts = summary.openIncidents?.total || 0;
  const apps = summary.pendingApplications || 0;
  return (
    <p className="text-[24px] leading-[1.45] font-semibold max-w-[60ch] text-ink">
      <Figure n={fleet.length} /> {fleet.length === 1 ? 'bus is' : 'buses are'} on the road
      {late > 0 && <>, <Figure n={late} tone="bg-buff text-buff-ink" /> running late</>}
      {off > 0 && <>, <Figure n={off} tone="bg-buff text-buff-ink" /> off route</>}
      {stale > 0 && <>, <Figure n={stale} tone="bg-rule/60" /> not reporting</>}
      .{' '}
      {alerts > 0 ? (
        <Link to="/alerts" className="underline decoration-2 underline-offset-4 decoration-signal">
          <Figure n={alerts} tone="bg-signal text-counterfoil" /> {alerts === 1 ? 'alert' : 'alerts'} open
        </Link>
      ) : <span className="text-ink-soft">No open alerts</span>}
      {apps > 0 && (
        <> and <Link to="/applications" className="underline decoration-2 underline-offset-4 decoration-buff-ink">
          <Figure n={apps} tone="bg-buff text-buff-ink" /> driver {apps === 1 ? 'application' : 'applications'} waiting
        </Link></>
      )}.
    </p>
  );
}

export default function Dashboard() {
  useTick(5000);
  const navigate = useNavigate();
  const { summary } = useRealtime();
  const { fleet, routes, loading } = useFleet();
  const [incidents, setIncidents] = useState([]);

  const loadIncidents = () => incidentAPI.list({ status: 'active', limit: 6 }).then((r) => setIncidents(r.data.items)).catch(() => {});
  useEffect(() => { loadIncidents(); }, []);
  useRealtimeEvents((event) => { if (event.startsWith('incident:')) loadIncidents(); });

  const mapRoutes = useMemo(() => Object.values(routes).map((r) => ({ id: r._id, coordinates: r.path, color: neonForRoute(r) })), [routes]);
  const mapBuses = useMemo(() => fleet.filter((b) => b.live?.location).map((b) => ({
    id: b._id, lat: b.live.location.lat, lng: b.live.location.lng, label: b.busNumber, path: routes[b.route?._id]?.path,
    color: neonForRoute(b.route), alert: b.status === 'breakdown', stale: ageSeconds(b.live.lastUpdate) > 60
  })), [fleet, routes]);
  const fitKey = `${mapRoutes.length}`;

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-10">
      <header>
        <p className="text-ink-soft font-medium">{today}</p>
        <div className="mt-2"><DutyLine summary={summary} fleet={fleet} /></div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-10 items-start">
        <section aria-labelledby="fleet-h">
          <div className="flex items-baseline justify-between mb-4">
            <h2 id="fleet-h" className="text-[20px] font-bold">Fleet board</h2>
            <span className="text-[13.5px] text-ink-faint">Buses needing attention rise to the top</span>
          </div>
          {loading ? <RuledLines rows={6} /> : fleet.length === 0 ? (
            <EmptyTicket title="No buses on the road right now">
              Buses appear here the moment a driver starts a trip in the driver app.
            </EmptyTicket>
          ) : (
            <motion.ol layout className="space-y-3">
              <AnimatePresence initial={false}>
                {fleet.map((bus) => (
                  <motion.li key={bus._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}>
                    <FleetTicket bus={bus} route={routes[bus.route?._id]} onClick={() => navigate(`/map?bus=${bus._id}`)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ol>
          )}
        </section>

        <aside className="space-y-8">
          <div className="ticket overflow-hidden h-[320px] relative">
            <MapView routes={mapRoutes} buses={mapBuses} fitKey={fitKey} fitPadding={40}
              onBusClick={(id) => navigate(`/map?bus=${id}`)} interactiveStops={false} />
            <Link to="/map" className="absolute top-3 left-3 btn btn-sm btn-secondary shadow-rest">Open live map <ArrowRight size={15} /></Link>
          </div>

          <section aria-labelledby="attention-h">
            <h2 id="attention-h" className="text-[20px] font-bold mb-3">Needs a response</h2>
            {incidents.length === 0 ? (
              <p className="text-ink-soft">Nothing open. Panic alerts, location-off, off-route and signal-lost flags will appear here.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {incidents.map((i) => (
                  <li key={i._id}>
                    <Link to={`/alerts?id=${i._id}`} className={`flex items-center gap-3 py-3 px-2 -mx-2 rounded-sm hover:bg-counterfoil ${i.status === 'open' && i.type === 'panic' ? 'alert-lit' : ''}`}>
                      <span className={`h-2.5 w-2.5 rounded-full flex-none ${i.type === 'panic' ? 'bg-signal' : 'bg-buff-ink'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold truncate">{incidentTitle(i)}</span>
                        <span className="block text-[13.5px] text-ink-soft truncate">{incidentSubtitle(i)}</span>
                      </span>
                      <span className="text-right flex-none">
                        <Stamp kind={i.status === 'open' ? (i.type === 'panic' ? 'emergency' : 'delayed') : 'info'}>{i.status === 'open' ? 'Open' : 'Seen'}</Stamp>
                        <span className="block text-[12.5px] text-ink-faint mt-1">{timeAgo(i.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
