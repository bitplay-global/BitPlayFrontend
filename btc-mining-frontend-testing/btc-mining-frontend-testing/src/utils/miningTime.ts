/**
 * Mining time helpers.
 *
 * The backend currently parses `local_time` / `local_start_time` by extracting
 * digits and assumes the format is:
 *   DD/MM/YYYY, hh:mm:ss AM|PM
 *
 * Using `toLocaleString()` is locale-dependent (MM/DD vs DD/MM) and can cause
 * incorrect mining calculations. These helpers standardize the format.
 */

export function formatMiningLocalTimeForApi(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());

  let hours = date.getHours(); // 0-23
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hh = String(hours).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${sec} ${ampm}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function secondsUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

