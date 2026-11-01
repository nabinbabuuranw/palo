import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { api, ApiError, errorText, type Service } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { addDays, dayNum, dayShort, fmtDate, fmtTime, monShort, npr } from '../lib/format';
import { Button, Field, Input, Textarea, Skeleton, ErrorBox } from './ui';
import { Token } from './Token';
import { IconChevronLeft, IconChevronRight } from './Icons';

interface Pub { business: any; services: Service[]; hours: { weekday: number; closed: number }[]; blocks: { date: string; reason: string }[]; today: string; max_days: number }
interface Slot { time: string; min: number; left: number }

export function BookingFlow({ slug, compact = false, onBooked }: { slug: string; compact?: boolean; onBooked?: () => void }) {
  const pub = useApi<Pub>(`/public/b/${slug}`);
  const { user } = useAuth();
  const [svc, setSvc] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<{ loading: boolean; items: Slot[]; closed: string | null; error: string | null }>({ loading: false, items: [], closed: null, error: null });
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [booked, setBooked] = useState<any>(null);
  const [auto, setAuto] = useState(true); // until the visitor picks a day, skip forward past days with no free time
  const days = compact ? 5 : 7;
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { if (booked && top.current) { const r = top.current.getBoundingClientRect(); if (r.top < 70) window.scrollBy({ top: r.top - 90, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }, [booked]);

  useEffect(() => { if (user) setForm((f) => ({ ...f, name: f.name || user.name, phone: f.phone || user.phone || '', email: f.email || user.email })); }, [user]);
  useEffect(() => { if (pub.data && !svc && pub.data.services[0]) setSvc(pub.data.services[0].id); if (pub.data && !date) setDate(pub.data.today); }, [pub.data]);
  const loadSlots = async () => {
    if (!svc || !date) return;
    setSlots((s) => ({ ...s, loading: true, error: null })); setSlot(null);
    try { const r = await api<{ slots: Slot[]; closed: string | null }>(`/public/b/${slug}/slots?date=${date}&service=${svc}`); if (auto && pub.data && !r.slots.some((x) => x.left > 0) && date < addDays(pub.data.today, 13)) { const next = addDays(date, 1); setDate(next); const idx = Math.floor((Math.round((Date.parse(next) - Date.parse(pub.data.today)) / 86400000)) / days) * days; setOffset(idx); return; }
      setAuto(false); setSlots({ loading: false, items: r.slots, closed: r.closed, error: null }); }
    catch (e) { setSlots({ loading: false, items: [], closed: null, error: errorText(e) }); }
  };
  useEffect(() => { loadSlots(); }, [svc, date]);

  const strip = useMemo(() => pub.data ? Array.from({ length: days }, (_, i) => addDays(pub.data!.today, offset + i)) : [], [pub.data, offset, days]);
  const closedDay = (d: string) => { if (!pub.data) return false; const wd = new Date(d + 'T00:00:00Z').getUTCDay(); return !!pub.data.hours.find((h) => h.weekday === wd && h.closed) || pub.data.blocks.some((b) => b.date === d); };
  const service = pub.data?.services.find((s) => s.id === svc);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!slot || !svc || !date) return;
    setBusy(true); setErr(null); setFields({});
    try {
      const r = await api<{ booking: any }>(`/public/b/${slug}/book`, { body: { service_id: svc, date, time: slot.time, ...form } });
      setBooked(r.booking); onBooked?.();
    } catch (e) {
      if (e instanceof ApiError) { setFields(e.fields); if (e.code === 'slot_taken') loadSlots(); }
      setErr(errorText(e));
    } finally { setBusy(false); }
  };

  if (pub.loading) return <div className="flex flex-col gap-4" role="status" aria-label="Loading booking"><Skeleton className="h-11" /><div className="flex gap-2">{Array.from({ length: days }, (_, i) => <Skeleton key={i} className="h-16 flex-1" />)}</div><div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div></div>;
  if (pub.error || !pub.data) return <ErrorBox message={pub.error || 'Could not load this booking page.'} onRetry={() => pub.reload()} />;
  if (booked) return (
    <div ref={top} className="flex flex-col gap-6">
      <Token booking={booked} />
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="line" onClick={() => { setBooked(null); setSlot(null); loadSlots(); }}>Book another</Button>
        {user?.role === 'customer' ? <a href="/me" className="inline-flex h-11 items-center px-5 rounded bg-pine text-paper">See my bookings</a> : !user ? <a href="/register" className="inline-flex h-11 items-center px-5 rounded text-ink-2 hover:text-ink underline underline-offset-4">Create an account to track bookings</a> : null}
      </div>
    </div>
  );
  if (pub.data.services.length === 0) return <p className="text-muted">This business has not added any services yet, so online booking is not open.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">1 · Service</p>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`} role="radiogroup" aria-label="Service">
          {pub.data.services.slice(0, compact ? 3 : 50).map((s) => (
            <button key={s.id} role="radio" aria-checked={svc === s.id} onClick={() => setSvc(s.id)}
              className={`text-left px-3.5 py-2.5 rounded border focus-ring transition-colors ${svc === s.id ? 'border-pine bg-pine-soft/50' : 'border-line-2 bg-card hover:border-ink-2'}`}>
              <span className="flex items-baseline justify-between gap-3"><span className="font-medium text-ink">{s.name}</span><span className="text-sm tnum text-ink-2 shrink-0">{s.price_npr ? npr(s.price_npr) : 'Free'}</span></span>
              <span className="text-xs text-muted">{s.duration_min} min</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">2 · Day</p>
          <div className="flex gap-1">
            <button className="p-1.5 rounded hover:bg-sunk disabled:opacity-30 focus-ring" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - days))} aria-label="Earlier days"><IconChevronLeft size={18} /></button>
            <button className="p-1.5 rounded hover:bg-sunk disabled:opacity-30 focus-ring" disabled={offset + days >= pub.data.max_days} onClick={() => setOffset((o) => o + days)} aria-label="Later days"><IconChevronRight size={18} /></button>
          </div>
        </div>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Day">
          {strip.map((d) => {
            const closed = closedDay(d); const sel = d === date;
            return (
              <button key={d} role="radio" aria-checked={sel} aria-label={`${fmtDate(d)}${closed ? ', closed' : ''}`} onClick={() => { setAuto(false); setDate(d); }}
                className={`relative flex-1 min-w-0 py-2 rounded border text-center focus-ring transition-colors ${sel ? 'border-ink bg-ink text-paper' : closed ? 'border-line text-muted/60 bg-transparent' : 'border-line-2 bg-card hover:border-ink-2'}`}>
                <span className="block text-[10px] uppercase tracking-wider">{d === pub.data!.today ? 'Today' : dayShort(d)}</span>
                <span className="block font-display text-xl leading-tight tnum">{dayNum(d)}</span>
                <span className="block text-[10px]">{monShort(d)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="eyebrow mb-2">3 · Time {date && <span className="normal-case tracking-normal font-normal">· {fmtDate(date)}</span>}</p>
        {slots.loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="status" aria-label="Loading times">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : slots.error ? <ErrorBox message={slots.error} onRetry={loadSlots} />
          : slots.closed ? <p className="text-sm text-muted py-3">{slots.closed}. Try another day.</p>
            : slots.items.filter((s) => s.left > 0).length === 0 ? <p className="text-sm text-muted py-3">No free times left this day. Try another day.</p>
              : (
                <m.div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'} gap-2`} role="radiogroup" aria-label="Time" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.02 } } }}>
                  {slots.items.map((s) => (
                    <m.button key={s.time} variants={{ hide: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0 } }} role="radio" aria-checked={slot?.time === s.time} disabled={s.left === 0}
                      onClick={() => setSlot(s)} aria-label={`${fmtTime(s.min)}${s.left === 0 ? ', taken' : ''}`}
                      className={`h-10 rounded border text-sm tnum focus-ring transition-colors ${slot?.time === s.time ? 'border-sindoor bg-sindoor text-paper' : s.left === 0 ? 'border-line text-muted/50 line-through cursor-not-allowed' : 'border-line-2 bg-card hover:border-ink-2'}`}>
                      {fmtTime(s.min)}
                    </m.button>
                  ))}
                </m.div>
              )}
      </div>
      <AnimatePresence initial={false}>
        {slot && (
          <m.form key="form" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: [0.22, 0.8, 0.24, 1] }} className="overflow-hidden" noValidate>
            <div className="flex flex-col gap-3 pt-1">
              <p className="eyebrow">4 · Your details</p>
              <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
                <Field label="Full name" error={fields.name}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!fields.name} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}</Field>
                <Field label="Mobile number" error={fields.phone} hint="The business may call to confirm">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!fields.phone} inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />}</Field>
              </div>
              {!compact && <Field label="Email (optional)" error={fields.email}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!fields.email} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>}
              {!compact && <Field label="Note for the business (optional)" error={fields.note}>{(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>}
              {err && <p className="text-sm text-sindoor" role="alert">{err}</p>}
              <Button type="submit" busy={busy} className="w-full sm:w-auto">Book {service?.name} · {date && fmtDate(date)}, {fmtTime(slot.min)}</Button>
              <p className="text-xs text-muted">By booking you agree to the <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>. {pub.data.business.payment_note}</p>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  );
}
