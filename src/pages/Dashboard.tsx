import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { api, ApiError, errorText, type Appointment, type Service } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { Link } from '../lib/router';
import { useRequireRole, AccountSettings } from './Me';
import { addDays, CATEGORY_LABEL, DAY_NAMES, dayNum, dayShort, fmtDate, fmtDateLong, fmtTime, hhmm, ktmToday, npr, ago, STATUS_LABEL } from '../lib/format';
import { BarChart } from '../components/BarChart';
import { Button, Empty, ErrorBox, Field, Input, Modal, Select, Skeleton, SkeletonRows, StatusPill, Textarea, toast } from '../components/ui';
import { IconCalendar, IconChart, IconChevronLeft, IconChevronRight, IconClock, IconGear, IconList, IconPeople, IconPlus, IconSearch, IconStore, IconToken, IconBlock } from '../components/Icons';

const SECTIONS = [
  { id: 'today', label: 'Day sheet', icon: IconToken }, { id: 'calendar', label: 'Week', icon: IconCalendar },
  { id: 'appointments', label: 'Appointments', icon: IconList }, { id: 'customers', label: 'Customers', icon: IconPeople },
  { id: 'services', label: 'Services', icon: IconStore }, { id: 'hours', label: 'Hours & holidays', icon: IconClock },
  { id: 'insights', label: 'Insights', icon: IconChart }, { id: 'settings', label: 'Settings', icon: IconGear },
];
interface BizData { business: any; services: Service[]; hours: any[]; blocks: { id: number; date: string; reason: string }[]; today: { date: string; min: number } }

