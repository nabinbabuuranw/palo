import { useEffect } from 'react';
import { m } from 'motion/react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { ago } from '../lib/format';
import { Link } from '../lib/router';
import { Skeleton } from './ui';
interface N { id: number; kind: string; body: string; link: string; created_at: number; read_at: number | null }
export function Notifications({ onClose }: { onClose: () => void }) {
  const { data, loading, error } = useApi<{ items: N[] }>('/notifications');
  const { refresh, unread } = useAuth();
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  const markAll = async () => { await api('/notifications/read-all', { method: 'POST' }); refresh(); onClose(); };
  return (
    <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
      className="absolute right-0 mt-2 w-[min(92vw,360px)] bg-card border border-line rounded-md shadow-lift z-50" role="region" aria-label="Notifications">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="font-display text-lg">Notifications</p>
        {unread > 0 && <button onClick={markAll} className="text-sm text-pine hover:underline focus-ring rounded">Mark all read</button>}
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {loading && <div className="p-4 flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        {error && <p className="p-4 text-sm text-sindoor">{error}</p>}
        {data && data.items.length === 0 && <p className="p-6 text-sm text-muted text-center">Nothing yet. New bookings and status changes show up here.</p>}
        {data?.items.map((n) => (
          <Link key={n.id} to={n.link || '#'} onClick={onClose} className={`block px-4 py-3 border-b border-line last:border-0 hover:bg-sunk/60 ${n.read_at ? '' : 'bg-pine-soft/40'}`}>
            <p className="text-sm text-ink leading-snug">{n.body}</p>
            <p className="text-xs text-muted mt-1">{ago(n.created_at)}</p>
          </Link>
        ))}
      </div>
    </m.div>
  );
}
