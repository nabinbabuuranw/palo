import { useState, type FormEvent } from 'react';
import { api, ApiError, errorText } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { Link, navigate, useLocation } from '../lib/router';
import { CATEGORY_LABEL } from '../lib/format';
import { Button, Field, Input, Select } from '../components/ui';
type Mode = 'login' | 'customer' | 'business';
export default function AuthPage({ mode }: { mode: Mode }) {
  const { refresh } = useAuth();
  const { search } = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', business_name: '', category: '', area: '', accept_terms: false });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setFields({});
    try {
      const path = mode === 'login' ? '/auth/login' : mode === 'customer' ? '/auth/register' : '/auth/register-business';
      const body = mode === 'login' ? { email: f.email, password: f.password } : f;
      const r = await api(path, { body });
      await refresh();
      const next = new URLSearchParams(search).get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(r.user.role), { replace: true });
    } catch (e) { if (e instanceof ApiError) setFields(e.fields); setErr(errorText(e)); }
    finally { setBusy(false); }
  };
  const title = mode === 'login' ? 'Sign in' : mode === 'customer' ? 'Create a customer account' : 'List your business';
  const lead = mode === 'login' ? 'Customers, business owners and the Palo team all sign in here.' : mode === 'customer' ? 'Optional: you can book without an account. An account keeps your bookings in one place.' : 'Your booking page is live as soon as you add a service. Free to start, no card needed.';
  const inp = (k: keyof typeof f, label: string, props: any = {}, hint?: string) => (
    <Field label={label} error={fields[k as string]} hint={hint}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!fields[k as string]} value={f[k] as string} onChange={set(k as string)} {...props} />}</Field>
  );
  return (
    <div className="container-x py-12 sm:py-16 grid lg:grid-cols-[1fr,1fr] gap-12 items-start">
      <div className="lg:pt-8">
        <p className="eyebrow">{mode === 'business' ? 'For businesses' : 'Account'}</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2 leading-[1.05]">{title}</h1>
        <p className="mt-4 text-ink-2 max-w-md leading-relaxed">{lead}</p>
        {mode === 'business' && (
          <ol className="mt-8 flex flex-col gap-4 max-w-md">
            {['Create your account and business (this page).', 'Add your services, prices and opening hours.', 'Share your booking link on Facebook, Instagram and Google Maps.'].map((s, i) => (
              <li key={i} className="flex gap-4 items-baseline"><span className="font-display text-2xl text-sindoor tnum w-6">{i + 1}</span><span className="text-ink-2">{s}</span></li>
            ))}
          </ol>
        )}
      </div>
      <form onSubmit={submit} noValidate className="bg-card border border-line rounded-lg p-6 sm:p-8 flex flex-col gap-4">
        {mode !== 'login' && inp('name', 'Your full name', { autoComplete: 'name' })}
        {mode === 'business' && (
          <>
            {inp('business_name', 'Business name', { autoComplete: 'organization' })}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Category" error={fields.category}>{(id, d) => (
                <Select id={id} aria-describedby={d} aria-invalid={!!fields.category} value={f.category} onChange={set('category')}>
                  <option value="">Choose…</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>)}</Field>
              {inp('area', 'Area', { placeholder: 'e.g. Baneshwor, Kathmandu' })}
            </div>
          </>
        )}
        {inp('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {mode !== 'login' && inp('phone', mode === 'business' ? 'Business phone (optional)' : 'Mobile (optional)', { inputMode: 'tel', autoComplete: 'tel', placeholder: '98XXXXXXXX' })}
        {inp('password', 'Password', { type: 'password', autoComplete: mode === 'login' ? 'current-password' : 'new-password' }, mode === 'login' ? undefined : 'At least 8 characters with a letter and a number')}
        {mode !== 'login' && (
          <label className="flex gap-3 items-start text-sm text-ink-2">
            <input type="checkbox" checked={f.accept_terms} onChange={set('accept_terms')} className="mt-1 h-4 w-4 accent-pine" aria-invalid={!!fields.accept_terms} />
            <span>I agree to the <a href="/terms" target="_blank" className="underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.{fields.accept_terms && <span className="block text-sindoor">{fields.accept_terms}</span>}</span>
          </label>
        )}
        {err && <p className="text-sm text-sindoor" role="alert">{err}</p>}
        <Button type="submit" busy={busy} className="mt-1">{mode === 'login' ? 'Sign in' : mode === 'customer' ? 'Create account' : 'Create my booking page'}</Button>
        <p className="text-sm text-muted text-center">
          {mode === 'login' ? <>New here? <Link to="/register" className="underline">Customer account</Link> or <Link to="/register/business" className="underline">list a business</Link></> : <>Already have an account? <Link to="/login" className="underline">Sign in</Link></>}
        </p>
      </form>
    </div>
  );
}
