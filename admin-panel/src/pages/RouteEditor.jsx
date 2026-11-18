import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, ArrowUp, ArrowDown, X, Wand2, Trash2, MapPin, Search } from 'lucide-react';
import { stocks, routeStock, neonForStock, glass } from '@shared/theme/tokens.js';
import { transitAPI, errorMessage } from '@/lib/api';
import MapView from '@/components/MapView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Field } from '@/components/ui/dialog';
import { RouteBadge, EmptyTicket, RuledLines, Serial, Stamp } from '@/components/ticket';
import { cn } from '@/lib/utils';

const STOCK_CHOICES = Object.entries(stocks);
const lngLat = (stop) => ({ lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] });
const blankRoute = () => ({ number: '', name: '', color: stocks.mint.ink, stops: [], departures: [] });

/** "Every 20 min from 06:00 to 21:00" helper for timetables. */
function generateDepartures(from, to, every) {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const out = [];
  for (let t = toMin(from); t <= toMin(to) && out.length < 200; t += every) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

// "22.66026, 75.88017" (as Google Maps copies it) -> { lat, lng }; null unless inside India.
function parseLatLng(text) {
  const [lat, lng] = String(text).split(/[\s,]+/).filter(Boolean).map(Number);
  return lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98 ? { lat, lng } : null;
}

function StopDialog({ open, initial, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(initial?.name || '');
    setWhere(initial ? `${initial.lat?.toFixed(6)}, ${initial.lng?.toFixed(6)}` : '');
  }, [initial]);
  const place = parseLatLng(where);
  const moved = Boolean(initial?._id && place && (place.lat.toFixed(6) !== initial.lat.toFixed(6) || place.lng.toFixed(6) !== initial.lng.toFixed(6)));
  const save = async () => {
    setBusy(true);
    try {
      const payload = { name: name.trim(), ...place };
      const res = initial._id ? await transitAPI.updateStop(initial._id, payload) : await transitAPI.createStop(payload);
      onSaved(res.data);
      toast.success(!initial._id ? `Stop “${res.data.name}” added`
        : moved ? 'Stop moved — generate the road path again for routes that use it' : 'Stop saved');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?._id ? 'Edit stop' : 'New stop here'}</DialogTitle>
          {initial && <DialogDescription>{initial._id ? 'Rename it, or paste its exact location to move it.' : `${initial.lat?.toFixed(5)}, ${initial.lng?.toFixed(5)}`}</DialogDescription>}
        </DialogHeader>
        <Field label="Stop name" hint="Use the name people say at the roadside, e.g. “Rajwada” or “Palasia Square”.">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && place && save()} />
        </Field>
        <Field label="Location (latitude, longitude)" hint={place ? 'In Google Maps, right-click the bus stop and click the numbers to copy them, then paste here.' : 'Paste it as “22.71960, 75.85770” (a place in India).'}>
          <input className="field font-mono" value={where} onChange={(e) => setWhere(e.target.value)} inputMode="decimal" spellCheck={false} />
        </Field>
        <DialogFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || name.trim().length < 2 || !place} onClick={save}>Save stop</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RouteEditor() {
  const [tab, setTab] = useState('routes');
  const [routes, setRoutes] = useState(null);
  const [stops, setStops] = useState([]);
  const [draft, setDraft] = useState(null); // route being edited
  const [savedPath, setSavedPath] = useState(null); // { key, coordinates } for the saved stop order
  const [stopDialog, setStopDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stopQuery, setStopQuery] = useState('');
  const [gen, setGen] = useState({ from: '06:00', to: '21:00', every: 20 });

  const loadRoutes = () => transitAPI.routes().then((r) => setRoutes(r.data)).catch(() => setRoutes([]));
  const loadStops = () => transitAPI.stops().then((r) => setStops(r.data)).catch(() => {});
  useEffect(() => { loadRoutes(); loadStops(); }, []);

  const stopById = useMemo(() => new Map(stops.map((s) => [s._id, s])), [stops]);
  const stopKey = (list) => list.map((s) => s.stop).join(',');

  const openRoute = async (id) => {
    const r = (await transitAPI.route(id)).data;
    const d = { _id: r._id, number: r.number, name: r.name, color: r.color, departures: r.departures, pathSource: r.pathSource,
      stops: r.stops.filter((s) => s.stop).map((s) => ({ stop: s.stop._id, offsetMinutes: s.offsetMinutes })) };
    setDraft(d);
    setSavedPath({ key: stopKey(d.stops), coordinates: r.path?.coordinates || [], source: r.pathSource });
  };

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const moveStop = (i, dir) => setDraft((d) => {
    const list = [...d.stops];
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    return { ...d, stops: list };
  });
  const addStop = (id) => {
    if (!draft) return;
    if (draft.stops.some((s) => s.stop === id)) { toast('That stop is already on this route'); return; }
    const last = draft.stops[draft.stops.length - 1];
    update({ stops: [...draft.stops, { stop: id, offsetMinutes: last ? last.offsetMinutes + 3 : 0 }] });
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { number: draft.number.trim(), name: draft.name.trim(), color: draft.color, stops: draft.stops, departures: draft.departures };
      const res = draft._id ? await transitAPI.updateRoute(draft._id, payload) : await transitAPI.createRoute(payload);
      toast.success(`Route ${res.data.number} saved`);
      await openRoute(res.data._id);
      loadRoutes();
      return res.data._id;
    } catch (e) {
      toast.error(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const generatePath = async () => {
    const id = await save();
    if (!id) return;
    setBusy(true);
    try {
      const { source, distance, offsetsUpdated, routingError } = (await transitAPI.generatePath(id)).data;
      await openRoute(id);
      const times = offsetsUpdated ? ' and stop times filled in' : '; timetable kept';
      if (source === 'routing') toast.success(`Road path generated (${(distance / 1000).toFixed(1)} km)${times}`);
      else if (routingError) toast.error(`Road routing failed, kept straight lines: ${routingError}`);
      else toast.success('Path drawn as straight lines — add an OpenRouteService key on the server for real roads');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeRoute = async () => {
    if (!window.confirm(`Delete route ${draft.number}? This cannot be undone.`)) return;
    try {
      await transitAPI.deleteRoute(draft._id);
      toast.success('Route deleted');
      setDraft(null);
      loadRoutes();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const removeStop = async (stop) => {
    try {
      await transitAPI.deleteStop(stop._id);
      toast.success(`Stop “${stop.name}” deleted`);
      loadStops();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ----- Map data -----
  const stock = draft ? routeStock({ color: draft.color }) : null;
  const draftStopIds = new Set(draft?.stops.map((s) => s.stop));
  const mapStops = useMemo(() => stops.map((s) => {
    const index = draft ? draft.stops.findIndex((d) => d.stop === s._id) : -1;
    return { id: s._id, name: s.name, ...lngLat(s), color: index >= 0 ? neonForStock(stock) : glass.text.muted, highlighted: index >= 0, label: index >= 0 ? `${index + 1}. ${s.name}` : '' };
  }), [stops, draft, stock]);
  const mapRoutes = useMemo(() => {
    if (!draft || draft.stops.length < 2) return [];
    const unchanged = savedPath && savedPath.key === stopKey(draft.stops) && savedPath.coordinates.length >= 2;
    const coordinates = unchanged ? savedPath.coordinates : draft.stops.map((s) => stopById.get(s.stop)).filter(Boolean).map((s) => s.location.coordinates);
    return [{ id: 'draft', coordinates, color: neonForStock(stock), highlighted: true }];
  }, [draft, savedPath, stopById, stock]);
  const pathIsStale = draft && draft.stops.length >= 2 && (!savedPath || savedPath.key !== stopKey(draft.stops) || savedPath.source !== 'routing');

  const filteredStops = stops.filter((s) => s.name.toLowerCase().includes(stopQuery.toLowerCase()));

  return (
    <div className="h-full flex">
      <section className="w-[440px] flex-none border-r border-rule flex flex-col bg-paper" aria-label="Routes and stops">
        {!draft ? (
          <>
            <div className="p-5 pb-3">
              <h1 className="text-[24px] font-bold">Routes &amp; stops</h1>
              <p className="text-ink-soft text-[14px]">The network the journey planner and arrival times run on.</p>
              <div className="flex gap-1 mt-4 p-1 rounded-md bg-rule/40" role="tablist">
                {[['routes', `Routes${routes ? ` · ${routes.length}` : ''}`], ['stops', `Stops · ${stops.length}`]].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                    className={cn('flex-1 h-9 rounded-sm text-[14px] font-semibold', tab === key ? 'bg-counterfoil shadow-rest' : 'text-ink-soft hover:text-ink')}>{label}</button>
                ))}
              </div>
            </div>
            {tab === 'routes' ? (
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2.5">
                <button type="button" className="btn btn-primary w-full" onClick={() => { setDraft(blankRoute()); setSavedPath(null); }}><Plus size={18} /> New route</button>
                {routes === null ? <RuledLines rows={6} /> : routes.length === 0 ? (
                  <EmptyTicket title="No routes yet">Create a route, then click stops on the map in the order the bus visits them.</EmptyTicket>
                ) : routes.map((r) => (
                  <button key={r._id} type="button" onClick={() => openRoute(r._id)} className="ticket w-full text-left p-4 flex items-center gap-3 hover:shadow-lifted hover:-translate-y-px transition-all duration-200 ease-out">
                    <RouteBadge route={r} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{r.name || `Route ${r.number}`}</span>
                      <span className="block text-[13.5px] text-ink-soft">{r.stopsCount} stops · {r.departures.length} departures · {r.busCount} {r.busCount === 1 ? 'bus' : 'buses'}</span>
                    </span>
                    {!r.hasPath && r.stopsCount >= 2 && <Stamp kind="delayed">No path</Stamp>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 pb-6">
                <p className="text-[13.5px] text-ink-soft mb-3 flex items-center gap-2"><MapPin size={15} /> Click anywhere on the map to add a stop there.</p>
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input className="field pl-10" placeholder="Find a stop" value={stopQuery} onChange={(e) => setStopQuery(e.target.value)} />
                </div>
                <ul className="divide-y divide-rule border-y border-rule">
                  {filteredStops.map((s) => (
                    <li key={s._id} className="flex items-center gap-2 py-2.5">
                      <span className="hole" />
                      <span className="flex-1 truncate">{s.name}</span>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setStopDialog({ _id: s._id, name: s.name, ...lngLat(s) })}>Edit</button>
                      <button type="button" className="p-2 rounded-sm text-ink-faint hover:text-signal hover:bg-signal-stock" aria-label={`Delete ${s.name}`} onClick={() => removeStop(s)}><Trash2 size={16} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="flex items-center justify-between">
              <button type="button" className="btn btn-sm btn-ghost -ml-3" onClick={() => setDraft(null)}>← All routes</button>
              {draft._id && <button type="button" className="btn btn-sm btn-ghost text-signal" onClick={removeRoute}><Trash2 size={15} /> Delete</button>}
            </div>

            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Field label="Number"><input className="field num text-[24px]" value={draft.number} onChange={(e) => update({ number: e.target.value })} placeholder="12" /></Field>
              <Field label="Name"><input className="field" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Mhow Naka – CAT" /></Field>
            </div>

            <div>
              <span className="block text-[14px] font-semibold mb-1.5">Ticket colour</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Route colour">
                {STOCK_CHOICES.map(([name, s]) => (
                  <button key={name} type="button" role="radio" aria-checked={routeStock({ color: draft.color }).ink === s.ink} aria-label={name}
                    onClick={() => update({ color: s.ink })}
                    className={cn('h-10 w-12 rounded-sm border-2 grid place-items-center num text-[18px]', routeStock({ color: draft.color }).ink === s.ink ? 'border-ink' : 'border-transparent')}
                    style={{ background: neonForStock(s), color: glass.bg.deep }}>{draft.number || '#'}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[14px] font-semibold">Stops in order</span>
                <span className="text-[13px] text-ink-faint">Click stops on the map to add</span>
              </div>
              {draft.stops.length === 0 ? (
                <EmptyTicket title="No stops yet">Click existing stops on the map in the order the bus visits them, or switch to Stops to create new ones.</EmptyTicket>
              ) : (
                <ol className="ticket divide-y divide-rule">
                  {draft.stops.map((s, i) => (
                    <li key={s.stop} className="flex items-center gap-2 px-3 py-2">
                      <span className="num text-[16px] w-6 text-center" style={{ color: neonForStock(stock) }}>{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate">{stopById.get(s.stop)?.name || 'Unknown stop'}</span>
                      <label className="flex items-center gap-1 text-[13px] text-ink-faint" title="Scheduled minutes from the first stop">
                        +<input type="number" min="0" className="w-14 h-8 px-1.5 rounded-sm border border-rule bg-counterfoil text-ink text-right tabular-nums"
                          value={s.offsetMinutes} onChange={(e) => update({ stops: draft.stops.map((x, j) => (j === i ? { ...x, offsetMinutes: Math.max(0, Number(e.target.value)) } : x)) })} />min
                      </label>
                      <button type="button" className="p-1 rounded-sm hover:bg-paper disabled:opacity-30" disabled={i === 0} onClick={() => moveStop(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                      <button type="button" className="p-1 rounded-sm hover:bg-paper disabled:opacity-30" disabled={i === draft.stops.length - 1} onClick={() => moveStop(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                      <button type="button" className="p-1 rounded-sm hover:bg-signal-stock hover:text-signal" onClick={() => update({ stops: draft.stops.filter((_, j) => j !== i) })} aria-label="Remove stop"><X size={15} /></button>
                    </li>
                  ))}
                </ol>
              )}
              {pathIsStale && (
                <p className="text-[13.5px] mt-2 p-2.5 rounded-sm bg-buff text-buff-ink">
                  {savedPath?.source === 'routing' ? 'Stops changed — regenerate the road path.' : 'The map shows straight lines between stops. Generate the road path to follow the real roads.'}
                </p>
              )}
            </div>

            <div>
              <span className="block text-[14px] font-semibold mb-1.5">Departures from the first stop</span>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {draft.departures.length === 0 && <span className="text-[13.5px] text-ink-faint">No timetable — arrival estimates will use live buses only.</span>}
                {draft.departures.map((t) => (
                  <button key={t} type="button" className="h-7 px-2 rounded-sm bg-counterfoil border border-rule text-[13.5px] tabular-nums hover:border-signal hover:text-signal"
                    title="Remove" onClick={() => update({ departures: draft.departures.filter((x) => x !== t) })}>{t}</button>
                ))}
              </div>
              <div className="flex items-end gap-2 flex-wrap text-[14px]">
                <span className="pb-2">Every</span>
                <input type="number" min="5" max="240" className="field w-16 h-9" value={gen.every} onChange={(e) => setGen({ ...gen, every: Number(e.target.value) })} />
                <span className="pb-2">min from</span>
                <input type="time" className="field w-[110px] h-9" value={gen.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} />
                <span className="pb-2">to</span>
                <input type="time" className="field w-[110px] h-9" value={gen.to} onChange={(e) => setGen({ ...gen, to: e.target.value })} />
                <button type="button" className="btn btn-sm btn-secondary" disabled={!gen.every || gen.every < 5}
                  onClick={() => update({ departures: [...new Set([...draft.departures, ...generateDepartures(gen.from, gen.to, gen.every)])].sort() })}>Add times</button>
                {draft.departures.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => update({ departures: [] })}>Clear</button>}
              </div>
            </div>

            <div className="flex gap-2 pt-5 perf-h sticky -bottom-5 -mb-5 pb-5 bg-paper z-[2]">
              <button type="button" className="btn btn-primary flex-1" disabled={busy || !draft.number.trim()} onClick={save}>{busy ? 'Saving…' : 'Save route'}</button>
              <button type="button" className="btn btn-secondary flex-1" disabled={busy || !draft.number.trim() || draft.stops.length < 2} onClick={generatePath}><Wand2 size={17} /> Road path</button>
            </div>
          </div>
        )}
      </section>

      <div className="flex-1 relative">
        <MapView
          stops={mapStops}
          routes={mapRoutes}
          fitKey={`${draft?._id || (draft ? 'new' : 'all')}|${stops.length > 0}`}
          onStopClick={(id) => (draft ? (draftStopIds.has(id) ? toast('Already on this route') : addStop(id)) : (() => { const s = stopById.get(id); setStopDialog({ _id: s._id, name: s.name, ...lngLat(s) }); })())}
          onMapClick={(p) => setStopDialog({ ...p })}
        />
        {draft && (
          <div className="absolute top-4 left-4 ticket px-4 py-3 flex items-center gap-3">
            <RouteBadge route={{ number: draft.number || '?', color: draft.color }} />
            <div>
              <div className="font-semibold">{draft.name || 'Untitled route'}</div>
              <Serial>{draft.stops.length} stops</Serial>
            </div>
          </div>
        )}
      </div>

      <StopDialog open={Boolean(stopDialog)} initial={stopDialog} onClose={() => setStopDialog(null)}
        onSaved={(stop) => { setStopDialog(null); loadStops(); if (draft && !stopDialog?._id) addStop(stop._id); }} />
    </div>
  );
}
