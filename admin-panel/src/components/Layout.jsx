import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Map, Siren, UserCheck, Route as RouteIcon, Bus, Users, BarChart3, LogOut } from 'lucide-react';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid },
  { to: '/map', label: 'Live map', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: Siren, badge: (s) => s?.openIncidents?.total, urgent: (s) => s?.openIncidents?.panic },
  { to: '/applications', label: 'Driver applications', icon: UserCheck, badge: (s) => s?.pendingApplications },
  { to: '/routes', label: 'Routes & stops', icon: RouteIcon },
  { to: '/buses', label: 'Buses', icon: Bus },
  { to: '/drivers', label: 'Drivers', icon: Users },
  { to: '/analytics', label: 'Reports', icon: BarChart3 }
];

const EASE = [0.16, 1, 0.3, 1];

/** Slow aurora behind everything (static under reduced motion — see index.css). */
export function Aurora() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
    </div>
  );
}

function Tip({ children }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap glass !rounded-[10px] px-2.5 py-1 text-[13px] font-semibold text-ink opacity-0 -translate-x-1 transition duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

/** Floating glass icon dock; the active item is a gradient pill that slides between items. */
function Dock({ onLogout }) {
  const { summary, connected } = useRealtime();
  return (
    <nav aria-label="Main navigation" className="glass !rounded-[28px] fixed left-4 top-1/2 -translate-y-1/2 z-40 w-14 py-2.5 flex flex-col items-center gap-2">
      <div className="h-9 w-9 grid place-items-center mb-1" title="Depot — City Bus Tracker">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <path fill="#EAF0FF" d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v6a3 3 0 0 0 0 6v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 0 0-6z" />
          <circle cx="21" cy="16" r="3.2" fill="#04060C" />
          <path stroke="#04060C" strokeWidth="2.4" strokeLinecap="round" d="M9 11h7M9 16h5M9 21h7" />
        </svg>
      </div>
      {NAV.map(({ to, label, icon: Icon, badge, urgent }) => {
        const count = badge?.(summary) || 0;
        const isUrgent = urgent?.(summary) > 0;
        return (
          <NavLink key={to} to={to} end={to === '/'} aria-label={count ? `${label} (${count})` : label}
            className={({ isActive }) => cn('group relative h-[38px] w-[38px] rounded-full grid place-items-center transition-colors duration-150',
              isActive ? 'text-deep' : 'text-ink-soft hover:text-ink hover:bg-white/[.07]')}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-full bg-accent shadow-glow"
                    transition={{ type: 'spring', damping: 22, stiffness: 260 }} />
                )}
                <Icon size={18} className="relative" />
                {count > 0 && (
                  <span className={cn('absolute -top-1 -right-1 kpi-num text-[11px] min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center',
                    isUrgent ? 'bg-signal text-deep' : 'bg-buff-ink text-deep',
                    urgent && 'animate-[badge-pulse_1.6s_ease-out_infinite]')}>{count}</span>
                )}
                <Tip>{label}</Tip>
              </>
            )}
          </NavLink>
        );
      })}
      <div className="w-6 h-px bg-glass-border my-1" />
      <span className="group relative h-[38px] w-[38px] grid place-items-center" tabIndex={0} aria-label={connected ? 'Live updates connected' : 'Reconnecting…'}>
        <span className={cn('h-2 w-2 rounded-full', connected ? 'live-dot' : 'bg-buff-ink animate-pulse')} />
        <Tip>{connected ? 'Live' : 'Reconnecting…'}</Tip>
      </span>
      <button type="button" onClick={onLogout} className="group relative h-[38px] w-[38px] rounded-full grid place-items-center text-ink-soft hover:text-ink hover:bg-white/[.07]" aria-label="Sign out">
        <LogOut size={17} />
        <Tip>Sign out</Tip>
      </button>
    </nav>
  );
}

/** Persistent emergency strip: stays lit until every SOS is acknowledged. */
function SosBanner() {
  const { summary } = useRealtime();
  const navigate = useNavigate();
  const open = summary?.openIncidents?.panic || 0;
  return (
    <AnimatePresence>
      {open > 0 && (
        <motion.button
          type="button"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', damping: 14, stiffness: 180 }}
          onClick={() => navigate('/alerts')}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 glass !rounded-full !border-signal/60 !bg-[rgba(60,10,22,.75)] text-left"
        >
          <span className="flex items-center gap-3 px-5 py-2 font-semibold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal" />
            </span>
            {open === 1 ? '1 SOS alert needs a response' : `${open} SOS alerts need a response`}
            <span className="ml-3 text-signal underline underline-offset-4">Open alerts</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default function Layout({ children, setIsAuthenticated, fullBleed = false }) {
  const { pathname } = useLocation();
  const underDock = pathname === '/map'; // the live map runs full-bleed under the floating dock

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  return (
    <div className="relative h-screen overflow-hidden bg-deep">
      <Aurora />
      <Dock onLogout={logout} />
      <SosBanner />
      <main className={cn('relative h-full', fullBleed ? 'overflow-hidden' : 'overflow-y-auto', !underDock && 'pl-[88px]')}>
        {fullBleed ? children : <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8">{children}</div>}
      </main>
    </div>
  );
}

/** Page heading: title + one line of context + actions. No eyebrows. */
export function PageHeader({ title, children, actions }) {
  return (
    <header className="flex flex-wrap items-end gap-4 justify-between mb-8">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {children && <p className="text-ink-soft mt-1 max-w-[70ch]">{children}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
