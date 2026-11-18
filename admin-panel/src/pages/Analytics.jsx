import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { glass, neon } from '@shared/theme/tokens.js';
import { INCIDENT_TYPES } from '@shared/incidents.js';
import { tripAPI, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { RouteBadge, Stamp, EmptyTicket, RuledLines } from '@/components/ticket';
import { cn } from '@/lib/utils';

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const PRESETS = [['Today', 0], ['7 days', 6], ['30 days', 29], ['90 days', 89]];

const duration = (t) => {
  if (!t.endTime) return 'On the road';
  const m = Math.round((new Date(t.endTime) - new Date(t.startTime)) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** A waybill total line: figures printed side by side, separated by perforations. */
function Totals({ stats }) {
  const items = [
    [stats.total, 'trips'],
    [stats.completed, 'completed'],
    [stats.totalDistanceKm, 'km driven'],
    [stats.avgDurationMinutes, 'min average trip'],
    [stats.onTimePercent != null ? `${stats.onTimePercent}%` : '—', 'on time (≤ 5 min late)'],
    [stats.breakdowns, 'breakdowns']
  ];
  return (
    <div className="ticket flex flex-wrap">
      {items.map(([n, label], i) => (
        <div key={label} className={cn('flex-1 min-w-[150px] px-5 py-4', i > 0 && 'border-l-2 border-dotted border-rule')}>
          <div className="num text-[34px]">{n}</div>
          <div className="text-[13.5px] text-ink-soft mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState({ startDate: daysAgo(6), endDate: iso(new Date()) });
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    setStats(null);
    tripAPI.stats(range).then((r) => setStats(r.data)).catch((e) => setError(errorMessage(e)));
  }, [range]);
  useEffect(() => {
    setTrips(null);
    tripAPI.list({ ...range, page, limit: 20 }).then((r) => setTrips(r.data)).catch((e) => setError(errorMessage(e)));
  }, [range, page]);

  const setPreset = (n) => { setPage(1); setRange({ startDate: daysAgo(n), endDate: iso(new Date()) }); };
  const activePreset = PRESETS.find(([, n]) => range.startDate === daysAgo(n) && range.endDate === iso(new Date()))?.[1];
  const incidents = stats ? Object.entries(stats.incidentsByType) : [];
  const maxIncidents = Math.max(1, ...incidents.map(([, n]) => n));

  return (
    <div className="space-y-10">
      <PageHeader title="Reports" actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1 p-1 rounded-md bg-rule/40">
            {PRESETS.map(([label, n]) => (
              <button key={label} type="button" onClick={() => setPreset(n)}
                className={cn('h-9 px-3 rounded-sm text-[14px] font-semibold', activePreset === n ? 'bg-counterfoil shadow-rest' : 'text-ink-soft hover:text-ink')}>{label}</button>
            ))}
          </div>
          <input type="date" className="field h-11 w-[150px]" value={range.startDate} max={range.endDate} aria-label="From date"
            onChange={(e) => { setPage(1); setRange({ ...range, startDate: e.target.value }); }} />
          <input type="date" className="field h-11 w-[150px]" value={range.endDate} min={range.startDate} aria-label="To date"
            onChange={(e) => { setPage(1); setRange({ ...range, endDate: e.target.value }); }} />
        </div>
      }>
        Trips, distance, punctuality and incidents for the selected dates.
      </PageHeader>

      {error && <p role="alert" className="p-3 rounded-md bg-signal-stock text-signal">{error}</p>}
      {!stats ? <RuledLines rows={3} /> : <Totals stats={stats} />}

      <div className="grid xl:grid-cols-[2fr_1fr] gap-8">
        <section className="ticket p-5">
          <h2 className="font-bold text-[18px] mb-4">Trips per day</h2>
          {!stats ? <RuledLines rows={5} /> : stats.perDay.length === 0 ? <p className="text-ink-soft">No trips in this period.</p> : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.perDay} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="bar-neon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={neon.cyan} />
                      <stop offset="1" stopColor={neon.violet} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" strokeDasharray="2 4" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} tick={{ fill: glass.text.muted, fontSize: 12 }} axisLine={{ stroke: glass.border }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: glass.text.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(62,230,255,.06)' }} contentStyle={{ background: glass.fillSolid, border: `1px solid ${glass.border}`, borderRadius: 12, fontFamily: 'Anek Latin', color: glass.text.primary, backdropFilter: 'blur(18px)' }}
                    itemStyle={{ color: neon.cyan }} labelStyle={{ color: glass.text.secondary }}
                    formatter={(v, name) => [v, name === 'trips' ? 'Trips' : name]} labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} />
                  <Bar dataKey="trips" fill="url(#bar-neon)" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="ticket p-5">
          <h2 className="font-bold text-[18px] mb-4">Incidents</h2>
          {!stats ? <RuledLines rows={4} /> : incidents.length === 0 ? <p className="text-ink-soft">No incidents in this period.</p> : (
            <ul className="space-y-3">
              {incidents.sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                <li key={type}>
                  <div className="flex justify-between text-[14px] mb-1"><span>{INCIDENT_TYPES[type] || type}</span><span className="num text-[18px]">{n}</span></div>
                  <div className="h-2.5 rounded-sm bg-paper overflow-hidden">
                    <div className="h-full rounded-sm transition-[width] duration-700 ease-out" style={{ width: `${(n / maxIncidents) * 100}%`, background: type === 'panic' ? neon.alert : type === 'off-route' || type === 'signal-lost' ? neon.pink : neon.amber }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="font-bold text-[20px] mb-4">Trip register</h2>
        {!trips ? <RuledLines rows={8} /> : trips.items.length === 0 ? (
          <EmptyTicket title="No trips in this period">Trips are recorded when drivers start and end them in the driver app.</EmptyTicket>
        ) : (
          <>
            <div className="ticket overflow-x-auto">
              <table className="waybill">
                <thead><tr><th>Started</th><th>Route</th><th>Bus</th><th>Driver</th><th>Duration</th><th className="text-right">Distance</th><th className="text-right">Delay</th><th>Notes</th></tr></thead>
                <tbody>
                  {trips.items.map((t) => (
                    <tr key={t._id}>
                      <td className="whitespace-nowrap tabular-nums">{new Date(t.startTime).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{t.route ? <RouteBadge route={t.route} size="sm" /> : '—'}</td>
                      <td>Bus {t.bus?.busNumber || '—'}</td>
                      <td>{t.driver?.name || '—'}</td>
                      <td className="whitespace-nowrap">{t.status === 'active' ? <Stamp kind="live">On the road</Stamp> : duration(t)}</td>
                      <td className="text-right tabular-nums">{(t.totalDistance / 1000).toFixed(1)} km</td>
                      <td className="text-right tabular-nums">{t.scheduledDeparture ? `${t.delayMinutes > 0 ? '+' : ''}${t.delayMinutes} min` : '—'}</td>
                      <td>
                        {t.breakdownReported && <Stamp kind="breakdown">Breakdown</Stamp>}
                        {t.locationWarnings > 0 && <span className="text-[13px] text-ink-soft ml-2">{t.locationWarnings} location warning{t.locationWarnings > 1 ? 's' : ''}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-[14px]">
              <span className="text-ink-soft">{trips.total} trips · page {trips.page} of {trips.pages}</span>
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page >= trips.pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
