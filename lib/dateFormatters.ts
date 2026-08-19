/**
 * Centralised date/time formatting utilities.
 * All user-visible times use 24-hour cycle (hourCycle: 'h23').
 *
 * Rules:
 * - Locale: 'es-AR'
 * - hourCycle: 'h23' (00–23, cross-browser safe)
 * - Does NOT alter timezone, stored data, or ISO strings.
 * - Only for UI rendering.
 */

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DATE_TIME_SECONDS_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toSafeDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date+time string for display: "DD/MM/AAAA, HH:mm" (24h).
 * Returns '—' for invalid dates.
 */
export function formatDateTime24h(value: string | Date): string {
  const d = toSafeDate(value);
  if (!d) return '—';
  return DATE_TIME_FORMATTER.format(d);
}

/**
 * Format time only: "HH:mm" (24h).
 * Returns '—' for invalid dates.
 */
export function formatTime24h(value: string | Date): string {
  const d = toSafeDate(value);
  if (!d) return '—';
  return TIME_FORMATTER.format(d);
}

/**
 * Format date+time+seconds: "DD/MM/AAAA, HH:mm:ss" (24h).
 * Returns '—' for invalid dates.
 */
export function formatDateTimeSeconds24h(value: string | Date): string {
  const d = toSafeDate(value);
  if (!d) return '—';
  return DATE_TIME_SECONDS_FORMATTER.format(d);
}

/**
 * Extract only the date part: "DD/MM/AAAA".
 * Returns '—' for invalid dates.
 */
export function formatDateOnly(value: string | Date): string {
  const d = toSafeDate(value);
  if (!d) return '—';
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
