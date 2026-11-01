import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleApi, validPhone, validEmail, slugify, clean, SESSION_COOKIE } from '../src/worker.ts';
import { computeSlots, ktmNow, addDays, parseDate, parseTime, weekdayOf } from '../src/time.ts';
import { hashPassword, verifyPassword } from '../src/crypto.ts';
import { D1Shim } from './d1shim.ts';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://palo.sites.tab.bot';
// Tests use their own throwaway setup key (its hash is passed as an env override); the production key is not in this repo.
const SETUP_KEY = 'test-setup-key-' + Math.random().toString(36).slice(2);
let env: any;
let ipCounter = 0;
async function call(method: string, path: string, opts: { body?: any; cookie?: string; origin?: string | null; ip?: string; headers?: Record<string, string> } = {}) {
  const h: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.origin !== null && method !== 'GET') h.Origin = opts.origin || ORIGIN;
  if (opts.cookie) h.Cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.body !== undefined) h['Content-Type'] = 'application/json';
  h['CF-Connecting-IP'] = opts.ip || `10.0.0.${++ipCounter % 250}`;
  const res = await handleApi(new Request(ORIGIN + path, { method, headers: h, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }), env);
  const text = await res.text();
  const setCookie = res.headers.get('set-cookie') || '';
  const m = new RegExp(SESSION_COOKIE + '=([^;]*)').exec(setCookie);
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: m ? m[1] : null, setCookie, headers: res.headers };
}
// Helper: a date in the future that falls on a weekday the default hours keep open (Sun-Fri).
function openDate(daysAhead = 3) {
  let d = addDays(ktmNow().date, daysAhead);
  while (weekdayOf(d) === 6) d = addDays(d, 1);
  return d;
}

let owner: string, owner2: string, customer: string, customer2: string, admin: string;
let bizSlug: string, svcId: number, biz2Slug: string;

test.before(async () => {
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SETUP_KEY))), (b) => b.toString(16).padStart(2, '0')).join('');
  env = { DB: new D1Shim(), SETUP_KEY_SHA256: h };
});

test('validation helpers', () => {
  assert.equal(validPhone('9841234567'), '9841234567');
  assert.equal(validPhone('+977 984-123-4567'), '9841234567');
  assert.equal(validPhone('014412345'), '014412345');
  assert.equal(validPhone('12345'), null);
  assert.equal(validPhone('9541234567'), null);
  assert.equal(validEmail('A@B.com'), 'a@b.com');
  assert.equal(validEmail('nope'), null);
  assert.equal(slugify('Ram\'s Dental Clinic, Baneshwor!'), 'ram-s-dental-clinic-baneshwor');
  assert.equal(clean('  hi\u0000 ', 10), 'hi');
  assert.equal(clean('x'.repeat(11), 10), null);
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026-11-01'), '2026-11-01');
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('09:30'), 570);
});

test('Kathmandu clock is UTC+05:45', () => {
  const t = Date.UTC(2026, 10, 1, 18, 30); // 18:30 UTC = 00:15 next day in Kathmandu
  assert.deepEqual(ktmNow(t), { date: '2026-11-02', min: 15 });
});

test('slot engine: fits before closing, respects capacity, lead time and past dates', () => {
  const base = { date: '2030-01-01', open: 600, close: 720, closed: false, duration: 45, step: 30, capacity: 1, booked: [] as any[], nowDate: '2029-12-31', nowMin: 0, leadMin: 60 };
  assert.deepEqual(computeSlots(base).map((s) => s.time), ['10:00', '10:30', '11:00']); // 11:30 + 45 > 12:00
  const booked = computeSlots({ ...base, booked: [{ start_min: 630, end_min: 660 }] });
  assert.deepEqual(booked.map((s) => s.left), [0, 0, 1]);
  assert.equal(computeSlots({ ...base, capacity: 2, booked: [{ start_min: 630, end_min: 675 }] })[1].left, 1);
  assert.deepEqual(computeSlots({ ...base, nowDate: '2030-01-01', nowMin: 590 }).map((s) => s.time), ['11:00']); // 09:50 + 60 lead
  assert.equal(computeSlots({ ...base, nowDate: '2030-01-02' }).length, 0);
  assert.equal(computeSlots({ ...base, closed: true }).length, 0);
});

