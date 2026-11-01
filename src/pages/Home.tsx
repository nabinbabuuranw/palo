import { useRef, type ReactNode } from 'react';
import { m, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring } from 'motion/react';
import { Link } from '../lib/router';
import { useApi } from '../lib/useApi';
import { BookingFlow } from '../components/BookingFlow';
import { Skeleton } from '../components/ui';
import { IconCalendar, IconPeople, IconBell, IconShield } from '../components/Icons';

const ease = [0.22, 0.8, 0.24, 1] as const;

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  // Animates in when scrolled into view and back out when scrolled away (works in both directions).
  return (
    <m.div className={className} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.7, delay, ease }}>
      {children}
    </m.div>
  );
}

function HeroDemo() {
  const list = useApi<{ items: { slug: string; name: string; is_demo: number }[] }>('/public/businesses');
  const demo = list.data?.items.find((b) => b.is_demo);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 18 }), sry = useSpring(ry, { stiffness: 120, damping: 18 });
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 3); rx.set(-((e.clientY - r.top) / r.height - 0.5) * 3);
  };
  return (
    <m.div onPointerMove={onMove} onPointerLeave={() => { rx.set(0); ry.set(0); }} style={{ rotateX: srx, rotateY: sry, transformPerspective: 1400 }}
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.35, ease }}
      className="relative bg-card border border-line rounded-lg shadow-lift">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sindoor flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 bg-sindoor rounded-full" aria-hidden="true" />Live booking page</p>
          <p className="font-display text-lg truncate">{demo ? demo.name.replace(/^Demo business:\s*/, '') : 'Loading…'}</p>
        </div>
        <span className="shrink-0 text-[11px] border border-line-2 rounded-sm px-2 py-1 text-ink-2">Demo business · test data</span>
      </div>
      <div className="p-5">
        {list.loading ? <div className="flex flex-col gap-3" role="status" aria-label="Loading demo"><Skeleton className="h-14" /><Skeleton className="h-16" /><Skeleton className="h-24" /></div>
          : demo ? <BookingFlow slug={demo.slug} compact />
            : <p className="text-sm text-muted">The live demo is not available right now. You can still <Link className="underline" to="/explore">browse businesses</Link>.</p>}
      </div>
    </m.div>
  );
}

// Scroll-linked day sheet: tokens slide onto the timeline as you scroll, and slide back as you scroll up.
const EXAMPLE = [
  { t: '10:00', name: 'Haircut', who: 'R. Shrestha', row: 0, len: 1.5, tone: 'pine' },
  { t: '10:30', name: 'Beard trim', who: 'Walk-in', row: 1, len: 1.3, tone: 'ink' },
  { t: '11:30', name: 'Colour', who: 'A. Gurung', row: 3, len: 3, tone: 'sindoor' },
  { t: '13:00', name: 'Massage', who: 'S. Karki', row: 6, len: 1.4, tone: 'pine' },
  { t: '14:30', name: 'Haircut', who: 'P. Tamang', row: 9, len: 1.5, tone: 'marigold' },
];
function DaySheet() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] });
  return (
    <div ref={ref} className="relative bg-card border border-line rounded-md p-5 sm:p-7 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-xl">Tuesday · day sheet</p>
        <p className="text-xs text-muted">Illustration with example names</p>
      </div>
      <div className="relative">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex items-center h-9 border-t border-line/70">
            <span className="w-14 text-[11px] text-muted tnum">{i % 2 === 0 ? `${String(10 + i / 2).padStart(2, '0')}:00` : ''}</span>
          </div>
        ))}
        {EXAMPLE.map((e, i) => <SheetToken key={i} e={e} i={i} progress={scrollYProgress} />)}
      </div>
    </div>
  );
}
function SheetToken({ e, i, progress }: { e: typeof EXAMPLE[number]; i: number; progress: any }) {
  const start = i * 0.14;
  const x = useTransform(progress, [start, start + 0.25], [60, 0]);
  const opacity = useTransform(progress, [start, start + 0.2], [0, 1]);
  const tone = { pine: 'bg-pine-soft border-pine/40', ink: 'bg-sunk border-line-2', sindoor: 'bg-sindoor-soft border-sindoor/40', marigold: 'bg-marigold-soft border-marigold/40' }[e.tone];
  return (
    <m.div style={{ x, opacity, top: e.row * 36 + 4, height: Math.max(44, e.len * 36 - 6) }} className={`absolute rounded-sm border px-2.5 sm:px-3 py-1.5 overflow-hidden ${i % 2 ? 'left-[calc(50%+1.75rem)] right-0' : 'left-14 right-[calc(50%-1.25rem)]'} ${tone}`}>
      <p className="text-[13px] font-medium text-ink leading-tight">{e.t} · {e.name}</p>
      <p className="text-[11px] text-ink-2 leading-tight">{e.who}</p>
    </m.div>
  );
}

