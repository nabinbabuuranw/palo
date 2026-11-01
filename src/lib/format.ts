export const fmtTime = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60; const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const npr = (n: number) => 'Rs ' + n.toLocaleString('en-IN');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const d0 = (date: string) => new Date(date + 'T00:00:00Z');
export const weekday = (date: string) => d0(date).getUTCDay();
export const dayShort = (date: string) => DAYS[weekday(date)];
export const fmtDate = (date: string) => { const d = d0(date); return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const fmtDateLong = (date: string) => { const d = d0(date); return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const dayNum = (date: string) => d0(date).getUTCDate();
export const monShort = (date: string) => MONTHS[d0(date).getUTCMonth()];
export function addDays(date: string, n: number) { const d = d0(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function ktmToday() { const d = new Date(Date.now() + 345 * 60000); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
export const ago = (ms: number) => {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const CATEGORY_LABEL: Record<string, string> = { clinic: 'Clinic', dental: 'Dental', salon: 'Salon', barber: 'Barber', spa: 'Spa', physio: 'Physiotherapy', tutor: 'Tutor / class', other: 'Other service' };
export const STATUS_LABEL: Record<string, string> = { pending: 'Waiting', confirmed: 'Confirmed', completed: 'Done', cancelled: 'Cancelled', no_show: 'No-show' };