test('password hashing: PBKDF2 round trip, wrong password fails, tampered hash fails', async () => {
  const h = await hashPassword('correct horse 1');
  assert.match(h, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword('correct horse 1', h), true);
  assert.equal(await verifyPassword('correct horse 2', h), false);
  assert.equal(await verifyPassword('correct horse 1', h.slice(0, -2) + 'AA'), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('health answers without auth', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.json.database, 'connected');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('register: validation errors are per field; terms must be accepted', async () => {
  const r = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'bad', password: 'short' } });
  assert.equal(r.status, 422);
  assert.ok(r.json.fields.name && r.json.fields.email && r.json.fields.password && r.json.fields.accept_terms);
});

test('register customer + owner, session cookie is HttpOnly Secure SameSite', async () => {
  const c = await call('POST', '/api/auth/register', { body: { name: 'Sita Customer', email: 'sita@example.com', password: 'pass1234', phone: '9841000001', accept_terms: true } });
  assert.equal(c.status, 201); assert.equal(c.json.user.role, 'customer');
  assert.match(c.setCookie, /HttpOnly/); assert.match(c.setCookie, /Secure/); assert.match(c.setCookie, /SameSite=Lax/);
  customer = c.cookie!;
  const dup = await call('POST', '/api/auth/register', { body: { name: 'Sita Again', email: 'SITA@example.com', password: 'pass1234', accept_terms: true } });
  assert.equal(dup.status, 409);
  const o = await call('POST', '/api/auth/register-business', { body: { name: 'Hari Owner', email: 'hari@example.com', password: 'pass1234', phone: '9841000002', business_name: 'Hari Dental Care', category: 'dental', area: 'Baneshwor, Kathmandu', accept_terms: true } });
  assert.equal(o.status, 201); assert.equal(o.json.user.role, 'owner'); assert.equal(o.json.business.slug, 'hari-dental-care');
  owner = o.cookie!; bizSlug = o.json.business.slug;
  const o2 = await call('POST', '/api/auth/register-business', { body: { name: 'Gita Owner', email: 'gita@example.com', password: 'pass1234', business_name: 'Hari Dental Care', category: 'salon', area: 'Patan', accept_terms: true } });
  assert.equal(o2.json.business.slug, 'hari-dental-care-2'); owner2 = o2.cookie!; biz2Slug = o2.json.business.slug;
  const c2 = await call('POST', '/api/auth/register', { body: { name: 'Ram Customer', email: 'ram@example.com', password: 'pass1234', accept_terms: true } });
  customer2 = c2.cookie!;
  const bad = await call('POST', '/api/auth/register-business', { body: { name: 'X Owner', email: 'x@example.com', password: 'pass1234', business_name: 'X', category: 'casino', area: 'Y', accept_terms: true } });
  assert.equal(bad.status, 422); assert.ok(bad.json.fields.category);
});

test('login / me / logout; wrong password and unknown email look the same', async () => {
  const bad1 = await call('POST', '/api/auth/login', { body: { email: 'sita@example.com', password: 'wrong1234' } });
  const bad2 = await call('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'wrong1234' } });
  assert.equal(bad1.status, 401); assert.deepEqual(bad1.json, bad2.json);
  const ok = await call('POST', '/api/auth/login', { body: { email: 'Sita@Example.com', password: 'pass1234' } });
  assert.equal(ok.status, 200);
  const me = await call('GET', '/api/auth/me', { cookie: ok.cookie! });
  assert.equal(me.json.user.email, 'sita@example.com');
  const out = await call('POST', '/api/auth/logout', { cookie: ok.cookie!, body: {} });
  assert.equal(out.status, 200);
  const me2 = await call('GET', '/api/auth/me', { cookie: ok.cookie! });
  assert.equal(me2.json.user, null);
  assert.equal((await call('GET', '/api/auth/me', { cookie: 'forged-token-forged-token-forged-token-xx' })).json.user, null);
});

test('login is rate limited per email', async () => {
  let last: any;
  for (let i = 0; i < 12; i++) last = await call('POST', '/api/auth/login', { body: { email: 'ratelimit@example.com', password: 'nope1234' } });
  assert.equal(last.status, 429); assert.ok(last.headers.get('retry-after'));
});

test('CSRF: cross-origin and non-JSON writes are refused', async () => {
  const x = await call('POST', '/api/auth/login', { origin: 'https://evil.example', body: { email: 'a@b.co', password: 'x' } });
  assert.equal(x.status, 403);
  const site = await call('POST', '/api/auth/login', { headers: { 'Sec-Fetch-Site': 'cross-site' }, body: { email: 'a@b.co', password: 'x' } });
  assert.equal(site.status, 403);
  const res = await handleApi(new Request(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN }, body: 'email=a' }), env);
  assert.equal(res.status, 415);
});

