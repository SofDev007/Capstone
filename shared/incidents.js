// Incident types and panic reasons. Reason ids are stored in the DB and translated in the apps
// via i18n keys `panic.reasons.<id>`; the English labels here are the fallback (and admin display).

export const INCIDENT_TYPES = {
  panic: 'Panic button',
  breakdown: 'Bus breakdown',
  'location-off': 'Driver location off',
  'off-route': 'Bus off route',
  'signal-lost': 'Signal lost',
};

export const DRIVER_PANIC_REASONS = [
  { id: 'medical', label: 'Medical emergency' },
  { id: 'accident', label: 'Accident' },
  { id: 'assault', label: 'Assault / harassment' },
  { id: 'robbery', label: 'Robbery / theft' },
  { id: 'fire', label: 'Vehicle fire' },
  { id: 'unruly-passenger', label: 'Unruly passenger' },
  { id: 'other', label: 'Other' },
];

export const PASSENGER_PANIC_REASONS = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'medical', label: 'Medical emergency' },
  { id: 'unsafe-driving', label: 'Unsafe driving' },
  { id: 'theft', label: 'Theft' },
  { id: 'accident', label: 'Accident' },
  { id: 'feeling-unsafe', label: 'Feeling unsafe' },
  { id: 'other', label: 'Other' },
];

export const ALL_PANIC_REASON_IDS = [
  ...new Set([...DRIVER_PANIC_REASONS, ...PASSENGER_PANIC_REASONS].map((r) => r.id)),
];

export function reasonLabel(id) {
  return [...DRIVER_PANIC_REASONS, ...PASSENGER_PANIC_REASONS].find((r) => r.id === id)?.label || id || 'Not specified';
}

/** India's single emergency number. */
export const EMERGENCY_NUMBER = '112';
