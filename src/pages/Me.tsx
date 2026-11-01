import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, homeFor } from '../lib/auth';
import { navigate, Link } from '../lib/router';
import { fmtDate, fmtTime, npr } from '../lib/format';
import { Button, Empty, ErrorBox, Field, Input, Modal, SkeletonRows, StatusPill, toast } from '../components/ui';
interface A { id: number; ref: string; date: string; start_min: number; status: string; service_name: string; price_npr: number; business_name: string; business_slug: string; area: string; business_phone: string | null }

export function useRequireRole(role: string) {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) navigate('/login?next=' + encodeURIComponent(location.pathname), { replace: true });
    else if (user.role !== role) navigate(homeFor(user.role), { replace: true });
  }, [user, loading, role]);
  return !loading && user?.role === role;
}

export default function Me() {
  const ok = useRequireRole('customer');
  const [tab, setTab] = useState<'upcoming' | 'past' | 'settings'>('upcoming');
  const { data, loading, error, reload } = useApi<{ items: A[]; today: { date: string; min: number } }>(ok ? '/me/appointments' : null);
  const [confirm, setConfirm] = useState<A | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ok) return <div className="container-x py-12"><SkeletonRows /></div>;
  const today = data?.today;
  const isUpcoming = (a: A) => today && ['pending', 'confirmed'].includes(a.status) && (a.date > today.date || (a.date === today.date && a.start_min >= today.min));
  const list = (data?.items || []).filter((a) => tab === 'upcoming' ? isUpcoming(a) : !isUpcoming(a));
  if (tab === 'upcoming') list.reverse();
  const cancel = async () => {
    if (!confirm) return; setBusy(true);
    try { await api(`/me/appointments/${confirm.id}/cancel`, { method: 'POST' }); toast.ok('Booking cancelled. The business has been told.'); setConfirm(null); reload(true); }
    catch (e) { toast.err(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="container-x py-10 sm:py-14">
      <h1 className="font-display text-4xl sm:text-5xl">My bookings</h1>
      <div className="mt-6 flex gap-6 border-b border-line" role="tablist">
        {(['upcoming', 'past', 'settings'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`pb-3 -mb-px border-b-2 capitalize focus-ring ${tab === t ? 'border-sindoor text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{t === 'settings' ? 'Account' : t}</button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'settings' ? <AccountSettings allowDelete /> : loading ? <SkeletonRows /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : list.length === 0 ? (
          <Empty title={tab === 'upcoming' ? 'No upcoming bookings' : 'Nothing here yet'} action={<Link to="/explore" className="inline-flex h-11 items-center px-5 rounded bg-pine text-paper">Find a place to book</Link>}>
            {tab === 'upcoming' ? 'Bookings you make while signed in show up here.' : 'Past and cancelled bookings will be listed here.'}
          </Empty>
        ) : (
          <ul className="border-t border-line">
            {list.map((a) => (
              <li key={a.id} className="grid grid-cols-[72px,1fr] sm:grid-cols-[96px,1fr,auto] gap-x-5 gap-y-2 py-5 border-b border-line items-center">
                <div className="text-center border border-line-2 rounded py-2 bg-card"><p className="text-[10px] uppercase tracking-wider text-muted">{fmtDate(a.date).split(',')[0]}</p><p className="font-display text-2xl leading-none tnum">{a.date.slice(8)}</p><p className="text-xs tnum text-ink-2 mt-1">{fmtTime(a.start_min)}</p></div>
                <div>
                  <Link to={`/b/${a.business_slug}`} className="font-display text-xl hover:text-pine">{a.business_name}</Link>
                  <p className="text-sm text-ink-2">{a.service_name} · {a.price_npr ? npr(a.price_npr) : 'Free'} · {a.area}</p>
                  <p className="text-xs text-muted tnum mt-1">Code {a.ref}{a.business_phone ? ` · ${a.business_phone}` : ''}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:justify-end">
                  <StatusPill status={a.status} />
                  {isUpcoming(a) && <Button size="sm" variant="danger" onClick={() => setConfirm(a)}>Cancel</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Cancel this booking?">
        {confirm && <p className="text-ink-2">{confirm.business_name}, {fmtDate(confirm.date)} at {fmtTime(confirm.start_min)}. The business will be told and the time freed for someone else.</p>}
        <div className="mt-6 flex justify-end gap-2"><Button variant="quiet" onClick={() => setConfirm(null)}>Keep it</Button><Button variant="danger" busy={busy} onClick={cancel}>Cancel booking</Button></div>
      </Modal>
    </div>
  );
}

export function AccountSettings({ allowDelete = false }: { allowDelete?: boolean }) {
  const { user, setUser, refresh, logout } = useAuth();
  const [p, setP] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [del, setDel] = useState(false); const [delPw, setDelPw] = useState('');
  const saveProfile = async (e: FormEvent) => { e.preventDefault(); setBusy('p'); setFe({});
    try { const r = await api('/account', { method: 'PATCH', body: p }); setUser(r.user); toast.ok('Profile saved'); } catch (e) { if (e instanceof ApiError) setFe(e.fields); toast.err(errorText(e)); } finally { setBusy(null); } };
  const savePw = async (e: FormEvent) => { e.preventDefault(); setBusy('pw'); setFe({});
    try { await api('/account/password', { body: pw }); setPw({ current: '', next: '' }); toast.ok('Password changed. Other devices were signed out.'); refresh(); } catch (e) { if (e instanceof ApiError) setFe(e.fields); toast.err(errorText(e)); } finally { setBusy(null); } };
  const doDelete = async () => { setBusy('d'); try { await api('/account', { method: 'DELETE', body: { password: delPw } }); await logout(); navigate('/'); toast.ok('Your account was deleted.'); } catch (e) { toast.err(errorText(e)); } finally { setBusy(null); } };
  return (
    <div className="grid lg:grid-cols-2 gap-10 max-w-4xl">
      <form onSubmit={saveProfile} className="flex flex-col gap-4" noValidate>
        <h2 className="font-display text-2xl">Profile</h2>
        <p className="text-sm text-muted">Signed in as {user?.email}</p>
        <Field label="Name" error={fe.name}>{(id) => <Input id={id} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />}</Field>
        <Field label="Mobile" error={fe.phone}>{(id) => <Input id={id} value={p.phone} inputMode="tel" onChange={(e) => setP({ ...p, phone: e.target.value })} />}</Field>
        <Button type="submit" busy={busy === 'p'} className="self-start">Save profile</Button>
      </form>
      <form onSubmit={savePw} className="flex flex-col gap-4" noValidate>
        <h2 className="font-display text-2xl">Password</h2>
        <Field label="Current password" error={fe.current}>{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}</Field>
        <Field label="New password" error={fe.next} hint="At least 8 characters with a letter and a number">{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}</Field>
        <Button type="submit" variant="line" busy={busy === 'pw'} className="self-start">Change password</Button>
      </form>
      {allowDelete && (
        <div className="lg:col-span-2 border-t border-line pt-6">
          <h2 className="font-display text-2xl">Delete account</h2>
          <p className="text-sm text-ink-2 mt-2 max-w-xl">Deletes your login and notifications. Businesses keep the appointment records they need (name, phone, time), as explained in the Privacy Policy.</p>
          <Button variant="danger" className="mt-4" onClick={() => setDel(true)}>Delete my account</Button>
          <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
            <p className="text-sm text-ink-2 mb-4">This cannot be undone. Enter your password to confirm.</p>
            <Field label="Password">{(id) => <Input id={id} type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />}</Field>
            <div className="mt-6 flex justify-end gap-2"><Button variant="quiet" onClick={() => setDel(false)}>Keep account</Button><Button variant="danger" busy={busy === 'd'} onClick={doDelete}>Delete</Button></div>
          </Modal>
        </div>
      )}
    </div>
  );
}