test('RBAC: roles are enforced on every private area', async () => {
  assert.equal((await call('GET', '/api/biz')).status, 401);
  assert.equal((await call('GET', '/api/biz', { cookie: customer })).status, 403);
  assert.equal((await call('GET', '/api/admin/overview', { cookie: owner })).status, 403);
  assert.equal((await call('GET', '/api/admin/users', { cookie: customer })).status, 403);
  assert.equal((await call('GET', '/api/me/appointments', { cookie: owner })).status, 403);
  assert.equal((await call('GET', '/api/biz', { cookie: owner })).status, 200);
});

test('owner sets up services, hours, capacity', async () => {
  const bad = await call('POST', '/api/biz/services', { cookie: owner, body: { name: 'X', duration_min: 2, price_npr: -1 } });
  assert.equal(bad.status, 422);
  const s = await call('POST', '/api/biz/services', { cookie: owner, body: { name: 'Dental check-up', duration_min: 30, price_npr: 800 } });
  assert.equal(s.status, 201); svcId = s.json.service.id;
  const biz = await call('GET', '/api/biz', { cookie: owner });
  assert.equal(biz.json.hours.length, 7);
  const hours = biz.json.hours.map((h: any) => ({ ...h, open_min: 600, close_min: 720, closed: h.weekday === 6 }));
  assert.equal((await call('PUT', '/api/biz/hours', { cookie: owner, body: { hours } })).status, 200);
  const badHours = hours.map((h: any) => ({ ...h, close_min: 500 }));
  assert.equal((await call('PUT', '/api/biz/hours', { cookie: owner, body: { hours: badHours } })).status, 422);
  const p = await call('PATCH', '/api/biz', { cookie: owner, body: { ...biz.json.business, capacity: 1, slot_step: 30, lead_min: 0, auto_confirm: false, phone: '014412345' } });
  assert.equal(p.status, 200);
  // owner 2 cannot edit owner 1's service
  assert.equal((await call('PATCH', '/api/biz/services/' + svcId, { cookie: owner2, body: { name: 'Hacked', duration_min: 30, price_npr: 1 } })).status, 404);
});

test('public booking: slots, guest booking, capacity race, notifications', async () => {
  const pub = await call('GET', '/api/public/b/' + bizSlug);
  assert.equal(pub.status, 200); assert.equal(pub.json.services.length, 1);
  assert.equal(pub.json.business.owner_id, undefined, 'owner id is not leaked');
  const date = openDate(3);
  const slots = await call('GET', `/api/public/b/${bizSlug}/slots?date=${date}&service=${svcId}`);
  assert.deepEqual(slots.json.slots.map((s: any) => s.time), ['10:00', '10:30', '11:00', '11:30']);
  const bad = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date, time: '10:00', name: 'G', phone: '123' } });
  assert.equal(bad.status, 422); assert.ok(bad.json.fields.name && bad.json.fields.phone);
  const g = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date, time: '10:00', name: 'Guest Person', phone: '9800000001' } });
  assert.equal(g.status, 201); assert.match(g.json.booking.ref, /^P-[A-Z0-9]{6}$/); assert.equal(g.json.booking.status, 'pending');
  const again = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date, time: '10:00', name: 'Second Person', phone: '9800000002' } });
  assert.equal(again.status, 409, 'capacity 1: second booking for the same slot is refused');
  const notOnGrid = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date, time: '10:10', name: 'Odd Time', phone: '9800000002' } });
  assert.equal(notOnGrid.status, 409);
  const after = await call('GET', `/api/public/b/${bizSlug}/slots?date=${date}&service=${svcId}`);
  assert.equal(after.json.slots[0].left, 0);
  const c = await call('POST', `/api/public/b/${bizSlug}/book`, { cookie: customer, body: { service_id: svcId, date, time: '11:00', name: 'Sita Customer', phone: '9841000001', note: 'Tooth ache' } });
  assert.equal(c.status, 201);
  const notes = await call('GET', '/api/notifications', { cookie: owner });
  assert.equal(notes.json.items.length, 2); assert.match(notes.json.items[0].body, /New booking/);
  const past = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date: addDays(ktmNow().date, -1), time: '10:00', name: 'Past', phone: '9800000003' } });
  assert.equal(past.status, 422);
  const far = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date: addDays(ktmNow().date, 90), time: '10:00', name: 'Far', phone: '9800000003' } });
  assert.equal(far.status, 422);
  const sat = (() => { let d = addDays(ktmNow().date, 2); while (weekdayOf(d) !== 6) d = addDays(d, 1); return d; })();
  const closed = await call('GET', `/api/public/b/${bizSlug}/slots?date=${sat}&service=${svcId}`);
  assert.equal(closed.json.slots.length, 0); assert.ok(closed.json.closed);
});

