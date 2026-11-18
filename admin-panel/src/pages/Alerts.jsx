import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Phone, BellRing, Check } from 'lucide-react';
import { reasonLabel, INCIDENT_TYPES, EMERGENCY_NUMBER } from '@shared/incidents.js';
import { incidentAPI, errorMessage } from '@/lib/api';
import { useRealtime, useRealtimeEvents, incidentTitle, incidentSubtitle } from '@/lib/realtime';
import MapView from '@/components/MapView';
import { Stamp, EmptyTicket, RuledLines, timeAgo, useTick } from '@/components/ticket';
import { cn } from '@/lib/utils';

const STATUS_STAMP = { open: ['emergency', 'Open'], acknowledged: ['delayed', 'Seen'], resolved: ['approved', 'Resolved'] };

function Reporter({ incident }) {
  const person = incident.driver || incident.user;
  if (!person) {
    return (
      <div>
        <div className="font-semibold">Anonymous passenger</div>
        <div className="text-[13.5px] text-ink-soft">Not signed in · device …{incident.deviceId?.slice(-6) || 'unknown'}</div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold">{person.name} <span className="text-ink-faint font-normal">· {incident.driver ? 'driver' : 'passenger'}</span></div>
        <div className="text-[13.5px] text-ink-soft truncate">{[person.phone, person.email].filter(Boolean).join(' · ')}</div>
      </div>
      {person.phone && <a className="btn btn-sm btn-secondary flex-none" href={`tel:${person.phone}`}><Phone size={15} /> Call</a>}
    </div>
  );
}

function Detail({ incident, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const act = async (fn, done) => {
    setBusy(true);
    try {
      onChanged((await fn()).data);
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const loc = incident.location;
  const trail = incident.trail?.length > 1 ? incident.trail.map((p) => [p.lng, p.lat]) : null;
  const emergency = incident.type === 'panic';

  return (
    <motion.div key={incident._id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col">
      <div className="h-[42%] min-h-[260px] relative border-b border-rule">
        <MapView incidents={loc?.lat != null ? [{ id: incident._id, lat: loc.lat, lng: loc.lng }] : []} trail={trail}
          fitKey={incident._id + (trail?.length || 0)} fitPadding={80} interactiveStops={false} />
        {trail && <span className="absolute top-3 left-3 stamp bg-counterfoil" style={{ color: '#FF4D6D' }}>Sharing live location</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Stamp kind={STATUS_STAMP[incident.status][0]} land>{STATUS_STAMP[incident.status][1]}</Stamp>
            <span className="text-ink-faint text-[14px]">{INCIDENT_TYPES[incident.type]} · {new Date(incident.createdAt).toLocaleString()}</span>
          </div>
          <h2 className={cn('text-[28px] font-bold mt-2 leading-tight', emergency && 'text-signal')}>{incidentTitle(incident)}</h2>
          <p className="text-[17px] mt-1">{emergency ? reasonLabel(incident.reason) : incident.note}</p>
          {emergency && incident.note && <p className="mt-2 p-3 rounded-md bg-paper">“{incident.note}”</p>}
          {emergency && !incident.reason && <p className="text-ink-soft mt-1">The reporter hasn’t chosen a reason yet — it updates here live.</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div><div className="serial text-ink-faint mb-1.5">Reported by</div><Reporter incident={incident} /></div>
          <div>
            <div className="serial text-ink-faint mb-1.5">Bus</div>
            {incident.bus ? <div className="font-semibold">Bus {incident.bus.busNumber} <span className="text-ink-faint font-normal">· {incident.bus.plateNumber}</span></div> : <div className="text-ink-soft">Not on a bus</div>}
            {loc?.lat != null && (
              <a className="text-[13.5px] underline underline-offset-2 text-ink-soft" target="_blank" rel="noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}`}>
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
              </a>
            )}
          </div>
        </div>

        <ol className="perf-h pt-5 space-y-2 text-[14px]">
          <li><span className="font-semibold">Reported</span> <span className="text-ink-soft">{timeAgo(incident.createdAt)}</span></li>
          {incident.acknowledgedAt && <li><span className="font-semibold">Acknowledged</span> <span className="text-ink-soft">{timeAgo(incident.acknowledgedAt)}{incident.handledBy?.email ? ` by ${incident.handledBy.email}` : ''}</span></li>}
          {incident.resolvedAt && <li><span className="font-semibold">Resolved</span> <span className="text-ink-soft">{timeAgo(incident.resolvedAt)} · {incident.resolution === 'false-alarm' ? 'false alarm' : incident.resolution === 'auto' ? 'cleared automatically' : 'handled'}{incident.resolutionNote ? ` — ${incident.resolutionNote}` : ''}</span></li>}
        </ol>

        {incident.status !== 'resolved' && (
          <div className="perf-h pt-5 space-y-3">
            {incident.status === 'open' && (
              <button type="button" className={cn('btn w-full', emergency ? 'btn-danger' : 'btn-primary')} disabled={busy}
                onClick={() => act(() => incidentAPI.acknowledge(incident._id), 'Acknowledged — the reporter can see help is aware')}>
                <Check size={18} /> Acknowledge
              </button>
            )}
            <textarea className="field" rows={2} placeholder="What was done? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" disabled={busy}
                onClick={() => act(() => incidentAPI.resolve(incident._id, 'handled', note), 'Marked as handled')}>Mark handled</button>
              <button type="button" className="btn btn-ghost flex-1" disabled={busy}
                onClick={() => act(() => incidentAPI.resolve(incident._id, 'false-alarm', note), 'Marked as a false alarm')}>False alarm</button>
            </div>
            {emergency && <p className="text-[13.5px] text-ink-soft">Life in danger? Call emergency services on <a className="font-bold underline" href={`tel:${EMERGENCY_NUMBER}`}>{EMERGENCY_NUMBER}</a>.</p>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Alerts() {
  useTick(10000);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const [tab, setTab] = useState('active');
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notifyPermission, setNotifyPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const { refreshSummary } = useRealtime();

  const load = () => incidentAPI.list({ status: tab, limit: 100 }).then((r) => setItems(r.data.items)).catch(() => setItems([]));
  useEffect(() => { setItems(null); load(); }, [tab]);
  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    incidentAPI.get(selectedId).then((r) => setSelected(r.data)).catch(() => setSelected(null));
  }, [selectedId]);

  useRealtimeEvents((event, data) => {
    if (!event.startsWith('incident:')) return;
    load();
    if (data._id === selectedId) setSelected((prev) => ({ ...prev, ...data }));
  });

  // Auto-open the newest open alert when nothing is selected.
  useEffect(() => {
    if (!selectedId && items?.length && tab === 'active') setParams({ id: items[0]._id }, { replace: true });
  }, [items, selectedId, tab, setParams]);

  const sorted = useMemo(() => (items || []).slice().sort((a, b) =>
    (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) ||
    (a.type === 'panic' ? 0 : 1) - (b.type === 'panic' ? 0 : 1) ||
    new Date(b.createdAt) - new Date(a.createdAt)), [items]);

  const enableNotifications = async () => setNotifyPermission(await Notification.requestPermission());

  return (
    <div className="h-full flex">
      <section className="w-[420px] flex-none border-r border-rule flex flex-col" aria-label="Alerts">
        <div className="p-5 pb-3">
          <h1 className="text-[24px] font-bold">Alerts</h1>
          <p className="text-ink-soft text-[14px]">SOS from drivers and passengers, plus location-off, off-route and signal-lost flags.</p>
          {notifyPermission === 'default' && (
            <button type="button" onClick={enableNotifications} className="btn btn-sm btn-secondary mt-3"><BellRing size={15} /> Alert me even when this tab is hidden</button>
          )}
          <div className="flex gap-1 mt-4 p-1 rounded-md bg-rule/40 w-fit" role="tablist">
            {[['active', 'Needs response'], ['resolved', 'Resolved']].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={cn('h-9 px-4 rounded-sm text-[14px] font-semibold transition-colors', tab === key ? 'bg-counterfoil shadow-rest' : 'text-ink-soft hover:text-ink')}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items === null ? <div className="px-5"><RuledLines rows={6} /></div> : sorted.length === 0 ? (
            <div className="p-5"><EmptyTicket title={tab === 'active' ? 'All clear' : 'Nothing resolved yet'}>{tab === 'active' ? 'New alerts appear here instantly, with a sound for SOS.' : 'Handled alerts are kept here for the record.'}</EmptyTicket></div>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {sorted.map((i) => (
                  <motion.li key={i._id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                    <button type="button" onClick={() => setParams({ id: i._id })}
                      className={cn('w-full text-left px-5 py-3.5 border-b border-rule flex gap-3 items-start transition-colors',
                        i._id === selectedId ? 'bg-counterfoil' : 'hover:bg-counterfoil/60',
                        i.status === 'open' && i.type === 'panic' && i._id !== selectedId && 'alert-lit')}>
                      <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full flex-none', i.type === 'panic' ? 'bg-signal' : 'bg-buff-ink', i.status === 'resolved' && 'opacity-40')} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{incidentTitle(i)}</span>
                          <span className="text-[12.5px] text-ink-faint flex-none">{timeAgo(i.createdAt)}</span>
                        </span>
                        <span className="block text-[13.5px] text-ink-soft truncate">{incidentSubtitle(i) || 'No details yet'}</span>
                        <span className="block mt-1.5"><Stamp kind={STATUS_STAMP[i.status][0]}>{STATUS_STAMP[i.status][1]}</Stamp></span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </section>

      <div className="flex-1 min-w-0 bg-counterfoil">
        {selected ? (
          <Detail incident={selected} onChanged={(inc) => { setSelected(inc); load(); refreshSummary(); }} />
        ) : (
          <div className="h-full grid place-items-center p-10"><EmptyTicket title="Choose an alert">Its location, reporter and actions open here.</EmptyTicket></div>
        )}
      </div>
    </div>
  );
}
