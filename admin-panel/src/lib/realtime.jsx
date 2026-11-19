// One authenticated Socket.IO connection for the whole admin app.
// Provides live bus positions, open-incident / pending-application counts, and alert notifications.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { SOCKET_URL, getToken, adminAPI } from './api';
import { INCIDENT_TYPES, reasonLabel } from '@shared/incidents.js';

const RealtimeContext = createContext(null);

// Two-tone alarm generated with WebAudio (no asset to load). Browsers only allow it after a user gesture.
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i % 2 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.26);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // audio unavailable
  }
}

export const incidentTitle = (i) =>
  i.type === 'panic'
    ? `SOS from ${i.source === 'driver' ? `driver ${i.driver?.name || ''}` : 'a passenger'}`.trim()
    : INCIDENT_TYPES[i.type] || 'Incident';

export const incidentSubtitle = (i) => [
  i.bus?.busNumber && `Bus ${i.bus.busNumber}`,
  i.type === 'panic' ? reasonLabel(i.reason) : i.note
].filter(Boolean).join(' · ');

export function RealtimeProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [buses, setBuses] = useState({}); // busId -> busView
  const [summary, setSummary] = useState(null);
  const listeners = useRef(new Set());
  const socketRef = useRef(null);

  const refreshSummary = useCallback(() => {
    adminAPI.summary().then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshSummary();
    const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token: getToken() } });
    socketRef.current = socket;
    const emit = (event, data) => listeners.current.forEach((fn) => fn(event, data));

    socket.on('connect', () => { setConnected(true); refreshSummary(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('location-update', (bus) => {
      setBuses((prev) => ({ ...prev, [bus.busId]: bus }));
      emit('location-update', bus);
    });
    const tripChanged = (event) => (data) => {
      if (event === 'trip-ended') setBuses((prev) => { const next = { ...prev }; delete next[data.busId]; return next; });
      refreshSummary();
      emit(event, data);
    };
    socket.on('trip-started', tripChanged('trip-started'));
    socket.on('trip-ended', tripChanged('trip-ended'));
    // The toast comes from the breakdown's incident:new (with an Open button); this keeps maps/lists fresh.
    socket.on('breakdown-alert', (data) => emit('breakdown-alert', data));
    socket.on('incident:new', (incident) => {
      refreshSummary();
      const emergency = incident.type === 'panic';
      const title = incidentTitle(incident);
      toast[emergency ? 'error' : 'warning'](title, {
        description: incidentSubtitle(incident),
        duration: emergency ? Infinity : 8000,
        action: { label: 'Open', onClick: () => { window.location.href = `/alerts?id=${incident._id}`; } }
      });
      if (emergency) playAlarm();
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: incidentSubtitle(incident), tag: incident._id, requireInteraction: emergency });
      }
      emit('incident:new', incident);
    });
    socket.on('incident:update', (incident) => { refreshSummary(); emit('incident:update', incident); });
    socket.on('application:new', (app) => {
      refreshSummary();
      toast(`New driver application — ${app.name}`, {
        description: app.city,
        action: { label: 'Review', onClick: () => { window.location.href = '/applications'; } }
      });
      emit('application:new', app);
    });
    socket.on('application:update', (app) => { refreshSummary(); emit('application:update', app); });

    return () => socket.close();
  }, [refreshSummary]);

  // Title badge so a background tab still shows open alerts.
  useEffect(() => {
    const open = summary?.openIncidents?.panic || 0;
    document.title = open ? `(${open}) SOS — Depot` : 'Depot — City Bus Tracker';
  }, [summary]);

  /** Subscribe to realtime events: fn(event, data). Returns an unsubscribe function. */
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const value = useMemo(() => ({ connected, buses, setBuses, summary, refreshSummary, subscribe }), [connected, buses, summary, refreshSummary, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

/** Run fn(event, data) for realtime events while the component is mounted. */
export function useRealtimeEvents(fn) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((event, data) => ref.current(event, data)), [subscribe]);
}