test('blocked date closes the day', async () => {
  const d = openDate(5);
  const b = await call('POST', '/api/biz/blocks', { cookie: owner, body: { date: d, reason: 'Dashain holiday' } });
  assert.equal(b.status, 201);
  const s = await call('GET', `/api/public/b/${bizSlug}/slots?date=${d}&service=${svcId}`);
  assert.equal(s.json.slots.length, 0); assert.equal(s.json.closed, 'Dashain holiday');
  assert.equal((await call('DELETE', '/api/biz/blocks/' + b.json.block.id, { cookie: owner, body: {} })).status, 200);
});

test('owner workflow: list, filter, search, status transitions, customer book (CRM)', async () => {
  const list = await call('GET', '/api/biz/appointments?status=pending', { cookie: owner });
  assert.equal(list.json.items.length, 2);
  const search = await call('GET', '/api/biz/appointments?q=Guest', { cookie: owner });
  assert.equal(search.json.items.length, 1);
  const id = search.json.items[0].id;
  assert.equal((await call('PATCH', `/api/biz/appointments/${id}`, { cookie: owner, body: { status: 'completed' } })).status, 409, 'pending cannot jump to completed');
  assert.equal((await call('PATCH', `/api/biz/appointments/${id}`, { cookie: owner, body: { status: 'confirmed' } })).status, 200);
  assert.equal((await call('PATCH', `/api/biz/appointments/${id}`, { cookie: owner, body: { status: 'completed' } })).status, 200);
  assert.equal((await call('PATCH', `/api/biz/appointments/${id}`, { cookie: owner2, body: { status: 'cancelled' } })).status, 404, 'another owner cannot touch it');
  const cust = await call('GET', '/api/biz/customers', { cookie: owner });
  assert.equal(cust.json.items.length, 2);
  const guest = cust.json.items.find((c: any) => c.phone === '9800000001');
  assert.equal(guest.visits, 1); assert.equal(guest.spent_npr, 800);
  assert.equal((await call('PATCH', '/api/biz/customers/' + guest.id, { cookie: owner, body: { notes: 'Prefers morning' } })).status, 200);
  const detail = await call('GET', '/api/biz/customers/' + guest.id, { cookie: owner });
  assert.equal(detail.json.customer.notes, 'Prefers morning'); assert.equal(detail.json.history.length, 1);
  assert.equal((await call('GET', '/api/biz/customers/' + guest.id, { cookie: owner2 })).status, 404);
  assert.equal((await call('DELETE', '/api/biz/customers/' + guest.id, { cookie: owner2, body: {} })).status, 404, 'another owner cannot delete it');
  const walkin = await call('POST', '/api/biz/appointments', { cookie: owner, body: { service_id: svcId, date: openDate(4), time: '10:30', name: 'Walk In', phone: '9800000009' } });
  assert.equal(walkin.status, 201); assert.equal(walkin.json.booking.status, 'confirmed');
  const tmp = await call('POST', '/api/biz/appointments', { cookie: owner, body: { service_id: svcId, date: openDate(8), time: '11:00', name: 'Delete Me', phone: '9800000077' } });
  const delId = (await call('GET', '/api/biz/customers?q=Delete', { cookie: owner })).json.items[0].id;
  assert.equal((await call('DELETE', '/api/biz/customers/' + delId, { cookie: owner, body: {} })).status, 200);
  assert.equal((await call('GET', '/api/biz/customers?q=Delete', { cookie: owner })).json.items.length, 0);
  await call('PATCH', `/api/biz/appointments/${tmp.json.booking.id}`, { cookie: owner, body: { status: 'cancelled' } });
  const stats = await call('GET', '/api/biz/stats', { cookie: owner });
  assert.equal(stats.json.days.length, 14); assert.ok(stats.json.days.reduce((a: number, d: any) => a + d.n, 0) >= 2, 'upcoming days are counted'); assert.ok(stats.json.upcoming >= 2); assert.equal(stats.json.customers, 3);
});

