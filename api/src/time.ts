// Kathmandu time helpers. Nepal is UTC+05:45 all year (no daylight saving).
export const KTM_OFFSET_MIN = 345;
export const MAX_DAYS_AHEAD = 60;
export function ktmNow(nowMs = Date.now()): { date: string; min: number } {
  const d = new Date(nowMs + KTM_OFFSET_MIN * 60000);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export function parseDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}
export function parseTime(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const fmtTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay();

export interface SlotInput {
  date: string; open: number | null; close: number | null; closed: boolean; duration: number; step: number; capacity: number;
  booked: { start_min: number; end_min: number }[]; nowDate: string; nowMin: number; leadMin: number;
}
// A slot is offered when the whole service fits before closing, it starts after now + lead time,
// and fewer than `capacity` live bookings overlap it.
export function computeSlots(i: SlotInput): { time: string; min: number; left: number }[] {
  if (i.closed || i.open === null || i.close === null || i.date < i.nowDate) return [];
  const out: { time: string; min: number; left: number }[] = [];
  const earliest = i.date === i.nowDate ? i.nowMin + i.leadMin : -1;
  for (let t = i.open; t + i.duration <= i.close; t += i.step) {
    if (t < earliest) continue;
    const overlap = i.booked.filter((b) => b.start_min < t + i.duration && b.end_min > t).length;
    out.push({ time: fmtTime(t), min: t, left: Math.max(0, i.capacity - overlap) });
  }
  return out;
}
