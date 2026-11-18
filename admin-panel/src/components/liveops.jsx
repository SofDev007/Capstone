// Night Glass control-room pieces for the live map: KPI cards, live feed, replay scrubber, SOS overlay.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react';
import { Phone, Siren, History, X } from 'lucide-react';
import { EMERGENCY_NUMBER } from '@shared/incidents.js';
import { neon } from '@shared/theme/tokens.js';
import { incidentTitle, incidentSubtitle } from '@/lib/realtime';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1];
export const clock = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Number that counts up to its value (and between values). */
function CountUp({ value, decimals = 0, suffix = '' }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (value == null) return undefined;
    if (reduce) { setShown(value); from.current = value; return undefined; }
    const ctl = animate(from.current, value, { duration: 1.2, ease: EASE, onUpdate: setShown });
    from.current = value;
    return () => ctl.stop();
  }, [value, reduce]);
  return <>{value == null ? '–' : `${shown.toFixed(decimals)}${suffix}`}</>;
}

function Sparkline({ points, color }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1)) * 70} ${26 - ((p - min) / span) * 22}`).join(' ');
  return (
    <svg width="70" height="30" className="absolute right-2.5 bottom-2.5" aria-hidden="true">
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: EASE, delay: 0.3 }} />
    </svg>
  );
}

/** KPI glass cards; history is sampled by the caller. */
export function KpiCards({ kpis }) {
  return (
    <div className="flex gap-3">
      {kpis.map((k, i) => (
        <motion.div key={k.label} className="glass relative overflow-hidden w-[170px] h-[96px] px-3.5 py-3"
          initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.12 }}>
          <div className="serial text-ink-faint">{k.label}</div>
          <div className="kpi-num text-[32px] mt-1.5">
            <CountUp value={k.value} decimals={k.decimals} />
            {k.unit && k.value != null && <small className="text-[15px] text-ink-faint font-normal"> {k.unit}</small>}
          </div>
          <Sparkline points={k.history} color={k.color} />
        </motion.div>
      ))}
    </div>
  );
}

/** Live feed: new items slide in from the right, older ones shift down; SOS items pulse red. */
export function LiveFeed({ items, onItemClick }) {
  return (
    <section className="glass w-[290px] p-3.5" aria-label="Live feed" aria-live="polite">
      <h2 className="flex justify-between items-center text-[15px] font-bold mb-2.5">
        Live feed
        <span className="serial text-neon-lime flex items-center gap-1.5"><span className="live-dot" /> streaming</span>
      </h2>
      {items.length === 0 && <p className="text-[13.5px] text-ink-soft py-4">Stops reached, trips, delays and alerts will stream in here.</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.slice(0, 6).map((f) => (
            <motion.li key={f.id} layout
              initial={{ opacity: 0, x: 320 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.6, ease: EASE }}>
              <button type="button" onClick={() => onItemClick?.(f)}
                className={cn('glass-card relative w-full text-left min-h-[58px] pl-[46px] pr-3 py-2 text-[13px] hover:bg-white/[.08]',
                  f.sos && 'alert-lit')}>
                <span className="absolute left-3 top-[14px] w-6 h-6 rounded-lg grid place-items-center font-mono font-bold text-[11px] text-deep"
                  style={{ background: f.color }}>{f.badge}</span>
                <span className="block leading-snug">{f.title}</span>
                <small className="block font-mono text-[11px] text-ink-faint mt-0.5">{clock(f.at)}{f.meta ? ` · ${f.meta}` : ''}</small>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

export const REPLAY_WINDOW_S = 15 * 60;

/** Replay scrubber for the last 15 minutes (value = seconds back from now; 0 = live). */
export function ReplayScrubber({ secondsBack, onChange, events, note }) {
  const pct = (1 - secondsBack / REPLAY_WINDOW_S) * 100;
  const now = Date.now();
  return (
    <div className="glass h-[52px] flex items-center gap-3.5 px-4 text-[13px]">
      <span className="serial text-ink-faint">Replay</span>
      <span className="font-grotesk tabular-nums w-[58px]">{secondsBack ? `−${Math.ceil(secondsBack / 60)} min` : '−15 min'}</span>
      <div className="relative flex-1 h-4 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded bg-white/10" />
        <div className="absolute left-0 h-1.5 rounded bg-progress" style={{ width: `${pct}%` }} />
        {events.map((e) => {
          const back = (now - e.at) / 1000;
          if (back > REPLAY_WINDOW_S || back < 0) return null;
          return <span key={e.id} className="absolute w-1 h-3 rounded-sm -translate-x-1/2" style={{ left: `${(1 - back / REPLAY_WINDOW_S) * 100}%`, background: e.color }} title={e.title} />;
        })}
        <input type="range" min={0} max={REPLAY_WINDOW_S} step={5} value={REPLAY_WINDOW_S - secondsBack}
          onChange={(e) => onChange(REPLAY_WINDOW_S - Number(e.target.value))}
          aria-label="Replay the last 15 minutes" aria-valuetext={secondsBack ? `${Math.ceil(secondsBack / 60)} minutes ago` : 'Live'}
          className="replay-range absolute inset-0 w-full" />
      </div>
      <button type="button" onClick={() => onChange(0)} className={cn('font-semibold', secondsBack ? 'text-ink-soft hover:text-ink' : 'text-neon-lime')}>LIVE</button>
      {note && <span className="text-[12px] text-ink-faint max-w-[200px] leading-tight">{note}</span>}
    </div>
  );
}

/** Counts seconds since `at`. */
function Since({ at }) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  return <>{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</>;
}

/**
 * SOS choreography overlay: red glass toast (bottom-left) + radial action menu around the marker.
 * point: the bus's screen position (map.project), updated by the caller on camera moves.
 */
export function SosOverlay({ sos, point, driverPhone, onTrail, onDismiss }) {
  const reduce = useReducedMotion();
  const actions = [
    { key: 'call', label: 'Call driver', short: 'CALL', icon: Phone, href: driverPhone ? `tel:${driverPhone}` : null, red: true },
    { key: '112', label: `Call ${EMERGENCY_NUMBER}`, short: EMERGENCY_NUMBER, icon: Siren, href: `tel:${EMERGENCY_NUMBER}` },
    { key: 'trail', label: 'Show trail', short: 'TRAIL', icon: History, onClick: onTrail }
  ];
  return (
    // AnimatePresence needs its keyed children directly (not inside a Fragment), or exits never finish.
    <AnimatePresence>
      {sos && [
          <motion.div key={`toast-${sos.incident._id}`} role="alert"
            className="glass absolute left-[90px] bottom-[84px] w-[380px] px-4 py-3.5 z-20 !border-signal/60 !bg-[rgba(60,10,22,.7)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 90, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 40, transition: { duration: 0.2 } }} transition={reduce ? { duration: 0.2 } : { type: 'spring', damping: 14, stiffness: 180 }}>
            <button type="button" onClick={onDismiss} className="absolute top-2.5 right-2.5 p-1.5 rounded-lg hover:bg-white/10" aria-label="Dismiss and return the camera">
              <X size={16} />
            </button>
            <b className="font-mono text-[12px] tracking-[.14em] text-signal">● {sos.incident.source === 'driver' ? 'DRIVER' : 'PASSENGER'} SOS · <Since at={sos.at} /></b>
            <div className="text-[17px] font-bold mt-1.5">{incidentTitle(sos.incident)}</div>
            <div className="text-[13px] text-[#E3B9C3] mt-0.5">{incidentSubtitle(sos.incident) || 'Location shared with the control room'}</div>
            <a href={`/alerts?id=${sos.incident._id}`} className="inline-block mt-2 text-[13px] font-semibold underline underline-offset-4">Open in alerts</a>
          </motion.div>,
          ...(!point ? [] : actions.map((a, i) => {
            const angle = ((-150 + i * 55) * Math.PI) / 180;
            const x = Math.cos(angle) * 84;
            const y = Math.sin(angle) * 84;
            const Tag = a.href ? 'a' : 'button';
            const disabled = !a.href && !a.onClick;
            return (
              <motion.div key={`${a.key}-${sos.incident._id}`} className="absolute z-20" style={{ left: point.x, top: point.y }}
                initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }} animate={{ x, y, scale: 1, opacity: 1 }} exit={{ x: 0, y: 0, scale: 0.3, opacity: 0, transition: { duration: 0.2 } }}
                transition={reduce ? { duration: 0.15 } : { type: 'spring', damping: 12, stiffness: 200, delay: 0.4 + i * 0.12 }}>
                <Tag {...(a.href ? { href: a.href } : { type: 'button', onClick: a.onClick, disabled })} aria-label={a.label} title={a.label}
                  className={cn('glass !rounded-full -ml-[26px] -mt-[26px] w-[52px] h-[52px] grid place-items-center text-[10.5px] font-bold font-mono hover:scale-105 transition-transform',
                    a.red && '!bg-signal/85 !border-transparent text-deep', disabled && 'opacity-40 cursor-not-allowed')}>
                  <span className="flex flex-col items-center gap-0.5"><a.icon size={15} />{a.short}</span>
                </Tag>
              </motion.div>
            );
          }))
      ]}
    </AnimatePresence>
  );
}

export const FEED_COLORS = { sos: neon.alert, warn: neon.amber, flag: neon.pink, ok: neon.lime, info: neon.cyan };