const ROWS = [
  { n: '01', icon: IconCalendar, title: 'A booking page that answers the phone for you', body: 'Your services, prices and real free times on one link: palo.sites.tab.bot/b/your-name. Put it on your Facebook page, Instagram bio and Google Maps listing. Customers book without calling, and every booking is checked against your capacity so two people never get the same chair.' },
  { n: '02', icon: IconBell, title: 'A day sheet instead of a diary', body: 'New requests wait for your OK, or confirm themselves if you prefer. Mark people done or no-show, add walk-ins and phone bookings, close a day for a festival. The calendar shows the week at a glance.' },
  { n: '03', icon: IconPeople, title: 'A customer book that fills itself', body: 'Every booking adds the customer to your book by phone number: visits, no-shows, total spent and your private notes ("prefers morning", "allergic to latex"). Search it in a second.' },
  { n: '04', icon: IconShield, title: 'Plain rules about data', body: 'Customer details belong to the business they booked with. No ads, no selling data, no tracking scripts on booking pages. Passwords are hashed, sessions are secure cookies.' },
];

export default function Home() {
  const words = ['Bookings', 'for', 'Kathmandu’s', 'clinics', 'and', 'salons,'];
  return (
    <div>
      <section className="container-x pt-10 sm:pt-16 pb-16 grid lg:grid-cols-[1.05fr,1fr] gap-10 lg:gap-14 items-start">
        <div className="lg:pt-6">
          <m.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>Appointments · Customer book · Nepal time</m.p>
          <h1 className="font-display text-[2.7rem] leading-[1.02] sm:text-[4.1rem] text-ink mt-4">
            {words.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.22em] pb-1">
                <m.span className="inline-block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.05 + i * 0.06, ease }}>{w}</m.span>
              </span>
            ))}
            <span className="inline-block overflow-hidden align-bottom pb-1">
              <m.span className="inline-block italic text-sindoor" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease }}>without phone tag.</m.span>
            </span>
          </h1>
          <m.p className="mt-6 text-lg text-ink-2 max-w-xl leading-relaxed" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }}>
            Palo gives a clinic, salon or any appointment business a booking page, a day sheet and a customer book. Customers pick a real free time. You confirm with one tap.
          </m.p>
          <m.div className="mt-8 flex flex-wrap items-center gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.65, ease }}>
            <Link to="/register/business" className="inline-flex h-12 items-center px-6 rounded bg-pine text-paper text-base hover:bg-pine-deep focus-ring">List your business, free</Link>
            <Link to="/explore" className="inline-flex h-12 items-center px-5 rounded border border-line-2 text-base hover:border-ink focus-ring">Find a place to book</Link>
          </m.div>
          <m.p className="mt-6 text-sm text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>The booking page here is live: its free times come straight from the system. The demo salon is not real, so nobody will expect you.</m.p>
        </div>
        <HeroDemo />
      </section>

      <section className="border-y border-line bg-sunk/40 overflow-hidden">
        <div className="container-x py-16 sm:py-24 grid lg:grid-cols-[0.9fr,1.1fr] gap-10 items-center">
          <Reveal>
            <p className="eyebrow">For the person at the front desk</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] mt-3">The whole day on one sheet.</h2>
            <p className="mt-5 text-ink-2 leading-relaxed max-w-md">Online bookings, phone bookings and walk-ins land on the same timeline. Set how many customers you can serve at once (chairs, doctors, beds) and Palo stops offering a time when it is full.</p>
            <p className="mt-4 text-ink-2 leading-relaxed max-w-md">Saturday closed? Dashain week off? Set your hours and holidays once.</p>
          </Reveal>
          <Reveal delay={0.1}><DaySheet /></Reveal>
        </div>
      </section>

      <section className="container-x py-20 sm:py-28">
        <Reveal><h2 className="font-display text-4xl sm:text-5xl max-w-2xl leading-[1.05]">What a business gets</h2></Reveal>
        <div className="mt-12 border-t border-line">
          {ROWS.map((r, i) => (
            <Reveal key={r.n} delay={i * 0.04}>
              <div className="grid sm:grid-cols-[90px,1fr,1.4fr] gap-3 sm:gap-8 py-8 border-b border-line">
                <span className="font-display text-3xl text-line-2 tnum">{r.n}</span>
                <h3 className="font-display text-2xl leading-snug flex gap-3 items-start"><r.icon className="mt-1.5 shrink-0 text-sindoor" />{r.title}</h3>
                <p className="text-ink-2 leading-relaxed">{r.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-x pb-20" aria-labelledby="pricing">
        <Reveal>
          <div className="grid lg:grid-cols-[0.8fr,1.2fr] gap-10 items-start">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2 id="pricing" className="font-display text-4xl sm:text-5xl mt-3 leading-[1.05]">Free to start. One paid plan when you grow.</h2>
              <p className="mt-5 text-ink-2 leading-relaxed">Prices in Nepali rupees. During the pilot, Pro is arranged directly with the Palo team and paid by eSewa, Khalti or bank transfer. There is no card form on this site.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[460px]">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="py-3 pr-4 font-normal text-sm text-muted w-[44%]">&nbsp;</th>
                    <th className="py-3 pr-4"><span className="font-display text-2xl">Free</span><span className="block text-sm text-muted">Rs 0</span></th>
                    <th className="py-3"><span className="font-display text-2xl">Pro</span><span className="block text-sm text-muted tnum">Rs 999 / month</span></th>
                  </tr>
                </thead>
                <tbody className="text-[0.95rem]">
                  {[
                    ['Public booking page', 'Yes', 'Yes'], ['Services', 'Up to 50', 'Up to 50'], ['Customers served at once', 'Up to 20', 'Up to 20'],
                    ['Day sheet, calendar, customer book', 'Yes', 'Yes'], ['Insights (14 and 30 days)', 'Yes', 'Yes'],
                    ['Priority help with setup', 'Email', 'Phone and on-site in the Valley'], ['SMS reminders', 'Not yet available', 'Planned, not yet available'],
                  ].map(([a, b, c]) => (
                    <tr key={a} className="border-b border-line"><td className="py-3 pr-4 text-ink-2">{a}</td><td className="py-3 pr-4">{b}</td><td className="py-3">{c}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted mt-3">Pro today mostly buys setup help and supports development. We will not charge for features that do not exist yet.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="container-x pb-8" aria-labelledby="faq">
        <Reveal>
          <h2 id="faq" className="font-display text-3xl sm:text-4xl">Questions</h2>
          <div className="mt-6 border-t border-line max-w-3xl">
            {[
              ['Do customers need an account?', 'No. They book with a name and a mobile number. If they create an account they can see and cancel their bookings in one place.'],
              ['Can customers pay online?', 'Not yet. Palo has no payment gateway connected, so booking pages say "pay at the venue". eSewa and Khalti merchant integration needs a registered business account and is planned.'],
              ['What if a customer does not show up?', 'Mark them as a no-show. Their record in your customer book shows how many times it happened.'],
              ['Can I take phone bookings too?', 'Yes. Add them from the day sheet. They use the same calendar, so online customers cannot book the same time.'],
            ].map(([q, a]) => (
              <details key={q} className="group border-b border-line py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-lg focus-ring rounded">
                  {q}<span className="text-muted transition-transform duration-200 group-open:rotate-45 text-2xl leading-none" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-ink-2 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
