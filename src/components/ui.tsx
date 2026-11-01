import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { IconClose } from './Icons';
import { STATUS_LABEL } from '../lib/format';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'line' | 'danger'; busy?: boolean; size?: 'sm' | 'md' };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', busy, size = 'md', className = '', children, disabled, ...p }, ref) {
  const v = {
    primary: 'bg-pine text-paper hover:bg-pine-deep',
    quiet: 'bg-transparent text-ink hover:bg-sunk',
    line: 'bg-card text-ink border border-line-2 hover:border-ink',
    danger: 'bg-card text-sindoor border border-sindoor/40 hover:bg-sindoor-soft',
  }[variant];
  const s = size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-5 text-[0.95rem]';
  return (
    <button ref={ref} disabled={disabled || busy} aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded font-medium transition-colors duration-150 focus-ring disabled:opacity-55 disabled:cursor-not-allowed ${v} ${s} ${className}`} {...p}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode; id?: string }) {
  const auto = useId(); const fid = id || auto; const dId = error || hint ? fid + '-d' : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-sm font-medium text-ink-2">{label}</label>
      {children(fid, dId)}
      {error ? <p id={dId} className="text-sm text-sindoor" role="alert">{error}</p> : hint ? <p id={dId} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
const inputCls = 'w-full rounded border border-line-2 bg-card px-3 h-11 text-ink placeholder:text-muted/70 focus-ring aria-[invalid=true]:border-sindoor';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...p }, ref) {
  return <input ref={ref} className={`${inputCls} ${className}`} {...p} />;
});
export function Select({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputCls} pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M2 4l4 4 4-4%22 fill=%22none%22 stroke=%22%233F4D47%22 stroke-width=%221.5%22/></svg>')] bg-no-repeat bg-[right_0.75rem_center] ${className}`} {...p}>{children}</select>;
}
export function Textarea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} h-auto py-2.5 min-h-[88px] ${className}`} {...p} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} aria-hidden="true" />;
}
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-10 w-14" /><div className="flex-1 flex flex-col gap-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-2 rounded px-6 py-10 text-center">
      <svg width="56" height="40" viewBox="0 0 56 40" className="mx-auto mb-4 text-line-2" aria-hidden="true"><path d="M8 4h40v32l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M16 14h24M16 21h14" stroke="currentColor" strokeWidth="1.5" /></svg>
      <p className="font-display text-xl text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted max-w-sm mx-auto">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-sindoor/40 bg-sindoor-soft/60 rounded px-4 py-3 text-sm text-ink flex items-center justify-between gap-4">
      <span>{message}</span>{onRetry && <Button size="sm" variant="line" onClick={() => onRetry()}>Try again</Button>}
    </div>
  );
}
export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-marigold-soft text-[#7A5007]', confirmed: 'bg-pine-soft text-pine-deep', completed: 'bg-sunk text-ink-2',
    cancelled: 'bg-transparent text-muted line-through decoration-1', no_show: 'bg-sindoor-soft text-sindoor',
  };
  return <span className={`inline-flex items-center h-6 px-2 rounded-sm text-xs font-semibold tracking-wide uppercase ${cls[status] || 'bg-sunk'}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
          <m.div ref={ref} role="dialog" aria-modal="true" aria-label={title}
            className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-auto bg-card border border-line rounded-t-lg sm:rounded-lg shadow-lift`}
            initial={{ y: 24, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0, scale: 0.99 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
              <h2 className="font-display text-xl text-ink">{title}</h2>
              <button data-close onClick={onClose} className="p-2 -mr-2 rounded hover:bg-sunk focus-ring" aria-label="Close"><IconClose /></button>
            </div>
            <div className="p-5">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

// Toasts: a single quiet line at the bottom.
type ToastT = { id: number; text: string; tone: 'ok' | 'err' };
let push: ((t: Omit<ToastT, 'id'>) => void) | null = null;
export const toast = { ok: (text: string) => push?.({ text, tone: 'ok' }), err: (text: string) => push?.({ text, tone: 'err' }) };
import { useState } from 'react';
export function Toaster() {
  const [items, setItems] = useState<ToastT[]>([]);
  useEffect(() => { push = (t) => { const id = Date.now() + Math.random(); setItems((x) => [...x.slice(-2), { ...t, id }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200); }; return () => { push = null; }; }, []);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none w-[min(92vw,420px)]" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <m.div key={t.id} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.22 }}
            className={`pointer-events-auto w-full rounded px-4 py-3 text-sm shadow-lift border ${t.tone === 'ok' ? 'bg-ink text-paper border-ink' : 'bg-sindoor text-paper border-sindoor'}`}>{t.text}</m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