export default function Dashboard({ section }: { section: string }) {
  const ok = useRequireRole('owner');
  const biz = useApi<BizData>(ok ? '/biz' : null);
  const { business } = useAuth();
  const current = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  useEffect(() => { document.title = `${current.label} · Palo dashboard`; }, [current]);
  if (!ok) return <div className="p-8"><SkeletonRows /></div>;
  return (
    <div className="lg:grid lg:grid-cols-[232px,1fr] min-h-[calc(100vh-64px)]">
      <aside className="hidden lg:flex flex-col border-r border-line bg-sunk/40 px-4 py-6 sticky top-16 h-[calc(100vh-64px)]">
        <p className="px-2 font-display text-xl leading-tight">{biz.data?.business.name || business?.name || <Skeleton className="h-6 w-32" />}</p>
        {biz.data && <a href={`/b/${biz.data.business.slug}`} target="_blank" rel="noopener" className="px-2 mt-1 text-sm text-pine underline underline-offset-4">Open booking page</a>}
        {business?.status === 'suspended' && <p className="mx-2 mt-3 text-xs text-sindoor border border-sindoor/40 rounded-sm px-2 py-1">Booking page paused by the Palo team</p>}
        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Dashboard">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={`/dashboard/${s.id}`} aria-current={current.id === s.id ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-2 py-2 rounded text-[0.95rem] focus-ring ${current.id === s.id ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink hover:bg-sunk'}`}>
              {current.id === s.id && <m.span layoutId="dashnav" className="absolute inset-0 bg-card border border-line rounded" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <s.icon className="relative" size={18} /><span className="relative">{s.label}</span>
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted">Plan: {business?.plan === 'pro' ? 'Pro' : 'Free'} · Nepal time</p>
      </aside>
      <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 border-b border-line bg-sunk/40 sticky top-16 z-30" aria-label="Dashboard">
        {SECTIONS.map((s) => (
          <Link key={s.id} to={`/dashboard/${s.id}`} aria-current={current.id === s.id ? 'page' : undefined} className={`shrink-0 h-9 px-3 inline-flex items-center gap-2 rounded text-sm ${current.id === s.id ? 'bg-ink text-paper' : 'text-ink-2'}`}><s.icon size={16} />{s.label}</Link>
        ))}
      </nav>
      <div className="px-5 sm:px-8 py-7 min-w-0">
        {biz.error ? <ErrorBox message={biz.error} onRetry={() => biz.reload()} /> : !biz.data ? <SkeletonRows rows={6} /> : (
          <AnimatePresence mode="wait">
            <m.div key={current.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22, ease: [0.22, 0.8, 0.24, 1] }}>
              {current.id === 'today' && <Today biz={biz.data} />}
              {current.id === 'calendar' && <Week biz={biz.data} />}
              {current.id === 'appointments' && <Appointments biz={biz.data} />}
              {current.id === 'customers' && <Customers />}
              {current.id === 'services' && <Services biz={biz.data} reload={() => biz.reload(true)} />}
              {current.id === 'hours' && <HoursEditor biz={biz.data} reload={() => biz.reload(true)} />}
              {current.id === 'insights' && <Insights />}
              {current.id === 'settings' && <Settings biz={biz.data} reload={() => biz.reload(true)} />}
            </m.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function Head({ title, children, sub }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 className="font-display text-3xl sm:text-4xl leading-tight">{title}</h1>{sub && <p className="text-ink-2 mt-1">{sub}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const NEXT: Record<string, { to: string; label: string; variant: 'primary' | 'line' | 'danger' }[]> = {
  pending: [{ to: 'confirmed', label: 'Confirm', variant: 'primary' }, { to: 'cancelled', label: 'Decline', variant: 'danger' }],
  confirmed: [{ to: 'completed', label: 'Done', variant: 'primary' }, { to: 'no_show', label: 'No-show', variant: 'line' }, { to: 'cancelled', label: 'Cancel', variant: 'danger' }],
  no_show: [{ to: 'completed', label: 'Mark done', variant: 'line' }], completed: [], cancelled: [],
};
function useStatus(onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const change = async (a: Appointment, to: string) => {
    setBusy(a.id + to);
    try { await api(`/biz/appointments/${a.id}`, { method: 'PATCH', body: { status: to } }); toast.ok(`${a.customer_name}: ${STATUS_LABEL[to].toLowerCase()}`); onDone(); }
    catch (e) { toast.err(errorText(e)); } finally { setBusy(null); }
  };
  return { busy, change };
}
function Actions({ a, st, size = 'sm' }: { a: Appointment; st: ReturnType<typeof useStatus>; size?: 'sm' | 'md' }) {
  return <>{NEXT[a.status].map((n) => <Button key={n.to} size={size} variant={n.variant} busy={st.busy === a.id + n.to} onClick={() => st.change(a, n.to)}>{n.label}</Button>)}</>;
}

function Today({ biz }: { biz: BizData }) {
  const [date, setDate] = useState(biz.today.date);
  const appts = useApi<{ items: Appointment[] }>(`/biz/appointments?from=${date}&to=${date}`);
  const pending = useApi<{ items: Appointment[] }>(`/biz/appointments?status=pending&from=${biz.today.date}`);
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<Appointment | null>(null);
  const reloadAll = () => { appts.reload(true); pending.reload(true); };
  const st = useStatus(reloadAll);
  const wd = new Date(date + 'T00:00:00Z').getUTCDay();
  const h = biz.hours.find((x) => x.weekday === wd);
  const live = (appts.data?.items || []).filter((a) => a.status !== 'cancelled');
  const startH = Math.floor(Math.min(h && !h.closed ? h.open_min : 600, ...live.map((a) => a.start_min)) / 60);
  const endH = Math.ceil(Math.max(h && !h.closed ? h.close_min : 1080, ...live.map((a) => a.end_min)) / 60);
  const HOUR = 64;
  const isToday = date === biz.today.date;
  const nowMin = ktmToday().min;
  // simple lane packing so overlapping bookings sit side by side
  const lanes = useMemo(() => {
    const out: { a: Appointment; lane: number; of: number }[] = []; const ends: number[] = [];
    for (const a of [...live].sort((x, y) => x.start_min - y.start_min)) {
      let l = ends.findIndex((e) => e <= a.start_min); if (l === -1) { l = ends.length; ends.push(0); } ends[l] = a.end_min; out.push({ a, lane: l, of: 0 });
    }
    return out.map((o) => ({ ...o, of: Math.max(1, ends.length) }));
  }, [appts.data]);
  return (
    <div>
      <Head title={isToday ? 'Today' : fmtDate(date)} sub={<>{fmtDateLong(date)} · {h && !h.closed ? `open ${fmtTime(h.open_min)} to ${fmtTime(h.close_min)}` : 'closed'}{biz.blocks.find((b) => b.date === date) ? ` · holiday: ${biz.blocks.find((b) => b.date === date)!.reason}` : ''}</>}>
        <div className="flex items-center border border-line-2 rounded bg-card">
          <button className="p-2 hover:bg-sunk focus-ring rounded-l" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><IconChevronLeft size={18} /></button>
          <button className="px-3 text-sm h-9 hover:bg-sunk focus-ring disabled:text-muted" disabled={isToday} onClick={() => setDate(biz.today.date)}>Today</button>
          <button className="p-2 hover:bg-sunk focus-ring rounded-r" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><IconChevronRight size={18} /></button>
        </div>
        <Button onClick={() => setAdd(true)}><IconPlus size={18} />Add booking</Button>
      </Head>
      <div className="grid xl:grid-cols-[1fr,320px] gap-8 items-start">
        <section aria-label="Day sheet" className="bg-card border border-line rounded-md p-4 sm:p-5">
          {appts.loading && !appts.data ? <Skeleton className="h-[420px]" /> : appts.error ? <ErrorBox message={appts.error} onRetry={() => appts.reload()} /> : (
            <>
              <div className="relative" style={{ height: (endH - startH) * HOUR }}>
                {Array.from({ length: endH - startH }, (_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-line/80 flex" style={{ top: i * HOUR }}>
                    <span className="w-14 -mt-2.5 bg-card pr-2 text-[11px] text-muted tnum">{hhmm((startH + i) * 60)}</span>
                  </div>
                ))}
                {isToday && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                  <div className="absolute left-12 right-0 z-10 flex items-center" style={{ top: ((nowMin - startH * 60) / 60) * HOUR }} aria-label="Current time">
                    <span className="w-2 h-2 rounded-full bg-sindoor -ml-1" /><span className="flex-1 h-px bg-sindoor" />
                  </div>
                )}
                {lanes.map(({ a, lane, of }, i) => {
                  const top = ((a.start_min - startH * 60) / 60) * HOUR + 2; const height = Math.max(26, ((a.end_min - a.start_min) / 60) * HOUR - 4);
                  const tone = a.status === 'pending' ? 'bg-marigold-soft border-marigold/50' : a.status === 'completed' ? 'bg-sunk border-line-2 opacity-80' : a.status === 'no_show' ? 'bg-sindoor-soft border-sindoor/40' : 'bg-pine-soft border-pine/40';
                  return (
                    <m.button key={a.id} onClick={() => setOpen(a)} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.35 }}
                      className={`absolute text-left rounded-sm border px-2.5 py-1 overflow-hidden focus-ring hover:border-ink ${tone}`}
                      style={{ top, height, left: `calc(3.5rem + (100% - 3.5rem) * ${lane / of})`, width: `calc((100% - 3.5rem) / ${of} - 4px)` }}>
                      <span className="block text-[13px] font-medium leading-tight truncate">{fmtTime(a.start_min)} · {a.customer_name}</span>
                      <span className="block text-[11px] text-ink-2 truncate">{a.service_name}{a.status === 'pending' ? ' · waiting' : ''}</span>
                    </m.button>
                  );
                })}
              </div>
              {live.length === 0 && <p className="text-sm text-muted mt-4">No bookings on this day yet. Share your booking link, or add a phone booking.</p>}
            </>
          )}
        </section>
        <aside aria-label="Waiting for you" className="order-first xl:order-none">
          <div className="flex items-baseline justify-between mb-3"><h2 className="font-display text-2xl">Waiting for you</h2><span className="text-sm text-muted tnum">{pending.data?.items.length ?? ''}</span></div>
          {pending.loading && !pending.data ? <SkeletonRows rows={3} /> : pending.error ? <ErrorBox message={pending.error} onRetry={() => pending.reload()} /> : pending.data!.items.length === 0 ? (
            <p className="text-sm text-muted border border-dashed border-line-2 rounded p-4">No requests waiting. {biz.business.auto_confirm ? 'Online bookings confirm themselves.' : 'New online bookings appear here for your OK.'}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {pending.data!.items.map((a) => (
                  <m.li key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="slip px-4 pt-3 pb-4 shadow-slip">
                    <p className="text-xs text-muted tnum">{fmtDate(a.date)} · {fmtTime(a.start_min)} · {a.ref}</p>
                    <p className="font-medium mt-1">{a.customer_name} <a href={`tel:${a.customer_phone}`} className="text-sm text-pine font-normal tnum">{a.customer_phone}</a></p>
                    <p className="text-sm text-ink-2">{a.service_name}</p>
                    {a.note && <p className="text-sm text-ink-2 mt-1 italic">“{a.note}”</p>}
                    <div className="flex gap-2 mt-3"><Actions a={a} st={st} /></div>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </aside>
      </div>
      <AddBooking open={add} onClose={() => setAdd(false)} biz={biz} date={date} onDone={reloadAll} />
      <ApptModal a={open} onClose={() => setOpen(null)} st={st} />
    </div>
  );
}

function ApptModal({ a, onClose, st }: { a: Appointment | null; onClose: () => void; st: ReturnType<typeof useStatus> }) {
  return (
    <Modal open={!!a} onClose={onClose} title={a ? `${a.customer_name}` : ''}>
      {a && (
        <div>
          <div className="flex items-center gap-3 mb-4"><StatusPill status={a.status} /><span className="text-sm text-muted tnum">{a.ref} · {a.source === 'staff' ? 'added by you' : 'booked online'}</span></div>
          <dl className="grid grid-cols-[110px,1fr] gap-y-2 text-sm">
            <dt className="text-muted">When</dt><dd>{fmtDateLong(a.date)}, {fmtTime(a.start_min)} to {fmtTime(a.end_min)}</dd>
            <dt className="text-muted">Service</dt><dd>{a.service_name} · {a.price_npr ? npr(a.price_npr) : 'Free'}</dd>
            <dt className="text-muted">Phone</dt><dd><a className="text-pine underline tnum" href={`tel:${a.customer_phone}`}>{a.customer_phone}</a></dd>
            {a.customer_email && <><dt className="text-muted">Email</dt><dd>{a.customer_email}</dd></>}
            {a.note && <><dt className="text-muted">Note</dt><dd className="whitespace-pre-line">{a.note}</dd></>}
            <dt className="text-muted">Created</dt><dd>{ago(a.created_at)}</dd>
          </dl>
          {NEXT[a.status].length > 0 && <div className="flex flex-wrap gap-2 mt-6"><Actions a={a} st={{ ...st, change: async (x, to) => { await st.change(x, to); onClose(); } }} size="md" /></div>}
        </div>
      )}
    </Modal>
  );
}

function AddBooking({ open, onClose, biz, date, onDone }: { open: boolean; onClose: () => void; biz: BizData; date: string; onDone: () => void }) {
  const active = biz.services.filter((s) => s.active);
  const [f, setF] = useState({ service_id: '', date, time: '10:00', name: '', phone: '', note: '' });
  const [fe, setFe] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF((x) => ({ ...x, date, service_id: x.service_id || String(active[0]?.id || '') })); }, [open, date]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setFe({});
    try { await api('/biz/appointments', { body: { ...f, service_id: Number(f.service_id) } }); toast.ok('Booking added'); onDone(); onClose(); setF({ ...f, name: '', phone: '', note: '' }); }
    catch (e) { if (e instanceof ApiError) setFe(e.fields); toast.err(errorText(e)); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Add a phone or walk-in booking">
      {active.length === 0 ? <p className="text-ink-2">Add a service first, under Services.</p> : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Service" error={fe.service_id}>{(id) => <Select id={id} value={f.service_id} onChange={(e) => setF({ ...f, service_id: e.target.value })}>{active.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={fe.date}>{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
            <Field label="Time" error={fe.time}>{(id) => <Input id={id} type="time" step={300} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />}</Field>
          </div>
          <Field label="Customer name" error={fe.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Mobile" error={fe.phone}>{(id) => <Input id={id} inputMode="tel" placeholder="98XXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
          <Field label="Note (optional)" error={fe.note}>{(id) => <Input id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
          <p className="text-xs text-muted">Bookings you add are confirmed straight away and can go beyond your online capacity (for walk-ins).</p>
          <Button type="submit" busy={busy}>Add booking</Button>
        </form>
      )}
    </Modal>
  );
}

function Week({ biz }: { biz: BizData }) {
  const [start, setStart] = useState(() => { const t = biz.today.date; return addDays(t, -new Date(t + 'T00:00:00Z').getUTCDay()); });
  const end = addDays(start, 6);
  const { data, loading, error, reload } = useApi<{ items: Appointment[] }>(`/biz/appointments?from=${start}&to=${end}`);
  const [open, setOpen] = useState<Appointment | null>(null);
  const st = useStatus(() => reload(true));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const items = (data?.items || []).filter((a) => a.status !== 'cancelled');
  const openMins = biz.hours.filter((h) => !h.closed);
  const sH = Math.floor(Math.min(600, ...openMins.map((h) => h.open_min), ...items.map((a) => a.start_min)) / 60);
  const eH = Math.ceil(Math.max(1080, ...openMins.map((h) => h.close_min), ...items.map((a) => a.end_min)) / 60);
  const HR = 52;
  return (
    <div>
      <Head title="Week" sub={`${fmtDate(start)} to ${fmtDate(end)} · ${items.length} booking${items.length === 1 ? '' : 's'}`}>
        <div className="flex items-center border border-line-2 rounded bg-card">
          <button className="p-2 hover:bg-sunk focus-ring" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week"><IconChevronLeft size={18} /></button>
          <button className="px-3 text-sm h-9 hover:bg-sunk focus-ring" onClick={() => setStart(addDays(biz.today.date, -new Date(biz.today.date + 'T00:00:00Z').getUTCDay()))}>This week</button>
          <button className="p-2 hover:bg-sunk focus-ring" onClick={() => setStart(addDays(start, 7))} aria-label="Next week"><IconChevronRight size={18} /></button>
        </div>
      </Head>
      {loading && !data ? <Skeleton className="h-[480px]" /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : (
        <>
          <div className="hidden md:block bg-card border border-line rounded-md overflow-hidden">
            <div className="grid grid-cols-[56px,repeat(7,1fr)] border-b border-line">
              <span />
              {days.map((d) => <div key={d} className={`px-2 py-2 text-center border-l border-line ${d === biz.today.date ? 'bg-pine-soft/60' : ''}`}><p className="text-[11px] uppercase tracking-wider text-muted">{dayShort(d)}</p><p className="font-display text-xl tnum">{dayNum(d)}</p></div>)}
            </div>
            <div className="grid grid-cols-[56px,repeat(7,1fr)] relative" style={{ height: (eH - sH) * HR }}>
              <div className="relative">{Array.from({ length: eH - sH }, (_, i) => <span key={i} className="absolute left-2 text-[11px] text-muted tnum" style={{ top: i * HR + 2 }}>{hhmm((sH + i) * 60)}</span>)}</div>
              {days.map((d) => {
                const wd = new Date(d + 'T00:00:00Z').getUTCDay(); const h = biz.hours.find((x) => x.weekday === wd); const closed = !h || h.closed || biz.blocks.some((b) => b.date === d);
                return (
                  <div key={d} className={`relative border-l border-line ${closed ? 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,#E9E2D5_6px_7px)]' : ''}`}>
                    {Array.from({ length: eH - sH }, (_, i) => <div key={i} className="absolute left-0 right-0 border-t border-line/60" style={{ top: i * HR }} />)}
                    {items.filter((a) => a.date === d).map((a) => (
                      <button key={a.id} onClick={() => setOpen(a)} className={`absolute left-1 right-1 rounded-sm border px-1.5 py-0.5 text-left overflow-hidden focus-ring hover:border-ink ${a.status === 'pending' ? 'bg-marigold-soft border-marigold/50' : a.status === 'completed' ? 'bg-sunk border-line-2' : a.status === 'no_show' ? 'bg-sindoor-soft border-sindoor/40' : 'bg-pine-soft border-pine/40'}`}
                        style={{ top: ((a.start_min - sH * 60) / 60) * HR + 1, height: Math.max(20, ((a.end_min - a.start_min) / 60) * HR - 2) }}>
                        <span className="block text-[11px] font-medium leading-tight truncate">{hhmm(a.start_min)} {a.customer_name}</span>
                        <span className="block text-[10px] text-ink-2 truncate">{a.service_name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="md:hidden flex flex-col gap-5">
            {days.map((d) => { const list = items.filter((a) => a.date === d); return (
              <div key={d}><p className={`font-display text-lg ${d === biz.today.date ? 'text-sindoor' : ''}`}>{fmtDate(d)}</p>
                {list.length === 0 ? <p className="text-sm text-muted">No bookings</p> : list.map((a) => (
                  <button key={a.id} onClick={() => setOpen(a)} className="w-full text-left flex items-center justify-between gap-3 py-2 border-b border-line"><span className="tnum text-sm w-16">{fmtTime(a.start_min)}</span><span className="flex-1 text-sm">{a.customer_name} · {a.service_name}</span><StatusPill status={a.status} /></button>
                ))}
              </div>); })}
          </div>
        </>
      )}
      <ApptModal a={open} onClose={() => setOpen(null)} st={st} />
    </div>
  );
}

function Appointments({ biz }: { biz: BizData }) {
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [dq, setDq] = useState('');
  const [range, setRange] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const t = biz.today.date;
  const qs = `status=${status}&q=${encodeURIComponent(dq)}` + (range === 'upcoming' ? `&from=${t}` : range === 'past' ? `&to=${addDays(t, -1)}` : '');
  const { data, loading, error, reload } = useApi<{ items: Appointment[] }>(`/biz/appointments?${qs}`);
  const [open, setOpen] = useState<Appointment | null>(null);
  const st = useStatus(() => reload(true));
  const items = range === 'past' ? [...(data?.items || [])].reverse() : data?.items || [];
  return (
    <div>
      <Head title="Appointments" sub="Search, filter and update every booking." />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="relative flex-1"><span className="sr-only">Search</span><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Name, phone, code or service" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Range" value={range} onChange={(e) => setRange(e.target.value as any)} className="sm:w-40"><option value="upcoming">Today onwards</option><option value="past">Past</option><option value="all">All dates</option></Select>
      </div>
      {loading && !data ? <SkeletonRows rows={6} /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : items.length === 0 ? (
        <Empty title="No appointments match">{q || status ? 'Try clearing the search or filters.' : 'When customers book, their appointments appear here.'}</Empty>
      ) : (
        <div className="overflow-x-auto border border-line rounded-md bg-card">
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line"><th className="py-3 px-4 font-semibold">When</th><th className="py-3 px-4 font-semibold">Customer</th><th className="py-3 px-4 font-semibold">Service</th><th className="py-3 px-4 font-semibold">Status</th><th className="py-3 px-4 font-semibold text-right">Actions</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-sunk/40">
                  <td className="py-3 px-4 tnum whitespace-nowrap"><button className="text-left focus-ring rounded" onClick={() => setOpen(a)}><span className="font-medium">{fmtDate(a.date)}</span><span className="block text-muted">{fmtTime(a.start_min)}</span></button></td>
                  <td className="py-3 px-4"><span className="font-medium">{a.customer_name}</span><span className="block text-muted tnum">{a.customer_phone} · {a.ref}</span></td>
                  <td className="py-3 px-4">{a.service_name}<span className="block text-muted tnum">{a.price_npr ? npr(a.price_npr) : 'Free'}</span></td>
                  <td className="py-3 px-4"><StatusPill status={a.status} /></td>
                  <td className="py-3 px-4"><div className="flex gap-2 justify-end"><Actions a={a} st={st} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ApptModal a={open} onClose={() => setOpen(null)} st={st} />
    </div>
  );
}

interface Cust { id: number; name: string; phone: string; email: string | null; notes: string; first_seen: number; last_seen: number; bookings: number; visits: number; no_shows: number; spent_npr: number }
function Customers() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading, error, reload } = useApi<{ items: Cust[] }>(`/biz/customers?q=${encodeURIComponent(dq)}`);
  const [sel, setSel] = useState<Cust | null>(null);
  return (
    <div>
      <Head title="Customers" sub="Everyone who booked, matched by phone number." />
      <label className="relative block mb-5 max-w-md"><span className="sr-only">Search customers</span><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {loading && !data ? <SkeletonRows rows={5} /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : data!.items.length === 0 ? (
        <Empty title={q ? 'No customer matches' : 'Your customer book is empty'}>{q ? 'Try part of a name or the last digits of a phone number.' : 'Customers are added automatically the first time they book.'}</Empty>
      ) : (
        <ul className="border-t border-line">
          {data!.items.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSel(c)} className="w-full text-left grid grid-cols-[1fr,auto] sm:grid-cols-[1.3fr,1fr,auto] gap-x-6 gap-y-1 py-4 border-b border-line hover:bg-sunk/40 px-1 focus-ring">
                <span><span className="font-medium">{c.name}</span><span className="block text-sm text-muted tnum">{c.phone}</span></span>
                <span className="hidden sm:block text-sm text-ink-2 truncate">{c.notes || <span className="text-muted">No notes</span>}</span>
                <span className="text-sm text-right tnum"><span className="block">{c.visits} visit{c.visits === 1 ? '' : 's'}{c.no_shows ? ` · ${c.no_shows} no-show` : ''}</span><span className="block text-muted">{npr(c.spent_npr)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CustomerModal c={sel} onClose={() => setSel(null)} onSaved={() => reload(true)} />
    </div>
  );
}
function CustomerModal({ c, onClose, onSaved }: { c: Cust | null; onClose: () => void; onSaved: () => void }) {
  const detail = useApi<{ customer: Cust; history: any[] }>(c ? `/biz/customers/${c.id}` : null);
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (detail.data) setNotes(detail.data.customer.notes); }, [detail.data]);
  const remove = async () => { if (!c) return; setBusy(true); try { await api(`/biz/customers/${c.id}`, { method: 'DELETE' }); toast.ok('Removed from your customer book'); setConfirmDel(false); onClose(); onSaved(); } catch (e) { toast.err(errorText(e)); } finally { setBusy(false); } };
  const save = async () => { if (!c) return; setBusy(true); try { await api(`/biz/customers/${c.id}`, { method: 'PATCH', body: { notes } }); toast.ok('Notes saved'); onSaved(); } catch (e) { toast.err(errorText(e)); } finally { setBusy(false); } };
  return (
    <Modal open={!!c} onClose={onClose} title={c?.name || ''} wide>
      {c && (
        <div className="grid sm:grid-cols-[1fr,1.2fr] gap-6">
          <div>
            <dl className="grid grid-cols-[90px,1fr] gap-y-2 text-sm">
              <dt className="text-muted">Phone</dt><dd><a className="text-pine underline tnum" href={`tel:${c.phone}`}>{c.phone}</a></dd>
              {c.email && <><dt className="text-muted">Email</dt><dd className="break-all">{c.email}</dd></>}
              <dt className="text-muted">Visits</dt><dd className="tnum">{c.visits}</dd><dt className="text-muted">No-shows</dt><dd className="tnum">{c.no_shows}</dd>
              <dt className="text-muted">Spent</dt><dd className="tnum">{npr(c.spent_npr)}</dd><dt className="text-muted">First seen</dt><dd>{ago(c.first_seen)}</dd>
            </dl>
            <div className="mt-5"><Field label="Private notes" hint="Only you can see these.">{(id, d) => <Textarea id={id} aria-describedby={d} maxLength={1000} disabled={!detail.data} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
              <div className="flex flex-wrap gap-2 mt-3"><Button size="sm" busy={busy} disabled={!detail.data} onClick={save}>Save notes</Button>
                {confirmDel ? <><Button size="sm" variant="danger" busy={busy} onClick={remove}>Yes, remove</Button><Button size="sm" variant="quiet" onClick={() => setConfirmDel(false)}>Keep</Button></> : <Button size="sm" variant="quiet" onClick={() => setConfirmDel(true)}>Remove from book</Button>}</div>
              {confirmDel && <p className="text-xs text-muted mt-2">Removes this person and your notes from the customer book. Past appointment records stay in Appointments.</p>}</div>
          </div>
          <div>
            <p className="eyebrow mb-2">History</p>
            {detail.loading || !detail.data ? (detail.error ? <ErrorBox message={detail.error} /> : <SkeletonRows rows={3} />) : (
              <ul className="text-sm">{detail.data!.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2 border-b border-line"><span className="tnum">{fmtDate(h.date)} · {fmtTime(h.start_min)}</span><span className="flex-1 truncate text-ink-2">{h.service_name}</span><StatusPill status={h.status} /></li>
              ))}</ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Services({ biz, reload }: { biz: BizData; reload: () => void }) {
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => { e.preventDefault(); if (!edit) return; setBusy(true); setFe({});
    const body = { name: edit.name, duration_min: Number(edit.duration_min), price_npr: Number(edit.price_npr), active: edit.active !== 0 };
    try { if (edit.id) await api(`/biz/services/${edit.id}`, { method: 'PATCH', body }); else await api('/biz/services', { body }); toast.ok('Service saved'); setEdit(null); reload(); }
    catch (e) { if (e instanceof ApiError) setFe(e.fields); toast.err(errorText(e)); } finally { setBusy(false); } };
  const toggle = async (s: Service) => { try { await api(`/biz/services/${s.id}`, { method: 'PATCH', body: { name: s.name, duration_min: s.duration_min, price_npr: s.price_npr, active: !s.active } }); toast.ok(s.active ? 'Hidden from booking page' : 'Shown on booking page'); reload(); } catch (e) { toast.err(errorText(e)); } };
  return (
    <div>
      <Head title="Services" sub="What customers can book, how long it takes and what it costs."><Button onClick={() => setEdit({ name: '', duration_min: 30, price_npr: 0 })}><IconPlus size={18} />New service</Button></Head>
      {biz.services.length === 0 ? <Empty title="No services yet" action={<Button onClick={() => setEdit({ name: '', duration_min: 30, price_npr: 0 })}>Add your first service</Button>}>Your booking page opens once you add at least one service.</Empty> : (
        <ul className="border-t border-line">
          {biz.services.map((s) => (
            <li key={s.id} className={`grid grid-cols-[1fr,auto] sm:grid-cols-[1.5fr,100px,120px,auto] gap-x-6 gap-y-2 items-center py-4 border-b border-line ${s.active ? '' : 'opacity-60'}`}>
              <span className="font-medium">{s.name}{!s.active && <span className="ml-2 text-xs text-muted">(hidden)</span>}</span>
              <span className="text-sm text-ink-2 tnum">{s.duration_min} min</span>
              <span className="text-sm tnum">{s.price_npr ? npr(s.price_npr) : 'Free'}</span>
              <span className="flex gap-2 justify-end col-span-2 sm:col-span-1"><Button size="sm" variant="line" onClick={() => setEdit(s)}>Edit</Button><Button size="sm" variant="quiet" onClick={() => toggle(s)}>{s.active ? 'Hide' : 'Show'}</Button></span>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit service' : 'New service'}>
        {edit && (
          <form onSubmit={save} className="flex flex-col gap-4" noValidate>
            <Field label="Name" error={fe.name}>{(id) => <Input id={id} value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Dental check-up" />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (minutes)" error={fe.duration_min}>{(id) => <Input id={id} type="number" min={5} max={480} step={5} value={edit.duration_min ?? ''} onChange={(e) => setEdit({ ...edit, duration_min: e.target.value as any })} />}</Field>
              <Field label="Price (NPR)" error={fe.price_npr}>{(id) => <Input id={id} type="number" min={0} step={50} value={edit.price_npr ?? ''} onChange={(e) => setEdit({ ...edit, price_npr: e.target.value as any })} />}</Field>
            </div>
            <Button type="submit" busy={busy}>Save service</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function HoursEditor({ biz, reload }: { biz: BizData; reload: () => void }) {
  const [rows, setRows] = useState(() => [0, 1, 2, 3, 4, 5, 6].map((wd) => { const h = biz.hours.find((x) => x.weekday === wd) || { open_min: 600, close_min: 1080, closed: 1 }; return { weekday: wd, open: hhmm(h.open_min), close: hhmm(h.close_min), closed: !!h.closed }; }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [blk, setBlk] = useState({ date: '', reason: '' }); const [bBusy, setBBusy] = useState(false);
  const toMin = (s: string) => { const [h, m2] = s.split(':').map(Number); return h * 60 + m2; };
  const save = async () => { setBusy(true); setErr(null);
    try { await api('/biz/hours', { method: 'PUT', body: { hours: rows.map((r) => ({ weekday: r.weekday, open_min: toMin(r.open), close_min: toMin(r.close), closed: r.closed })) } }); toast.ok('Opening hours saved'); reload(); }
    catch (e) { const t = e instanceof ApiError && e.fields.hours ? e.fields.hours : errorText(e); setErr(t); toast.err(t); } finally { setBusy(false); } };
  const addBlock = async (e: FormEvent) => { e.preventDefault(); setBBusy(true); try { await api('/biz/blocks', { body: blk }); setBlk({ date: '', reason: '' }); toast.ok('Day closed'); reload(); } catch (e) { toast.err(errorText(e)); } finally { setBBusy(false); } };
  const delBlock = async (id: number) => { try { await api(`/biz/blocks/${id}`, { method: 'DELETE' }); toast.ok('Day reopened'); reload(); } catch (e) { toast.err(errorText(e)); } };
  return (
    <div className="grid xl:grid-cols-[1.2fr,1fr] gap-10 items-start">
      <section>
        <Head title="Opening hours" sub="Online booking only offers times inside these hours." />
        <div className="border-t border-line">
          {rows.map((r, i) => (
            <div key={r.weekday} className="grid grid-cols-[110px,1fr] sm:grid-cols-[130px,auto,1fr] items-center gap-3 py-3 border-b border-line">
              <span className="font-medium">{DAY_NAMES[r.weekday]}</span>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-pine" checked={!r.closed} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, closed: !e.target.checked } : x))} />Open</label>
              <div className={`col-span-2 sm:col-span-1 flex items-center gap-2 ${r.closed ? 'opacity-40' : ''}`}>
                <Input aria-label={`${DAY_NAMES[r.weekday]} opens`} type="time" step={900} className="w-32" disabled={r.closed} value={r.open} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, open: e.target.value } : x))} />
                <span className="text-muted">to</span>
                <Input aria-label={`${DAY_NAMES[r.weekday]} closes`} type="time" step={900} className="w-32" disabled={r.closed} value={r.close} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, close: e.target.value } : x))} />
              </div>
            </div>
          ))}
        </div>
        {err && <p className="text-sm text-sindoor mt-3" role="alert">{err}</p>}
        <Button className="mt-5" busy={busy} onClick={save}>Save hours</Button>
      </section>
      <section>
        <h2 className="font-display text-2xl mb-1">Holidays and closed days</h2>
        <p className="text-ink-2 text-sm mb-4">Close a single date: festivals, staff leave, a power cut day.</p>
        <form onSubmit={addBlock} className="flex flex-col sm:flex-row gap-3 items-end">
          <Field label="Date">{(id) => <Input id={id} type="date" min={biz.today.date} value={blk.date} onChange={(e) => setBlk({ ...blk, date: e.target.value })} />}</Field>
          <div className="flex-1 w-full"><Field label="Reason (shown to customers)">{(id) => <Input id={id} maxLength={80} placeholder="e.g. Tihar" value={blk.reason} onChange={(e) => setBlk({ ...blk, reason: e.target.value })} />}</Field></div>
          <Button type="submit" variant="line" busy={bBusy} disabled={!blk.date}><IconBlock size={18} />Close day</Button>
        </form>
        <ul className="mt-5 border-t border-line">
          {biz.blocks.length === 0 ? <li className="py-4 text-sm text-muted">No closed days coming up.</li> : biz.blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 border-b border-line"><span><span className="font-medium">{fmtDate(b.date)}</span> <span className="text-ink-2">· {b.reason}</span></span><Button size="sm" variant="quiet" onClick={() => delBlock(b.id)}>Reopen</Button></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Insights() {
  const { data, loading, error, reload } = useApi<any>('/biz/stats');
  if (loading) return <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (error) return <ErrorBox message={error} onRetry={() => reload()} />;
  const statusTotal = data.byStatus.reduce((a: number, s: any) => a + s.n, 0);
  const maxSvc = Math.max(1, ...data.byService.map((s: any) => s.n));
  return (
    <div>
      <Head title="Insights" sub="Counted from your real bookings. Nothing estimated." />
      <dl className="grid grid-cols-2 lg:grid-cols-4 border-y border-line divide-x divide-line">
        {[['Upcoming', data.upcoming], ['Waiting for OK', data.pending], ['Customers', data.customers], ['Completed value, 30 days', npr(data.completed_value_30d)]].map(([k, v], i) => (
          <div key={k as string} className={`py-5 px-4 ${i > 1 ? 'border-t lg:border-t-0 border-line' : ''}`}><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="font-display text-3xl mt-1 tnum">{v}</dd></div>
        ))}
      </dl>
      <div className="grid xl:grid-cols-[1.4fr,1fr] gap-10 mt-10">
        <section><h2 className="font-display text-2xl mb-1">Bookings by day</h2><p className="text-sm text-muted mb-4">Past 7 days and the next 7. Today in red.</p>
          <BarChart label="Bookings by appointment day" highlightIndex={6} data={data.days.map((d: any) => ({ label: String(dayNum(d.date)), value: d.n, sub: fmtDate(d.date) }))} />
        </section>
        <section>
          <h2 className="font-display text-2xl mb-4">Top services, 30 days</h2>
          {data.byService.length === 0 ? <p className="text-sm text-muted">No bookings in the last 30 days.</p> : (
            <ul className="flex flex-col gap-3">{data.byService.map((s: any, i: number) => (
              <li key={s.name}><div className="flex justify-between text-sm mb-1"><span>{s.name}</span><span className="tnum text-muted">{s.n}</span></div>
                <div className="h-2 bg-sunk rounded-sm overflow-hidden"><m.div className="h-full bg-pine origin-left" initial={{ scaleX: 0 }} whileInView={{ scaleX: s.n / maxSvc }} viewport={{ once: false }} transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 0.8, 0.24, 1] }} /></div></li>
            ))}</ul>
          )}
          <h2 className="font-display text-2xl mt-8 mb-3">Outcomes, 30 days</h2>
          {statusTotal === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
            <>
              <div className="flex h-3 rounded-sm overflow-hidden" role="img" aria-label={data.byStatus.map((s: any) => `${STATUS_LABEL[s.status]} ${s.n}`).join(', ')}>
                {data.byStatus.map((s: any) => <m.span key={s.status} initial={{ flexGrow: 0 }} animate={{ flexGrow: s.n }} transition={{ duration: 0.8 }} className={{ pending: 'bg-marigold', confirmed: 'bg-pine', completed: 'bg-ink-2', cancelled: 'bg-line-2', no_show: 'bg-sindoor' }[s.status as string] || 'bg-sunk'} />)}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">{data.byStatus.map((s: any) => <li key={s.status}><span className="text-muted">{STATUS_LABEL[s.status]}</span> <span className="tnum">{s.n}</span></li>)}</ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Settings({ biz, reload }: { biz: BizData; reload: () => void }) {
  const b = biz.business; const { refresh } = useAuth();
  const [f, setF] = useState({ name: b.name, category: b.category, area: b.area, address: b.address, phone: b.phone || '', about: b.about, payment_note: b.payment_note, capacity: b.capacity, slot_step: b.slot_step, lead_min: b.lead_min, auto_confirm: !!b.auto_confirm });
  const [fe, setFe] = useState<Record<string, string>>({}); const [busy, setBusy] = useState<string | null>(null);
  const link = `${location.origin}/b/${b.slug}`;
  const save = async (e: FormEvent) => { e.preventDefault(); setBusy('s'); setFe({});
    try { await api('/biz', { method: 'PATCH', body: { ...f, capacity: Number(f.capacity), slot_step: Number(f.slot_step), lead_min: Number(f.lead_min) } }); toast.ok('Business settings saved'); reload(); refresh(); }
    catch (e) { if (e instanceof ApiError) setFe(e.fields); toast.err(errorText(e)); } finally { setBusy(null); } };
  const requestPro = async () => { setBusy('p'); try { await api('/biz/plan-request', { method: 'POST' }); toast.ok('Request sent. The Palo team will contact you.'); } catch (e) { toast.err(errorText(e)); } finally { setBusy(null); } };
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.ok('Booking link copied'); } catch { toast.err('Could not copy. Select the link and copy it.'); } };
  const inp = (k: keyof typeof f, label: string, props: any = {}, hint?: string) => <Field label={label} error={fe[k as string]} hint={hint}>{(id, d) => <Input id={id} aria-describedby={d} value={f[k] as any} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />}</Field>;
  return (
    <div className="grid xl:grid-cols-[1.3fr,1fr] gap-12 items-start">
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <Head title="Business settings" />
        {inp('name', 'Business name')}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category" error={fe.category}>{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          {inp('area', 'Area')}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">{inp('address', 'Street address (optional)')}{inp('phone', 'Phone shown to customers', { inputMode: 'tel' })}</div>
        <Field label="About" error={fe.about}>{(id) => <Textarea id={id} maxLength={600} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />}</Field>
        {inp('payment_note', 'Payment note', {}, 'Shown on the booking page and slip. Palo does not take payments.')}
        <h2 className="font-display text-2xl mt-4">Booking rules</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {inp('capacity', 'Customers at once', { type: 'number', min: 1, max: 20 }, 'Chairs, doctors or beds')}
          <Field label="Slot interval" error={fe.slot_step}>{(id) => <Select id={id} value={f.slot_step} onChange={(e) => setF({ ...f, slot_step: Number(e.target.value) })}>{[10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>Every {n} min</option>)}</Select>}</Field>
          {inp('lead_min', 'Minimum notice (min)', { type: 'number', min: 0, max: 2880 })}
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-pine" checked={f.auto_confirm} onChange={(e) => setF({ ...f, auto_confirm: e.target.checked })} />Confirm online bookings automatically</label>
        <Button type="submit" busy={busy === 's'} className="self-start mt-2">Save settings</Button>
      </form>
      <div className="flex flex-col gap-10">
        <section>
          <h2 className="font-display text-2xl">Your booking link</h2>
          <div className="mt-3 flex gap-2"><Input readOnly value={link} aria-label="Booking link" onFocus={(e) => e.currentTarget.select()} /><Button variant="line" onClick={copy}>Copy</Button></div>
          <p className="text-sm text-muted mt-2">Add it to your Facebook page button, Instagram bio and Google Maps listing.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Plan</h2>
          <p className="mt-2 text-ink-2">You are on <strong>{b.plan === 'pro' ? 'Pro' : 'Free'}</strong>{b.plan === 'pro' && b.plan_until ? ` until ${fmtDate(b.plan_until)}` : ''}.</p>
          {b.plan !== 'pro' && <><p className="text-sm text-muted mt-1">Pro is Rs 999/month and adds phone and on-site setup help. Payment is arranged directly (eSewa, Khalti or bank).</p><Button variant="line" className="mt-3" busy={busy === 'p'} onClick={requestPro} disabled={!!b.plan_requested_at}>{b.plan_requested_at ? 'Upgrade requested' : 'Request Pro'}</Button></>}
        </section>
        <section><AccountSettings /></section>
      </div>
    </div>
  );
}
