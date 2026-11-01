import { useState, type FormEvent } from 'react';
import { api, errorText } from '../lib/api';
import { Button, Field, Input } from '../components/ui';
export default function Cancel() {
  const [ref, setRef] = useState(''); const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/public/cancel', { body: { ref, phone } }); setDone(true); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  return (
    <div className="container-x py-14 max-w-xl">
      <h1 className="font-display text-4xl">Cancel a booking</h1>
      <p className="text-ink-2 mt-3">Booked without an account? Enter the code from your palo slip (it starts with P-) and the mobile number you used. Online cancellation closes 1 hour before the appointment.</p>
      {done ? <p className="mt-8 border border-pine/40 bg-pine-soft/60 rounded px-4 py-3" role="status">Cancelled. The business has been told.</p> : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
          <Field label="Booking code">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="P-XXXXXX" autoCapitalize="characters" />}</Field>
          <Field label="Mobile number">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98XXXXXXXX" />}</Field>
          {err && <p className="text-sm text-sindoor" role="alert">{err}</p>}
          <Button type="submit" variant="danger" busy={busy}>Cancel booking</Button>
        </form>
      )}
    </div>
  );
}
