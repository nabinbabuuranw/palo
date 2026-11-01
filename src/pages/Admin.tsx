import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { api, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Link } from '../lib/router';
import { useRequireRole } from './Me';
import { CATEGORY_LABEL, ago, dayNum, fmtDate } from '../lib/format';
import { BarChart } from '../components/BarChart';
import { Button, Empty, ErrorBox, Input, Modal, Select, Skeleton, SkeletonRows, toast } from '../components/ui';
import { IconSearch } from '../components/Icons';

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'businesses', label: 'Businesses' }, { id: 'users', label: 'People' }, { id: 'audit', label: 'Audit log' }];

export default function Admin({ section }: { section: string }) {
  const ok = useRequireRole('admin');
  const cur = TABS.find((t) => t.id === section) || TABS[0];
  useEffect(() => { document.title = `${cur.label} · Palo admin`; }, [cur]);
  if (!ok) return <div className="p-8"><SkeletonRows /></div>;
  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1280px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-3">
        <div><p className="eyebrow">Platform administration</p><h1 className="font-display text-4xl mt-1">Palo register</h1></div>
        <nav className="flex gap-1 -mb-[14px]" aria-label="Admin">
          {TABS.map((t) => (
            <Link key={t.id} to={`/admin/${t.id}`} aria-current={cur.id === t.id ? 'page' : undefined} className={`relative px-3 pb-3 pt-2 text-sm focus-ring ${cur.id === t.id ? 'text-ink font-semibold' : 'text-muted hover:text-ink'}`}>
              {t.label}{cur.id === t.id && <m.span layoutId="admintab" className="absolute left-0 right-0 bottom-0 h-[3px] bg-sindoor" />}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-8">
        {cur.id === 'overview' && <Overview />}
        {cur.id === 'businesses' && <Businesses />}
        {cur.id === 'users' && <Users />}
        {cur.id === 'audit' && <Audit />}
      </div>
    </div>
  );
}

function Overview() {
  const { data, loading, error, reload } = useApi<any>('/admin/overview');
  if (loading) return <div className="grid gap-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  if (error) return <ErrorBox message={error} onRetry={() => reload()} />;
  const figs = [['Businesses', data.businesses, `${data.active_businesses} active · ${data.demo_businesses} demo`], ['On Pro', data.pro_businesses, `${data.plan_requests} upgrade request${data.plan_requests === 1 ? '' : 's'} open`], ['People', data.users, `${data.owners} owners · ${data.customers} customers`], ['Appointments', data.appointments, 'all time, incl. demo']];
  return (
    <div>
      <p className="text-sm text-muted mb-4">Live counts from the database. Demo data is included and labelled.</p>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        {figs.map(([k, v, s]) => <div key={k} className="bg-card p-5"><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="font-display text-4xl tnum mt-1">{v}</dd><dd className="text-sm text-ink-2 mt-1">{s}</dd></div>)}
      </dl>
      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-2xl mb-4">Bookings created per day, last 14 days</h2>
        <BarChart label="Bookings created per day" data={data.bookings_created.map((d: any) => ({ label: String(dayNum(d.date)), value: d.n, sub: fmtDate(d.date) }))} />
      </section>
      {data.plan_requests > 0 && <p className="mt-8"><Link to="/admin/businesses" className="text-pine underline">Review {data.plan_requests} Pro request{data.plan_requests === 1 ? '' : 's'}</Link></p>}
    </div>
  );
}

function Businesses() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [st, setSt] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading, error, reload } = useApi<{ items: any[] }>(`/admin/businesses?q=${encodeURIComponent(dq)}&status=${st}`);
  const [edit, setEdit] = useState<any | null>(null); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api(`/admin/businesses/${edit.id}`, { method: 'PATCH', body: { status: edit.status, plan: edit.plan, plan_until: edit.plan === 'pro' && edit.plan_until ? edit.plan_until : null } }); toast.ok('Business updated'); setEdit(null); reload(true); } catch (e) { toast.err(errorText(e)); } finally { setBusy(false); } };
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="relative flex-1 max-w-md"><span className="sr-only">Search businesses</span><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Name, owner email or area" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Select aria-label="Status" className="sm:w-44" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="suspended">Paused</option></Select>
      </div>
      {loading && !data ? <SkeletonRows rows={5} /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : data!.items.length === 0 ? <Empty title="No businesses match" /> : (
        <div className="overflow-x-auto border border-line bg-card">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line"><th className="p-3 font-semibold">Business</th><th className="p-3 font-semibold">Owner</th><th className="p-3 font-semibold">Plan</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold text-right">Bookings</th><th className="p-3 font-semibold">Joined</th><th className="p-3" /></tr></thead>
            <tbody>{data!.items.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="p-3"><a href={`/b/${b.slug}`} target="_blank" rel="noopener" className="font-medium hover:text-pine">{b.name}</a>{b.is_demo ? <span className="ml-2 text-[10px] uppercase border border-line-2 px-1 rounded-sm">demo</span> : null}<span className="block text-muted">{CATEGORY_LABEL[b.category]} · {b.area}</span></td>
                <td className="p-3 break-all">{b.owner_email}</td>
                <td className="p-3">{b.plan === 'pro' ? 'Pro' : 'Free'}{b.plan_requested_at && b.plan !== 'pro' ? <span className="block text-marigold text-xs font-semibold">Pro requested</span> : null}{b.plan_until ? <span className="block text-muted text-xs">until {b.plan_until}</span> : null}</td>
                <td className="p-3">{b.status === 'active' ? 'Active' : <span className="text-sindoor">Paused</span>}</td>
                <td className="p-3 text-right tnum">{b.appointments}</td>
                <td className="p-3 text-muted">{ago(b.created_at)}</td>
                <td className="p-3 text-right"><Button size="sm" variant="line" onClick={() => setEdit({ ...b })}>Manage</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name || ''}>
        {edit && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">Booking page<Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Active (public)</option><option value="suspended">Paused (hidden, no bookings)</option></Select></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">Plan<Select value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}><option value="free">Free</option><option value="pro">Pro</option></Select></label>
            {edit.plan === 'pro' && <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">Pro paid until<Input type="date" value={edit.plan_until || ''} onChange={(e) => setEdit({ ...edit, plan_until: e.target.value })} /></label>}
            <p className="text-xs text-muted">Changes notify the owner and are written to the audit log. Record Pro only after payment has actually been received.</p>
            <Button busy={busy} onClick={save}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Users() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [role, setRole] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading, error, reload } = useApi<{ items: any[] }>(`/admin/users?q=${encodeURIComponent(dq)}&role=${role}`);
  const toggle = async (u: any) => { try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } }); toast.ok(u.disabled ? 'Account enabled' : 'Account disabled and signed out'); reload(true); } catch (e) { toast.err(errorText(e)); } };
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="relative flex-1 max-w-md"><span className="sr-only">Search people</span><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Select aria-label="Role" className="sm:w-44" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="customer">Customers</option><option value="owner">Business owners</option><option value="admin">Admins</option></Select>
      </div>
      {loading && !data ? <SkeletonRows rows={5} /> : error ? <ErrorBox message={error} onRetry={() => reload()} /> : data!.items.length === 0 ? <Empty title="No one matches" /> : (
        <ul className="border-t border-line">{data!.items.map((u) => (
          <li key={u.id} className="grid grid-cols-[1fr,auto] sm:grid-cols-[1.4fr,1fr,120px,auto] gap-x-6 gap-y-1 items-center py-3 border-b border-line">
            <span><span className="font-medium">{u.name}</span>{u.disabled ? <span className="ml-2 text-xs text-sindoor">disabled</span> : null}<span className="block text-sm text-muted break-all">{u.email}</span></span>
            <span className="hidden sm:block text-sm text-ink-2 capitalize">{u.role === 'owner' ? 'Business owner' : u.role}</span>
            <span className="hidden sm:block text-sm text-muted">{ago(u.created_at)}</span>
            <span className="text-right">{u.role !== 'admin' && <Button size="sm" variant={u.disabled ? 'line' : 'danger'} onClick={() => toggle(u)}>{u.disabled ? 'Enable' : 'Disable'}</Button>}</span>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

function Audit() {
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/admin/audit');
  if (loading) return <SkeletonRows rows={5} />;
  if (error) return <ErrorBox message={error} onRetry={() => reload()} />;
  if (!data!.items.length) return <Empty title="No admin actions yet">Changes to businesses and accounts are recorded here.</Empty>;
  return (
    <ol className="border-l-2 border-line ml-2">{data!.items.map((a) => (
      <li key={a.id} className="pl-5 pb-5 relative"><span className="absolute -left-[5px] top-1.5 w-2 h-2 bg-ink" />
        <p className="text-sm"><span className="font-medium">{a.actor_email}</span> · <code className="text-xs bg-sunk px-1">{a.action}</code> · {a.target}</p>
        {a.detail && <p className="text-xs text-muted break-all mt-0.5">{a.detail}</p>}<p className="text-xs text-muted mt-0.5">{ago(a.created_at)}</p></li>
    ))}</ol>
  );
}
