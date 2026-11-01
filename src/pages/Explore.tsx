import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { useApi } from '../lib/useApi';
import { Link } from '../lib/router';
import { CATEGORY_LABEL } from '../lib/format';
import { Input, Empty, ErrorBox, Skeleton } from '../components/ui';
import { IconSearch, IconPin } from '../components/Icons';
interface B { slug: string; name: string; category: string; area: string; is_demo: number; services: number }
export default function Explore() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [cat, setCat] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading, error, reload } = useApi<{ items: B[] }>(`/public/businesses?q=${encodeURIComponent(dq)}&category=${cat}`);
  return (
    <div className="container-x py-12">
      <p className="eyebrow">Directory</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-2">Find a place to book</h1>
      <p className="text-ink-2 mt-3 max-w-xl">Businesses using Palo in Nepal. Palo is new, so this list is short and honest: every entry is a business that signed up itself.</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1"><span className="sr-only">Search by name or area</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-10" placeholder="Search by name or area, e.g. Baneshwor" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
        {[['', 'All'], ...Object.entries(CATEGORY_LABEL)].map(([k, v]) => (
          <button key={k} role="radio" aria-checked={cat === k} onClick={() => setCat(k)} className={`h-8 px-3 rounded-sm text-sm border focus-ring ${cat === k ? 'bg-ink text-paper border-ink' : 'border-line-2 hover:border-ink-2'}`}>{v}</button>
        ))}
      </div>
      <div className="mt-8 border-t border-line">
        {loading && !data ? Array.from({ length: 4 }, (_, i) => <div key={i} className="py-5 border-b border-line flex gap-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-6 w-24 ml-auto" /></div>)
          : error ? <div className="mt-6"><ErrorBox message={error} onRetry={() => reload()} /></div>
            : data && data.items.length === 0 ? <div className="mt-6"><Empty title="No matches">Try another name or area, or clear the category filter.</Empty></div>
              : data?.items.map((b, i) => (
                <m.div key={b.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <Link to={`/b/${b.slug}`} className="group grid grid-cols-[1fr,auto] sm:grid-cols-[1.4fr,1fr,auto] gap-x-6 gap-y-1 py-5 border-b border-line items-center focus-ring">
                    <span className="font-display text-2xl group-hover:text-pine">{b.name}</span>
                    <span className="hidden sm:flex items-center gap-1.5 text-ink-2"><IconPin size={16} />{b.area}</span>
                    <span className="text-sm text-muted text-right">{CATEGORY_LABEL[b.category]} · {b.services} service{b.services === 1 ? '' : 's'}</span>
                    <span className="sm:hidden text-sm text-ink-2 col-span-2 flex items-center gap-1.5"><IconPin size={14} />{b.area}{b.is_demo ? ' · Demo' : ''}</span>
                  </Link>
                </m.div>
              ))}
      </div>
    </div>
  );
}
