// Ticket Stock primitives (see DESIGN.md): Ticket, Stamp, RouteBadge, StageStrip, Serial.
import { useEffect, useRef, useState } from 'react';
import { neon, neonForRoute, neonForStock, glass } from '@shared/theme/tokens.js';
import { cn } from '@/lib/utils';

// Night Glass status colours (DESIGN.md › Night Glass): live → lime, delayed → amber,
// off-route / signal lost → pink, emergency → alert.
const STAMP_NEON = {
  live: neon.lime, onTime: neon.lime, approved: neon.lime,
  delayed: neon.amber, breakdown: neon.amber, pending: neon.amber,
  offRoute: neon.pink, stale: neon.pink, rejected: neon.pink,
  info: neon.cyan, emergency: neon.alert
};

export function Serial({ className, children }) {
  return <span className={cn('serial text-ink-faint', className)}>{children}</span>;
}

/** Rubber stamp. kind: live | delayed | breakdown | offRoute | stale | info | pending | approved | rejected | emergency */
export function Stamp({ kind = 'live', land = false, className, children }) {
  return (
    <span className={cn('stamp', land && 'stamp-land', className)} style={{ color: STAMP_NEON[kind] || neon.cyan }}>
      {children}
    </span>
  );
}

export function RouteBadge({ route, size = 'md', className }) {
  if (!route) return <span className="serial text-ink-faint">No route</span>;
  return (
    <span
      className={cn(
        'kpi-num inline-flex items-center justify-center rounded-sm',
        size === 'lg' ? 'text-[34px] min-w-[52px] h-[44px] px-2' : size === 'sm' ? 'text-[15px] min-w-[26px] h-[22px] px-1.5' : 'text-[20px] min-w-[34px] h-[28px] px-2',
        className
      )}
      style={{ background: neonForRoute(route), color: glass.bg.deep }}
      title={route.name || `Route ${route.number}`}
    >
      {route.number}
    </span>
  );
}

/**
 * A ticket: body + perforation + stub. The stub carries the one number that matters.
 * notchBg must match the surface the ticket sits on (for the cut-out notches).
 */
export function Ticket({ stub, stubStock, selected, onClick, className, bodyClassName, notchBg, children, as: As = 'div', ...rest }) {
  const interactive = Boolean(onClick);
  return (
    <As
      onClick={onClick}
      className={cn(
        'ticket flex overflow-visible transition-[transform,box-shadow] duration-200 ease-out',
        interactive && 'cursor-pointer hover:-translate-y-px hover:shadow-lifted text-left w-full',
        selected && 'shadow-lifted -translate-y-px ring-2 ring-neon-cyan/70',
        className
      )}
      {...rest}
    >
      <div className={cn('flex-1 min-w-0 p-4', bodyClassName)}>{children}</div>
      {stub !== undefined && (
        <>
          <div className="perf-v" style={notchBg ? { '--notch-bg': notchBg } : undefined} />
          <div
            className="flex flex-col items-center justify-center px-4 min-w-[88px] rounded-r-md transition-transform duration-300 ease-out"
            style={stubStock ? { background: `${neonForStock(stubStock)}1F`, color: neonForStock(stubStock) } : undefined}
          >
            {stub}
          </div>
        </>
      )}
    </As>
  );
}

/** Freshness of a live position. */
export function ageSeconds(date) {
  return date ? Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000)) : Infinity;
}

export function timeAgo(date) {
  const s = ageSeconds(date);
  if (s === Infinity) return 'never';
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Stamps for a live bus: the most important state first. */
export function busStamps(bus, { status } = {}) {
  const out = [];
  if (status === 'breakdown') out.push(['breakdown', 'Breakdown']);
  if (!bus) return out;
  if (bus.offRoute) out.push(['offRoute', 'Off route']);
  if (ageSeconds(bus.lastUpdate) > 60) out.push(['stale', 'Stale']);
  else if (bus.delayMinutes > 5) out.push(['delayed', `${bus.delayMinutes} min late`]);
  else out.push(['live', 'Live']);
  return out;
}

/** Re-render every `ms` so "x s ago" labels stay honest. */
export function useTick(ms = 5000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/**
 * Signature: the stage strip. One punch hole per stop; stops the bus has passed are punched out.
 * When nextIndex advances, the newly passed hole punches and its paper chad falls away.
 */
export function StageStrip({ stops, nextIndex = 0, route, showLabels = false, className }) {
  const ink = neonForRoute(route);
  const prev = useRef(nextIndex);
  const [chads, setChads] = useState([]);

  useEffect(() => {
    if (nextIndex > prev.current) {
      const fresh = [];
      for (let i = prev.current; i < nextIndex; i++) fresh.push({ i, key: `${i}-${Date.now()}` });
      setChads((c) => [...c, ...fresh]);
      setTimeout(() => setChads((c) => c.filter((x) => !fresh.includes(x))), 500);
    }
    prev.current = nextIndex;
  }, [nextIndex]);

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center" role="list" aria-label="Stops on this route">
        {stops.map((stop, i) => (
          <div key={stop.id || i} className="flex items-center flex-1 last:flex-none min-w-0" role="listitem">
            <div className="relative flex flex-col items-center">
              <span
                className="hole"
                data-punched={i < nextIndex}
                data-next={i === nextIndex}
                style={{ '--hole-ring': i < nextIndex ? ink : undefined }}
                title={`${stop.name}${i < nextIndex ? ' (passed)' : i === nextIndex ? ' (next)' : ''}`}
              />
              {chads.filter((c) => c.i === i).map((c) => (
                <span
                  key={c.key}
                  className="absolute top-0 left-0 w-3 h-3 rounded-full border-2"
                  style={{ borderColor: ink, animation: 'punch-chad 420ms cubic-bezier(0.16,1,0.3,1) forwards' }}
                />
              ))}
            </div>
            {i < stops.length - 1 && (
              <span className="h-[2px] flex-1 mx-0.5" style={{ background: i < nextIndex ? ink : 'var(--strip, #262E44)', boxShadow: i < nextIndex ? `0 0 6px ${ink}` : undefined }} />
            )}
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1.5 text-[12.5px] text-ink-soft gap-2">
          <span className="truncate">{stops[0]?.name}</span>
          {stops[nextIndex] && nextIndex > 0 && nextIndex < stops.length - 1 && (
            <span className="truncate font-semibold text-ink">Next: {stops[nextIndex].name}</span>
          )}
          <span className="truncate text-right">{stops[stops.length - 1]?.name}</span>
        </div>
      )}
    </div>
  );
}

/** Empty / error states keep the ticket language: a blank ticket with a printed line. */
export function EmptyTicket({ title, children, action }) {
  return (
    <div className="ticket border-dashed shadow-none p-8 text-center bg-transparent">
      <p className="font-semibold text-[17px]">{title}</p>
      {children && <p className="text-ink-soft mt-1 max-w-[52ch] mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Loading placeholder: ruled lines, not grey blocks. */
export function RuledLines({ rows = 4 }) {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 rounded-sm bg-rule/50 animate-pulse" style={{ width: `${90 - (i % 3) * 18}%` }} />
      ))}
    </div>
  );
}