test('customer sees own bookings only, cancels, owner is notified; status change notifies customer', async () => {
  const mine = await call('GET', '/api/me/appointments', { cookie: customer });
  assert.equal(mine.json.items.length, 1);
  const theirs = await call('GET', '/api/me/appointments', { cookie: customer2 });
  assert.equal(theirs.json.items.length, 0);
  const id = mine.json.items[0].id;
  assert.equal((await call('POST', `/api/me/appointments/${id}/cancel`, { cookie: customer2, body: {} })).status, 404);
  // owner confirms -> customer notified
  assert.equal((await call('PATCH', `/api/biz/appointments/${id}`, { cookie: owner, body: { status: 'confirmed' } })).status, 200);
  const n = await call('GET', '/api/notifications', { cookie: customer });
  assert.match(n.json.items[0].body, /confirmed/);
  assert.equal((await call('POST', `/api/me/appointments/${id}/cancel`, { cookie: customer, body: {} })).status, 200);
  assert.equal((await call('POST', `/api/me/appointments/${id}/cancel`, { cookie: customer, body: {} })).status, 409);
  const on = await call('GET', '/api/notifications', { cookie: owner });
  assert.match(on.json.items[0].body, /cancelled by the customer/);
  assert.equal((await call('POST', '/api/notifications/read-all', { cookie: owner, body: {} })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: owner })).json.unread, 0);
});

test('guest cancel needs the matching code and phone', async () => {
  const date = openDate(6);
  const g = await call('POST', `/api/public/b/${bizSlug}/book`, { body: { service_id: svcId, date, time: '10:00', name: 'Guest Two', phone: '9800000005' } });
  const ref = g.json.booking.ref;
  assert.equal((await call('POST', '/api/public/cancel', { body: { ref, phone: '9800000006' } })).status, 404);
  assert.equal((await call('POST', '/api/public/cancel', { body: { ref, phone: '9800000005' } })).status, 200);
});

test('setup: wrong key refused; right key creates the first admin once', async () => {
  assert.equal((await call('POST', '/api/setup', { body: { key: 'nope', admin: { email: 'a@a.co', password: 'pass1234', name: 'A' } } })).status, 403);
  const r = await call('POST', '/api/setup', { body: { key: SETUP_KEY, admin: { email: 'admin@example.com', password: 'admin1234', name: 'Platform Admin' },
    demo: { owner_email: 'demo-owner@example.com', owner_password: 'demo1234', customer_email: 'demo-customer@example.com', customer_password: 'demo1234' } } });
  assert.equal(r.status, 201); assert.ok(r.json.demo_business);
  assert.equal((await call('POST', '/api/setup', { body: { key: SETUP_KEY, admin: { email: 'b@b.co', password: 'pass1234', name: 'B' } } })).status, 409);
  admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@example.com', password: 'admin1234' } })).cookie!;
  const demo = await call('GET', '/api/public/b/' + r.json.demo_business);
  assert.equal(demo.json.business.is_demo, 1); assert.match(demo.json.business.name, /^Demo business/);
});

