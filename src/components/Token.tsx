import { m, useReducedMotion } from 'motion/react';
import { fmtDateLong, fmtTime, npr } from '../lib/format';
// The booking confirmation: a queue token slip, "printed" from the top.
export function Token({ booking }: { booking: { ref: string; status: string; date: string; start_min: number; name: string; business: { name: string; area?: string; address?: string; phone?: string | null; payment_note?: string }; service: { name: string; duration_min: number; price_npr: number } } }) {
  const reduce = useReducedMotion();
  return (
    <m.div initial={reduce ? false : { clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 -12px 0)' }} transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}
      className="slip shadow-slip px-6 pt-6 pb-8 max-w-sm mx-auto" aria-live="polite">
      <div className="flex flex-col gap-3">
        <div>
          <p className="eyebrow">Your palo</p>
          <p className="font-display text-[2.4rem] leading-none mt-2 tnum text-ink whitespace-nowrap">{booking.ref}</p>
        </div>
        <span className={`self-start text-xs font-semibold uppercase tracking-wide px-2 h-6 inline-flex items-center rounded-sm ${booking.status === 'confirmed' ? 'bg-pine-soft text-pine-deep' : 'bg-marigold-soft text-[#7A5007]'}`}>
          {booking.status === 'confirmed' ? 'Confirmed' : 'Waiting for the business'}
        </span>
      </div>
      <div className="perf my-5" />
      <dl className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-2.5 text-sm">
        <dt className="text-muted">Where</dt><dd className="text-ink font-medium">{booking.business.name}{booking.business.area ? <span className="block text-muted font-normal">{booking.business.address || booking.business.area}</span> : null}</dd>
        <dt className="text-muted">When</dt><dd className="text-ink font-medium">{fmtDateLong(booking.date)}<span className="block">{fmtTime(booking.start_min)}</span></dd>
        <dt className="text-muted">For</dt><dd className="text-ink">{booking.service.name} · {booking.service.duration_min} min</dd>
        <dt className="text-muted">Price</dt><dd className="text-ink tnum">{booking.service.price_npr ? npr(booking.service.price_npr) : 'Free'}</dd>
        <dt className="text-muted">Name</dt><dd className="text-ink">{booking.name}</dd>
      </dl>
      <div className="perf my-5" />
      <p className="text-xs text-muted leading-relaxed">{booking.business.payment_note || 'Pay at the venue.'} Keep this code: you can cancel with it and the phone number you used.</p>
    </m.div>
  );
}
