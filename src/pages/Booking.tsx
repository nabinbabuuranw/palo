import { useEffect } from 'react';
import { useApi } from '../lib/useApi';
import { BookingFlow } from '../components/BookingFlow';
import { CATEGORY_LABEL, DAY_NAMES, fmtTime, fmtDate } from '../lib/format';
import { Skeleton, Empty } from '../components/ui';
import { IconPin, IconPhone, IconClock } from '../components/Icons';
import { Link } from '../lib/router';
export default function Booking({ slug }: { slug: string }) {
  const { data, loading, error } = useApi<any>(`/public/b/${slug}`);
  useEffect(() => { if (data?.business) document.title = `Book ${data.business.name} · Palo`; }, [data]);
  if (loading) return <div className="container-x py-12 grid lg:grid-cols-[0.8fr,1.2fr] gap-10"><div className="flex flex-col gap-3"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40" /></div><Skeleton className="h-96" /></div>;
  if (error || !data) return <div className="container-x py-16"><Empty title="This booking page is not available" action={<Link to="/explore" className="underline">Browse businesses</Link>}>The link may be wrong, or the business has paused online booking.</Empty></div>;
  const b = data.business;
  return (
    <div className="container-x py-10 sm:py-14 grid lg:grid-cols-[0.8fr,1.2fr] gap-10 lg:gap-16 items-start">
      <aside className="lg:sticky lg:top-24">
        {b.is_demo ? <p className="inline-block mb-4 text-xs border border-sindoor/50 text-sindoor rounded-sm px-2 py-1">Demo business. Bookings here are test data; nobody will expect you.</p> : null}
        <p className="eyebrow">{CATEGORY_LABEL[b.category]}</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] mt-2">{b.name.replace(/^Demo business:\s*/, '')}</h1>
        <div className="mt-5 flex flex-col gap-2 text-ink-2">
          <p className="flex items-start gap-2"><IconPin className="mt-0.5 shrink-0" />{b.address ? `${b.address}, ${b.area}` : b.area}</p>
          {b.phone && <p className="flex items-center gap-2"><IconPhone className="shrink-0" /><a className="underline underline-offset-4" href={`tel:${b.phone}`}>{b.phone}</a></p>}
        </div>
        {b.about && <p className="mt-5 text-ink-2 leading-relaxed whitespace-pre-line">{b.about}</p>}
        <div className="mt-7 border-t border-line pt-5">
          <p className="eyebrow flex items-center gap-2 mb-3"><IconClock size={16} />Opening hours</p>
          <table className="text-sm w-full max-w-xs"><tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((wd) => { const h = data.hours.find((x: any) => x.weekday === wd); return (
              <tr key={wd} className="border-b border-line/70"><td className="py-1.5 text-ink-2">{DAY_NAMES[wd]}</td><td className="py-1.5 text-right tnum">{!h || h.closed ? <span className="text-muted">Closed</span> : `${fmtTime(h.open_min)} to ${fmtTime(h.close_min)}`}</td></tr>); })}
          </tbody></table>
          {data.blocks.length > 0 && <p className="text-sm text-muted mt-3">Also closed: {data.blocks.slice(0, 4).map((x: any) => `${fmtDate(x.date)} (${x.reason})`).join(', ')}</p>}
        </div>
      </aside>
      <section className="bg-card border border-line rounded-lg p-5 sm:p-7" aria-label="Book an appointment">
        <h2 className="font-display text-2xl mb-5">Book a time</h2>
        <BookingFlow slug={slug} />
      </section>
    </div>
  );
}
