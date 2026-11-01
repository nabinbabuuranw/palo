import { m } from 'motion/react';
// Small bar chart in SVG; bars grow from the baseline when they enter the viewport.
export function BarChart({ data, label, height = 150, format = (n: number) => String(n), highlightIndex }: { data: { label: string; value: number; sub?: string }[]; label: string; height?: number; format?: (n: number) => string; highlightIndex?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 100 / data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  const hi = highlightIndex ?? data.length - 1;
  return (
    <figure aria-label={label}>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2="100" y1={(height / 3) * (1 - g)} y2={(height / 3) * (1 - g)} stroke="#D9CFBE" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 2);
          return (
            <m.rect key={d.label + i} x={i * W + W * 0.18} width={W * 0.64} y={height / 3 - h} height={Math.max(h, d.value ? 0.6 : 0)}
              fill={i === hi ? '#B5432A' : '#24493D'}
              initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.03, ease: [0.22, 0.8, 0.24, 1] }} style={{ transformOrigin: `0 ${height / 3}px`, transformBox: 'view-box' as any }}>
              <title>{`${d.sub || d.label}: ${format(d.value)}`}</title>
            </m.rect>
          );
        })}
      </svg>
      <div className="flex mt-2 text-[10px] text-muted tnum">
        {data.map((d, i) => <span key={i} className="text-center" style={{ width: `${W}%` }}>{data.length > 10 && i % 2 ? '' : d.label}</span>)}
      </div>
      {total === 0 && <figcaption className="text-sm text-muted mt-2">No bookings in this period yet. Bars appear as bookings come in.</figcaption>}
    </figure>
  );
}