test('admin: overview, suspend business hides its page, plan change notifies owner, disable user kills sessions, audit', async () => {
  const ov = await call('GET', '/api/admin/overview', { cookie: admin });
  assert.equal(ov.status, 200); assert.equal(ov.json.businesses, 3); assert.equal(ov.json.bookings_created.length, 14);
  const list = await call('GET', '/api/admin/businesses?q=Gita', { cookie: admin });
  assert.equal(list.json.items.length, 1);
  const b2 = list.json.items[0];
  assert.equal((await call('PATCH', '/api/admin/businesses/' + b2.id, { cookie: admin, body: { status: 'suspended' } })).status, 200);
  assert.equal((await call('GET', '/api/public/b/' + biz2Slug)).status, 404);
  assert.equal((await call('POST', '/api/biz/plan-request', { cookie: owner, body: {} })).status, 200);
  const an = await call('GET', '/api/notifications', { cookie: admin });
  assert.match(an.json.items[0].body, /upgrade to Pro/);
  const b1 = (await call('GET', '/api/admin/businesses?q=hari%40', { cookie: admin })).json.items[0];
  assert.equal((await call('PATCH', '/api/admin/businesses/' + b1.id, { cookie: admin, body: { plan: 'pro', plan_until: '2027-01-01' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: owner })).json.business.plan, 'pro');
  assert.equal((await call('PATCH', '/api/admin/businesses/' + b1.id, { cookie: admin, body: { plan: 'gold' } })).status, 422);
  const users = await call('GET', '/api/admin/users?role=customer', { cookie: admin });
  const ram = users.json.items.find((u: any) => u.email === 'ram@example.com');
  assert.equal((await call('PATCH', '/api/admin/users/' + ram.id, { cookie: admin, body: { disabled: true } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: customer2 })).json.user, null);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'ram@example.com', password: 'pass1234' } })).status, 403);
  const me = (await call('GET', '/api/auth/me', { cookie: admin })).json.user;
  assert.equal((await call('PATCH', '/api/admin/users/' + me.id, { cookie: admin, body: { disabled: true } })).status, 409);
  const audit = await call('GET', '/api/admin/audit', { cookie: admin });
  assert.ok(audit.json.items.length >= 3);
});

test('account: update profile, change password (old sessions end), delete customer account', async () => {
  assert.equal((await call('PATCH', '/api/account', { cookie: customer, body: { name: 'Sita K', phone: '9841000001' } })).status, 200);
  const wrong = await call('POST', '/api/account/password', { cookie: customer, body: { current: 'nope', next: 'newpass123' } });
  assert.equal(wrong.status, 422);
  const ch = await call('POST', '/api/account/password', { cookie: customer, body: { current: 'pass1234', next: 'newpass123' } });
  assert.equal(ch.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: customer })).json.user, null, 'old session revoked');
  const fresh = ch.cookie!;
  assert.equal((await call('DELETE', '/api/account', { cookie: fresh, body: { password: 'newpass123' } })).status, 200);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'sita@example.com', password: 'newpass123' } })).status, 401);
  assert.equal((await call('DELETE', '/api/account', { cookie: owner, body: { password: 'pass1234' } })).status, 403, 'owners cannot self-delete here');
});

test('SQL injection strings are inert', async () => {
  const r = await call('GET', "/api/public/businesses?q=' OR 1=1 --");
  assert.equal(r.status, 200); assert.equal(r.json.items.length, 0);
  assert.equal((await call('GET', "/api/public/b/x'%20OR%201=1")).status, 404);
});

test('source carries no secrets: only the setup key hash is in the code', () => {
  const src = readFileSync(new URL('../src/worker.ts', import.meta.url), 'utf8');
  assert.match(src, /SETUP_KEY_SHA256 = '[0-9a-f]{64}'/);
  assert.ok(!src.includes(SETUP_KEY));
});

test('SPA fallback: app routes get the shell with security headers, unknown routes 404, conditional requests are not forwarded', async () => {
  const seen: Request[] = [];
  const ASSETS = { fetch: async (r: Request) => { seen.push(r); return new Response('<html>shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }); } };
  const ok = await worker.fetch(new Request(ORIGIN + '/dashboard/today', { headers: { 'If-None-Match': '"abc"' } }), { ...env, ASSETS });
  assert.equal(ok.status, 200); assert.equal(await ok.text(), '<html>shell</html>');
  assert.match(ok.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.equal(seen[0].headers.get('if-none-match'), null);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/b/some-salon'), { ...env, ASSETS })).status, 200);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/wp-admin'), { ...env, ASSETS })).status, 404);
});
