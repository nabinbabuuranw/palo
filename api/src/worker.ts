// Palo API + static host. One Cloudflare Worker: /api/* is handled here, everything else is served from ASSETS.
// Storage: Cloudflare D1 (SQLite). No third-party services, no keys.
import { SCHEMA } from './schema.ts';
import { hashPassword, verifyPassword, randomToken, sha256hex } from './crypto.ts';
import { ktmNow, parseDate, parseTime, fmtTime, addDays, weekdayOf, computeSlots, MAX_DAYS_AHEAD } from './time.ts';

export interface Env { DB: D1Database; ASSETS?: { fetch: (r: Request) => Promise<Response> } }
type Role = 'customer' | 'owner' | 'admin';
interface User { id: number; email: string; name: string; phone: string | null; role: Role; disabled: number; created_at: number }
interface Ctx { req: Request; env: Env; url: URL; user: User | null; ip: string; body: any }

// Setup key: only its SHA-256 lives in the code. Used once to create the first admin (and optional demo data).
export const SETUP_KEY_SHA256 = 'c8882d4b6ac48fbfbefbf687f8d0822200f126f49d7c80da6db823fb4c6576f3';
export const SESSION_COOKIE = 'palo_sid';
const SESSION_DAYS = 14;
export const CATEGORIES = ['clinic', 'dental', 'salon', 'barber', 'spa', 'physio', 'tutor', 'other'] as const;
export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

class HttpError extends Error {
  status: number; code: string; detail?: any;
  constructor(status: number, code: string, detail?: any) { super(code); this.status = status; this.code = code; this.detail = detail; }
}
const err = (status: number, code: string, detail?: any) => new HttpError(status, code, detail);

// ------------------------------------------------------------------ validation helpers
export function clean(v: unknown, max: number, { required = true, min = 1 } = {}): string | null {
  if (v === undefined || v === null || v === '') { if (required) return null; return ''; }
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
  if (s.length < (required ? min : 0) || s.length > max) return null;
  return s;
}
export function validEmail(v: unknown): string | null {
  const s = clean(v, 160); if (!s) return null;
  const e = s.toLowerCase();
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e) ? e : null;
}
// Nepal mobile (98x/97x/96x, 10 digits) or landline (01-xxxxxxx). Stored digits only, optional +977.
export function validPhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let d = v.replace(/[\s\-()]/g, '');
  if (d.startsWith('+977')) d = d.slice(4); else if (d.startsWith('977') && d.length === 13) d = d.slice(3);
  if (/^9[678]\d{8}$/.test(d)) return d;
  if (/^0\d{1,2}\d{6,7}$/.test(d) && d.length >= 8 && d.length <= 10) return d;
  return null;
}
function validPassword(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 8 || v.length > 200) return null;
  if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) return null;
  return v;
}
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'business';
}
const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// ------------------------------------------------------------------ http helpers
const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
};
function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...extra } });
}
function cookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(req: Request, name: string): string | null {
  const c = req.headers.get('Cookie') || '';
  for (const part of c.split(/;\s*/)) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1); }
  return null;
}

// ------------------------------------------------------------------ schema + rate limit
const ready = new WeakSet<object>();
async function ensureSchema(db: D1Database) {
  if (ready.has(db)) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready.add(db);
}
export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ws = now - (now % windowSec);
  const row = await db.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END, window_start = ?2
     RETURNING count`).bind(bucket, ws).first<{ count: number }>();
  if (row && row.count > limit) throw err(429, 'rate_limited', { retry_after: windowSec - (now % windowSec) });
}

// ------------------------------------------------------------------ auth
async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256hex(token), userId, now, now + SESSION_DAYS * 86400).run();
  return token;
}
async function loadUser(ctx: Ctx): Promise<User | null> {
  const tok = readCookie(ctx.req, SESSION_COOKIE);
  if (!tok || !/^[A-Za-z0-9_-]{30,64}$/.test(tok)) return null;
  const now = Math.floor(Date.now() / 1000);
  const u = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.disabled, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id_hash = ?1 AND s.expires_at > ?2`).bind(await sha256hex(tok), now).first<User>();
  if (!u || u.disabled) return null;
  return u;
}
function need(ctx: Ctx, ...roles: Role[]): User {
  if (!ctx.user) throw err(401, 'not_signed_in');
  if (roles.length && !roles.includes(ctx.user.role)) throw err(403, 'forbidden');
  return ctx.user;
}
const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role });

async function notify(db: D1Database, userId: number, kind: string, body: string, link = '') {
  await db.prepare('INSERT INTO notifications (user_id, kind, body, link, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(userId, kind, body.slice(0, 300), link.slice(0, 200), Date.now()).run();
}
async function audit(db: D1Database, actor: User, action: string, target: string, detail = '') {
  await db.prepare('INSERT INTO audit_log (actor_id, actor_email, action, target, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(actor.id, actor.email, action, target, detail.slice(0, 500), Date.now()).run();
}

async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  let s = slugify(base); const reserved = ['admin', 'api', 'dashboard', 'login', 'explore', 'me', 'terms', 'privacy'];
  if (reserved.includes(s)) s = s + '-biz';
  for (let i = 0; i < 50; i++) {
    const cand = i === 0 ? s : `${s}-${i + 1}`;
    if (!(await db.prepare('SELECT 1 FROM businesses WHERE slug = ?1').bind(cand).first())) return cand;
  }
  return `${s}-${randomToken(4).toLowerCase()}`;
}

const DEFAULT_HOURS = [ // weekday 0 = Sunday. Saturday closed by default (Nepal weekend).
  [0, 600, 1080, 0], [1, 600, 1080, 0], [2, 600, 1080, 0], [3, 600, 1080, 0], [4, 600, 1080, 0], [5, 600, 1080, 0], [6, 600, 1080, 1]];

async function createBusiness(db: D1Database, ownerId: number, b: { name: string; category: string; area: string; phone: string | null }, isDemo = 0) {
  const slug = await uniqueSlug(db, b.name);
  const now = Date.now();
  const r = await db.prepare(
    `INSERT INTO businesses (owner_id, slug, name, category, area, address, phone, about, payment_note, capacity, slot_step, lead_min, status, plan, is_demo, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, '', ?6, '', 'Pay at the venue. Cash, eSewa and Khalti are accepted at the counter.', 1, 30, 60, 'active', 'free', ?7, ?8) RETURNING id`)
    .bind(ownerId, slug, b.name, b.category, b.area, b.phone, isDemo, now).first<{ id: number }>();
  const id = r!.id;
  await db.batch(DEFAULT_HOURS.map(([wd, o, c, closed]) => db.prepare('INSERT INTO hours (business_id, weekday, open_min, close_min, closed) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, wd, o, c, closed)));
  return { id, slug };
}

// ------------------------------------------------------------------ booking core
async function bizBySlug(db: D1Database, slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  return db.prepare("SELECT * FROM businesses WHERE slug = ?1 AND status = 'active'").bind(slug).first<any>();
}
async function slotsFor(db: D1Database, biz: any, date: string, serviceId: number) {
  const svc = await db.prepare('SELECT * FROM services WHERE id = ?1 AND business_id = ?2 AND active = 1').bind(serviceId, biz.id).first<any>();
  if (!svc) throw err(404, 'service_not_found');
  const wd = weekdayOf(date);
  const hours = await db.prepare('SELECT * FROM hours WHERE business_id = ?1 AND weekday = ?2').bind(biz.id, wd).first<any>();
  const block = await db.prepare('SELECT reason FROM blocks WHERE business_id = ?1 AND date = ?2').bind(biz.id, date).first<any>();
  const appts = (await db.prepare("SELECT start_min, end_min FROM appointments WHERE business_id = ?1 AND date = ?2 AND status IN ('pending','confirmed','completed')")
    .bind(biz.id, date).all<any>()).results;
  const now = ktmNow();
  const slots = computeSlots({
    date, open: hours && !hours.closed ? hours.open_min : null, close: hours ? hours.close_min : null, closed: !!block,
    duration: svc.duration_min, step: biz.slot_step, capacity: biz.capacity, booked: appts, nowDate: now.date, nowMin: now.min, leadMin: biz.lead_min,
  });
  return { svc, slots, closedReason: block ? (block.reason || 'Closed this day') : (!hours || hours.closed ? 'Closed this day' : null) };
}
export function refCode(): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479'; // no look-alikes
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'P-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
async function upsertCustomer(db: D1Database, bizId: number, name: string, phone: string, email: string | null, now: number) {
  await db.prepare(
    `INSERT INTO customers (business_id, phone, name, email, notes, first_seen, last_seen, bookings)
     VALUES (?1, ?2, ?3, ?4, '', ?5, ?5, 1)
     ON CONFLICT(business_id, phone) DO UPDATE SET name = excluded.name, email = COALESCE(excluded.email, customers.email), last_seen = excluded.last_seen, bookings = customers.bookings + 1`)
    .bind(bizId, phone, name, email, now).run();
}
async function book(db: D1Database, biz: any, input: any, user: User | null, source: 'online' | 'staff') {
  const serviceId = int(input.service_id, 1, 1e9);
  const date = parseDate(input.date);
  const start = parseTime(input.time);
  const name = clean(input.name, 80, { min: 2 });
  const phone = validPhone(input.phone);
  const email = input.email ? validEmail(input.email) : null;
  const note = clean(input.note, 300, { required: false });
  const fields: Record<string, string> = {};
  if (!serviceId) fields.service_id = 'Choose a service';
  if (!date) fields.date = 'Choose a valid date';
  if (start === null) fields.time = 'Choose a time';
  if (!name) fields.name = 'Enter your name (2 to 80 characters)';
  if (!phone) fields.phone = 'Enter a Nepal phone number, e.g. 98XXXXXXXX';
  if (input.email && !email) fields.email = 'That email does not look right';
  if (note === null) fields.note = 'Keep the note under 300 characters';
  if (Object.keys(fields).length) throw err(422, 'invalid', { fields });
  const now = ktmNow();
  if (date! < now.date || date! > addDays(now.date, MAX_DAYS_AHEAD)) throw err(422, 'invalid', { fields: { date: `Book between today and ${MAX_DAYS_AHEAD} days ahead` } });
  const { svc, slots } = await slotsFor(db, biz, date!, serviceId!);
  const ok = source === 'staff' ? true : slots.some((s) => s.min === start && s.left > 0); // staff may add walk-ins outside the grid
  if (!ok) throw err(409, 'slot_taken');
  const end = start! + svc.duration_min;
  if (end > 24 * 60) throw err(422, 'invalid', { fields: { time: 'That time runs past midnight' } });
  const ref = refCode();
  const ts = Date.now();
  const status = source === 'staff' ? 'confirmed' : (biz.auto_confirm ? 'confirmed' : 'pending');
  // Atomic capacity check: the INSERT only happens if fewer than `capacity` live bookings overlap this window.
  const cap = source === 'staff' ? 1e6 : biz.capacity;
  const res = await db.prepare(
    `INSERT INTO appointments (business_id, service_id, service_name, price_npr, customer_user_id, customer_name, customer_phone, customer_email, date, start_min, end_min, status, note, ref, source, created_at, updated_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16
     WHERE (SELECT COUNT(*) FROM appointments WHERE business_id = ?1 AND date = ?9 AND status IN ('pending','confirmed','completed') AND start_min < ?11 AND end_min > ?10) < ?17
     RETURNING id`)
    .bind(biz.id, svc.id, svc.name, svc.price_npr, user && user.role === 'customer' ? user.id : null, name, phone, email, date, start, end, status, note || '', ref, source, ts, cap)
    .first<{ id: number }>();
  if (!res) throw err(409, 'slot_taken');
  await upsertCustomer(db, biz.id, name!, phone!, email, ts);
  if (source === 'online') await notify(db, biz.owner_id, 'new_booking', `New booking ${ref}: ${name}, ${svc.name}, ${date} at ${fmtTime(start!)}`, '/dashboard/appointments');
  return { id: res.id, ref, status, business: { name: biz.name, slug: biz.slug, address: biz.address, area: biz.area, phone: biz.phone, payment_note: biz.payment_note },
    service: { name: svc.name, duration_min: svc.duration_min, price_npr: svc.price_npr }, date, time: fmtTime(start!), start_min: start, end_min: end, name };
}

// ------------------------------------------------------------------ routes
type Handler = (ctx: Ctx, params: string[]) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) => routes.push([method, new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), h]);

on('GET', '/api/health', async (ctx) => {
  const r = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM businesses').first<{ n: number }>();
  return json({ ok: true, database: r ? 'connected' : 'unknown', time_ktm: ktmNow() });
});

on('POST', '/api/setup', async (ctx) => {
  await rateLimit(ctx.env.DB, 'setup:' + ctx.ip, 5, 3600);
  const key = typeof ctx.body.key === 'string' ? ctx.body.key : '';
  if (!key || (await sha256hex(key)) !== SETUP_KEY_SHA256) throw err(403, 'forbidden');
  const existing = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first<{ n: number }>();
  if (existing && existing.n > 0) throw err(409, 'already_set_up');
  const a = ctx.body.admin || {};
  const email = validEmail(a.email), pw = validPassword(a.password), name = clean(a.name, 80);
  if (!email || !pw || !name) throw err(422, 'invalid');
  const now = Date.now();
  await ctx.env.DB.prepare("INSERT INTO users (email, name, phone, password_hash, role, created_at) VALUES (?1, ?2, NULL, ?3, 'admin', ?4)").bind(email, name, await hashPassword(pw), now).run();
  const out: any = { admin: email };
  const d = ctx.body.demo;
  if (d && validEmail(d.owner_email) && validPassword(d.owner_password)) {
    const o = await ctx.env.DB.prepare("INSERT INTO users (email, name, phone, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, 'owner', ?5) RETURNING id")
      .bind(validEmail(d.owner_email), 'Demo owner', null, await hashPassword(d.owner_password), now).first<{ id: number }>();
    const b = await createBusiness(ctx.env.DB, o!.id, { name: 'Demo business: Thamel Hair Studio', category: 'salon', area: 'Thamel, Kathmandu', phone: null }, 1);
    await ctx.env.DB.prepare("UPDATE businesses SET about = ?1, address = ?2, capacity = 2, auto_confirm = 0 WHERE id = ?3")
      .bind('This is a demo business for trying Palo. It is not a real salon: bookings here are test data and nobody will show up for them.', 'Demo address, Thamel', b.id).run();
    const svcs: [string, number, number][] = [['Haircut and styling', 45, 600], ['Beard trim', 20, 250], ['Hair colour (root touch-up)', 90, 2200], ['Head massage', 30, 500]];
    await ctx.env.DB.batch(svcs.map(([n, dur, p], i) => ctx.env.DB.prepare('INSERT INTO services (business_id, name, duration_min, price_npr, active, sort, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)').bind(b.id, n, dur, p, i, now)));
    out.demo_business = b.slug;
    if (validEmail(d.customer_email) && validPassword(d.customer_password)) {
      await ctx.env.DB.prepare("INSERT INTO users (email, name, phone, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, 'customer', ?5)")
        .bind(validEmail(d.customer_email), 'Demo customer', '9800000000', await hashPassword(d.customer_password), now).run();
      out.demo_customer = true;
    }
  }
  return json(out, 201);
});

// --- auth
async function registerUser(ctx: Ctx, role: 'customer' | 'owner') {
  // Generous per-IP limits: Nepali mobile carriers put many people behind one shared IP (CGNAT).
  await rateLimit(ctx.env.DB, 'register:' + ctx.ip, 30, 3600);
  const b = ctx.body;
  const name = clean(b.name, 80, { min: 2 }), email = validEmail(b.email), pw = validPassword(b.password);
  const phone = b.phone ? validPhone(b.phone) : null;
  const fields: Record<string, string> = {};
  if (!name) fields.name = 'Enter your name (2 to 80 characters)';
  if (!email) fields.email = 'Enter a valid email';
  if (!pw) fields.password = 'At least 8 characters with a letter and a number';
  if (b.phone && !phone) fields.phone = 'Enter a Nepal phone number, e.g. 98XXXXXXXX';
  let biz: any = null;
  if (role === 'owner') {
    const bn = clean(b.business_name, 80, { min: 2 }), cat = typeof b.category === 'string' && (CATEGORIES as readonly string[]).includes(b.category) ? b.category : null, area = clean(b.area, 80, { min: 2 });
    if (!bn) fields.business_name = 'Enter the business name';
    if (!cat) fields.category = 'Choose a category';
    if (!area) fields.area = 'Enter the area, e.g. Baneshwor, Kathmandu';
    biz = { name: bn, category: cat, area };
  }
  if (b.accept_terms !== true) fields.accept_terms = 'Please accept the Terms and Privacy Policy';
  if (Object.keys(fields).length) throw err(422, 'invalid', { fields });
  if (await ctx.env.DB.prepare('SELECT 1 FROM users WHERE email = ?1').bind(email).first()) throw err(409, 'email_taken', { fields: { email: 'An account with this email already exists' } });
  const u = await ctx.env.DB.prepare('INSERT INTO users (email, name, phone, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id, email, name, phone, role, disabled, created_at')
    .bind(email, name, phone, await hashPassword(pw!), role, Date.now()).first<User>();
  let business = null;
  if (role === 'owner') business = await createBusiness(ctx.env.DB, u!.id, { ...biz, phone });
  const token = await createSession(ctx.env.DB, u!.id);
  return json({ user: publicUser(u!), business }, 201, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
}
on('POST', '/api/auth/register', (ctx) => registerUser(ctx, 'customer'));
on('POST', '/api/auth/register-business', (ctx) => registerUser(ctx, 'owner'));
on('POST', '/api/auth/login', async (ctx) => {
  const email = validEmail(ctx.body.email);
  await rateLimit(ctx.env.DB, 'login-ip:' + ctx.ip, 60, 900);
  if (email) await rateLimit(ctx.env.DB, 'login-email:' + email, 10, 900);
  const pw = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  const row = email ? await ctx.env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<any>() : null;
  // Always run one hash so response time does not reveal whether the email exists.
  const okPw = row ? await verifyPassword(pw, row.password_hash) : (await verifyPassword(pw, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), false);
  if (!row || !okPw) throw err(401, 'bad_credentials');
  if (row.disabled) throw err(403, 'account_disabled');
  const token = await createSession(ctx.env.DB, row.id);
  return json({ user: publicUser(row) }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
});
on('POST', '/api/auth/logout', async (ctx) => {
  const tok = readCookie(ctx.req, SESSION_COOKIE);
  if (tok) await ctx.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sha256hex(tok)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
});
on('GET', '/api/auth/me', async (ctx) => {
  if (!ctx.user) return json({ user: null });
  const unread = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?1 AND read_at IS NULL').bind(ctx.user.id).first<{ n: number }>();
  let business = null;
  if (ctx.user.role === 'owner') business = await ctx.env.DB.prepare('SELECT id, slug, name, status, plan, is_demo FROM businesses WHERE owner_id = ?1').bind(ctx.user.id).first();
  return json({ user: publicUser(ctx.user), unread: unread?.n || 0, business });
});

// --- account
on('PATCH', '/api/account', async (ctx) => {
  const u = need(ctx);
  const name = clean(ctx.body.name, 80, { min: 2 }); const phone = ctx.body.phone ? validPhone(ctx.body.phone) : null;
  const fields: Record<string, string> = {};
  if (!name) fields.name = 'Enter your name (2 to 80 characters)';
  if (ctx.body.phone && !phone) fields.phone = 'Enter a Nepal phone number';
  if (Object.keys(fields).length) throw err(422, 'invalid', { fields });
  await ctx.env.DB.prepare('UPDATE users SET name = ?1, phone = ?2 WHERE id = ?3').bind(name, phone, u.id).run();
  return json({ user: { ...publicUser(u), name, phone } });
});
on('POST', '/api/account/password', async (ctx) => {
  const u = need(ctx);
  await rateLimit(ctx.env.DB, 'pw:' + u.id, 10, 3600);
  const row = await ctx.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1').bind(u.id).first<any>();
  if (!(await verifyPassword(String(ctx.body.current || ''), row.password_hash))) throw err(422, 'invalid', { fields: { current: 'Current password is wrong' } });
  const next = validPassword(ctx.body.next);
  if (!next) throw err(422, 'invalid', { fields: { next: 'At least 8 characters with a letter and a number' } });
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE users SET password_hash = ?1 WHERE id = ?2').bind(await hashPassword(next), u.id),
    ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(u.id),
  ]);
  const token = await createSession(ctx.env.DB, u.id);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
});
on('DELETE', '/api/account', async (ctx) => {
  const u = need(ctx, 'customer');
  const row = await ctx.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1').bind(u.id).first<any>();
  if (!(await verifyPassword(String(ctx.body.password || ''), row.password_hash))) throw err(422, 'invalid', { fields: { password: 'Password is wrong' } });
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE appointments SET customer_user_id = NULL WHERE customer_user_id = ?1').bind(u.id),
    ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(u.id),
    ctx.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?1').bind(u.id),
    ctx.env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(u.id),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
});

// --- notifications
on('GET', '/api/notifications', async (ctx) => {
  const u = need(ctx);
  const r = await ctx.env.DB.prepare('SELECT id, kind, body, link, created_at, read_at FROM notifications WHERE user_id = ?1 ORDER BY id DESC LIMIT 50').bind(u.id).all();
  return json({ items: r.results });
});
on('POST', '/api/notifications/read-all', async (ctx) => {
  const u = need(ctx);
  await ctx.env.DB.prepare('UPDATE notifications SET read_at = ?1 WHERE user_id = ?2 AND read_at IS NULL').bind(Date.now(), u.id).run();
  return json({ ok: true });
});

// --- public
on('GET', '/api/public/businesses', async (ctx) => {
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60);
  const cat = ctx.url.searchParams.get('category') || '';
  let sql = "SELECT b.slug, b.name, b.category, b.area, b.is_demo, (SELECT COUNT(*) FROM services s WHERE s.business_id = b.id AND s.active = 1) AS services FROM businesses b WHERE b.status = 'active'";
  const args: any[] = [];
  if (q) { args.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%'); sql += ` AND (b.name LIKE ?${args.length} ESCAPE '\\' OR b.area LIKE ?${args.length} ESCAPE '\\')`; }
  if ((CATEGORIES as readonly string[]).includes(cat)) { args.push(cat); sql += ` AND b.category = ?${args.length}`; }
  sql += ' ORDER BY b.is_demo DESC, b.created_at DESC LIMIT 60';
  const r = await ctx.env.DB.prepare(sql).bind(...args).all();
  return json({ items: r.results });
});
on('GET', '/api/public/b/:slug', async (ctx, [slug]) => {
  const biz = await bizBySlug(ctx.env.DB, slug);
  if (!biz) throw err(404, 'not_found');
  const services = (await ctx.env.DB.prepare('SELECT id, name, duration_min, price_npr FROM services WHERE business_id = ?1 AND active = 1 ORDER BY sort, id').bind(biz.id).all()).results;
  const hours = (await ctx.env.DB.prepare('SELECT weekday, open_min, close_min, closed FROM hours WHERE business_id = ?1 ORDER BY weekday').bind(biz.id).all()).results;
  const today = ktmNow().date;
  const blocks = (await ctx.env.DB.prepare('SELECT date, reason FROM blocks WHERE business_id = ?1 AND date >= ?2 ORDER BY date LIMIT 60').bind(biz.id, today).all()).results;
  return json({ business: { slug: biz.slug, name: biz.name, category: biz.category, area: biz.area, address: biz.address, phone: biz.phone, about: biz.about, payment_note: biz.payment_note, is_demo: biz.is_demo, capacity: biz.capacity },
    services, hours, blocks, today, max_days: MAX_DAYS_AHEAD });
});
on('GET', '/api/public/b/:slug/slots', async (ctx, [slug]) => {
  const biz = await bizBySlug(ctx.env.DB, slug);
  if (!biz) throw err(404, 'not_found');
  const date = parseDate(ctx.url.searchParams.get('date')); const sid = int(ctx.url.searchParams.get('service'), 1, 1e9);
  if (!date || !sid) throw err(422, 'invalid');
  const { slots, closedReason } = await slotsFor(ctx.env.DB, biz, date, sid);
  return json({ date, slots, closed: closedReason });
});
on('POST', '/api/public/b/:slug/book', async (ctx, [slug]) => {
  await rateLimit(ctx.env.DB, 'book:' + ctx.ip, 40, 3600);
  const biz = await bizBySlug(ctx.env.DB, slug);
  if (!biz) throw err(404, 'not_found');
  const out = await book(ctx.env.DB, biz, ctx.body, ctx.user, 'online');
  return json({ booking: out }, 201);
});
on('POST', '/api/public/cancel', async (ctx) => {
  await rateLimit(ctx.env.DB, 'gcancel:' + ctx.ip, 10, 3600);
  const ref = typeof ctx.body.ref === 'string' ? ctx.body.ref.trim().toUpperCase() : '';
  const phone = validPhone(ctx.body.phone);
  if (!/^P-[A-Z0-9]{6}$/.test(ref) || !phone) throw err(422, 'invalid', { fields: { ref: 'Enter the booking code and the phone used' } });
  const a = await ctx.env.DB.prepare('SELECT a.*, b.owner_id FROM appointments a JOIN businesses b ON b.id = a.business_id WHERE a.ref = ?1 AND a.customer_phone = ?2').bind(ref, phone).first<any>();
  if (!a) throw err(404, 'not_found');
  await cancelAppt(ctx.env.DB, a, 'customer');
  return json({ ok: true });
});
async function cancelAppt(db: D1Database, a: any, by: 'customer') {
  if (!['pending', 'confirmed'].includes(a.status)) throw err(409, 'not_cancellable');
  const now = ktmNow();
  if (a.date < now.date || (a.date === now.date && a.start_min - now.min < 60)) throw err(409, 'too_late', { message: 'Bookings can be cancelled online up to 1 hour before. Please call the business.' });
  await db.prepare("UPDATE appointments SET status = 'cancelled', cancelled_by = ?1, updated_at = ?2 WHERE id = ?3").bind(by, Date.now(), a.id).run();
  await notify(db, a.owner_id, 'cancelled', `Booking ${a.ref} (${a.customer_name}, ${a.date} ${fmtTime(a.start_min)}) was cancelled by the customer`, '/dashboard/appointments');
}

// --- customer
on('GET', '/api/me/appointments', async (ctx) => {
  const u = need(ctx, 'customer');
  const r = await ctx.env.DB.prepare(
    `SELECT a.id, a.ref, a.date, a.start_min, a.end_min, a.status, a.service_name, a.price_npr, a.note, b.name AS business_name, b.slug AS business_slug, b.area, b.phone AS business_phone
     FROM appointments a JOIN businesses b ON b.id = a.business_id WHERE a.customer_user_id = ?1 ORDER BY a.date DESC, a.start_min DESC LIMIT 200`).bind(u.id).all();
  return json({ items: r.results, today: ktmNow() });
});
on('POST', '/api/me/appointments/:id/cancel', async (ctx, [id]) => {
  const u = need(ctx, 'customer');
  const a = await ctx.env.DB.prepare('SELECT a.*, b.owner_id FROM appointments a JOIN businesses b ON b.id = a.business_id WHERE a.id = ?1 AND a.customer_user_id = ?2').bind(int(id, 1, 1e12), u.id).first<any>();
  if (!a) throw err(404, 'not_found');
  await cancelAppt(ctx.env.DB, a, 'customer');
  return json({ ok: true });
});

// --- business owner
async function myBiz(ctx: Ctx) {
  const u = need(ctx, 'owner');
  const b = await ctx.env.DB.prepare('SELECT * FROM businesses WHERE owner_id = ?1').bind(u.id).first<any>();
  if (!b) throw err(404, 'no_business');
  return { u, b };
}
on('GET', '/api/biz', async (ctx) => {
  const { b } = await myBiz(ctx);
  const db = ctx.env.DB;
  const services = (await db.prepare('SELECT * FROM services WHERE business_id = ?1 ORDER BY active DESC, sort, id').bind(b.id).all()).results;
  const hours = (await db.prepare('SELECT weekday, open_min, close_min, closed FROM hours WHERE business_id = ?1 ORDER BY weekday').bind(b.id).all()).results;
  const blocks = (await db.prepare('SELECT id, date, reason FROM blocks WHERE business_id = ?1 AND date >= ?2 ORDER BY date').bind(b.id, ktmNow().date).all()).results;
  return json({ business: b, services, hours, blocks, today: ktmNow() });
});
on('PATCH', '/api/biz', async (ctx) => {
  const { u, b } = await myBiz(ctx);
  const x = ctx.body; const f: Record<string, string> = {};
  const name = clean(x.name, 80, { min: 2 }); if (!name) f.name = 'Enter the business name';
  const category = (CATEGORIES as readonly string[]).includes(x.category) ? x.category : null; if (!category) f.category = 'Choose a category';
  const area = clean(x.area, 80, { min: 2 }); if (!area) f.area = 'Enter the area';
  const address = clean(x.address, 160, { required: false }); if (address === null) f.address = 'Too long';
  const phone = x.phone ? validPhone(x.phone) : null; if (x.phone && !phone) f.phone = 'Enter a Nepal phone number';
  const about = clean(x.about, 600, { required: false }); if (about === null) f.about = 'Keep it under 600 characters';
  const pay = clean(x.payment_note, 200, { required: false }); if (pay === null) f.payment_note = 'Keep it under 200 characters';
  const capacity = int(x.capacity, 1, 20); if (!capacity) f.capacity = '1 to 20';
  const step = [10, 15, 20, 30, 60].includes(x.slot_step) ? x.slot_step : null; if (!step) f.slot_step = 'Choose a slot interval';
  const lead = int(x.lead_min, 0, 2880); if (lead === null) f.lead_min = '0 to 2880 minutes';
  const auto = x.auto_confirm ? 1 : 0;
  if (Object.keys(f).length) throw err(422, 'invalid', { fields: f });
  await ctx.env.DB.prepare('UPDATE businesses SET name=?1, category=?2, area=?3, address=?4, phone=?5, about=?6, payment_note=?7, capacity=?8, slot_step=?9, lead_min=?10, auto_confirm=?11 WHERE id=?12')
    .bind(name, category, area, address, phone, about, pay, capacity, step, lead, auto, b.id).run();
  await audit(ctx.env.DB, u, 'business.update', 'business:' + b.id);
  return json({ ok: true });
});
function svcInput(x: any) {
  const f: Record<string, string> = {};
  const name = clean(x.name, 80, { min: 2 }); if (!name) f.name = 'Enter a service name';
  const duration = int(x.duration_min, 5, 480); if (!duration) f.duration_min = '5 to 480 minutes';
  const price = int(x.price_npr, 0, 1000000); if (price === null) f.price_npr = 'Price in NPR (0 for free)';
  if (Object.keys(f).length) throw err(422, 'invalid', { fields: f });
  return { name: name!, duration: duration!, price: price! };
}
on('POST', '/api/biz/services', async (ctx) => {
  const { b } = await myBiz(ctx);
  const s = svcInput(ctx.body);
  const n = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM services WHERE business_id = ?1').bind(b.id).first<{ n: number }>();
  if ((n?.n || 0) >= 50) throw err(409, 'limit', { message: 'Up to 50 services per business' });
  const r = await ctx.env.DB.prepare('INSERT INTO services (business_id, name, duration_min, price_npr, active, sort, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6) RETURNING *')
    .bind(b.id, s.name, s.duration, s.price, n?.n || 0, Date.now()).first();
  return json({ service: r }, 201);
});
on('PATCH', '/api/biz/services/:id', async (ctx, [id]) => {
  const { b } = await myBiz(ctx);
  const s = svcInput(ctx.body);
  const active = ctx.body.active === false ? 0 : 1;
  const r = await ctx.env.DB.prepare('UPDATE services SET name=?1, duration_min=?2, price_npr=?3, active=?4 WHERE id=?5 AND business_id=?6 RETURNING *')
    .bind(s.name, s.duration, s.price, active, int(id, 1, 1e12), b.id).first();
  if (!r) throw err(404, 'not_found');
  return json({ service: r });
});
on('PUT', '/api/biz/hours', async (ctx) => {
  const { b } = await myBiz(ctx);
  const rows = Array.isArray(ctx.body.hours) ? ctx.body.hours : null;
  if (!rows || rows.length !== 7) throw err(422, 'invalid');
  const clean7 = rows.map((h: any) => {
    const wd = int(h.weekday, 0, 6), o = int(h.open_min, 0, 1440), c = int(h.close_min, 0, 1440);
    if (wd === null || o === null || c === null || (!h.closed && c <= o)) throw err(422, 'invalid', { fields: { hours: 'Closing time must be after opening time' } });
    return [wd, o, c, h.closed ? 1 : 0];
  });
  if (new Set(clean7.map((r: any) => r[0])).size !== 7) throw err(422, 'invalid');
  await ctx.env.DB.batch(clean7.map(([wd, o, c, cl]: any) => ctx.env.DB.prepare('UPDATE hours SET open_min=?1, close_min=?2, closed=?3 WHERE business_id=?4 AND weekday=?5').bind(o, c, cl, b.id, wd)));
  return json({ ok: true });
});
on('POST', '/api/biz/blocks', async (ctx) => {
  const { b } = await myBiz(ctx);
  const date = parseDate(ctx.body.date); const reason = clean(ctx.body.reason, 80, { required: false });
  if (!date || date < ktmNow().date || reason === null) throw err(422, 'invalid', { fields: { date: 'Choose today or a future date' } });
  const r = await ctx.env.DB.prepare('INSERT INTO blocks (business_id, date, reason) VALUES (?1, ?2, ?3) ON CONFLICT(business_id, date) DO UPDATE SET reason = excluded.reason RETURNING id, date, reason')
    .bind(b.id, date, reason || 'Closed').first();
  return json({ block: r }, 201);
});
on('DELETE', '/api/biz/blocks/:id', async (ctx, [id]) => {
  const { b } = await myBiz(ctx);
  await ctx.env.DB.prepare('DELETE FROM blocks WHERE id = ?1 AND business_id = ?2').bind(int(id, 1, 1e12), b.id).run();
  return json({ ok: true });
});
on('GET', '/api/biz/appointments', async (ctx) => {
  const { b } = await myBiz(ctx);
  const sp = ctx.url.searchParams;
  const from = parseDate(sp.get('from')), to = parseDate(sp.get('to'));
  const status = sp.get('status') || ''; const q = (sp.get('q') || '').trim().slice(0, 60);
  let sql = 'SELECT * FROM appointments WHERE business_id = ?1'; const args: any[] = [b.id];
  if (from) { args.push(from); sql += ` AND date >= ?${args.length}`; }
  if (to) { args.push(to); sql += ` AND date <= ?${args.length}`; }
  if ((STATUSES as readonly string[]).includes(status)) { args.push(status); sql += ` AND status = ?${args.length}`; }
  if (q) { args.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%'); sql += ` AND (customer_name LIKE ?${args.length} ESCAPE '\\' OR customer_phone LIKE ?${args.length} ESCAPE '\\' OR ref LIKE ?${args.length} ESCAPE '\\' OR service_name LIKE ?${args.length} ESCAPE '\\')`; }
  sql += ' ORDER BY date, start_min LIMIT 500';
  const r = await ctx.env.DB.prepare(sql).bind(...args).all();
  return json({ items: r.results, today: ktmNow() });
});
on('POST', '/api/biz/appointments', async (ctx) => {
  const { b } = await myBiz(ctx);
  const out = await book(ctx.env.DB, b, ctx.body, null, 'staff');
  return json({ booking: out }, 201);
});
const TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'no_show', 'cancelled'], completed: [], cancelled: [], no_show: ['completed'],
};
on('PATCH', '/api/biz/appointments/:id', async (ctx, [id]) => {
  const { b } = await myBiz(ctx);
  const a = await ctx.env.DB.prepare('SELECT * FROM appointments WHERE id = ?1 AND business_id = ?2').bind(int(id, 1, 1e12), b.id).first<any>();
  if (!a) throw err(404, 'not_found');
  const to = String(ctx.body.status || '');
  if (!TRANSITIONS[a.status]?.includes(to)) throw err(409, 'bad_transition', { from: a.status, to });
  await ctx.env.DB.prepare('UPDATE appointments SET status = ?1, cancelled_by = CASE WHEN ?1 = \'cancelled\' THEN \'business\' ELSE cancelled_by END, updated_at = ?2 WHERE id = ?3').bind(to, Date.now(), a.id).run();
  if (a.customer_user_id && ['confirmed', 'cancelled'].includes(to)) {
    const verb = to === 'confirmed' ? 'confirmed' : 'cancelled by the business';
    await notify(ctx.env.DB, a.customer_user_id, 'status', `${b.name}: your booking ${a.ref} on ${a.date} at ${fmtTime(a.start_min)} was ${verb}`, '/me');
  }
  return json({ ok: true, status: to });
});
on('GET', '/api/biz/customers', async (ctx) => {
  const { b } = await myBiz(ctx);
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60);
  let sql = `SELECT c.*, (SELECT COUNT(*) FROM appointments a WHERE a.business_id = c.business_id AND a.customer_phone = c.phone AND a.status = 'completed') AS visits,
    (SELECT COUNT(*) FROM appointments a WHERE a.business_id = c.business_id AND a.customer_phone = c.phone AND a.status = 'no_show') AS no_shows,
    (SELECT COALESCE(SUM(price_npr),0) FROM appointments a WHERE a.business_id = c.business_id AND a.customer_phone = c.phone AND a.status = 'completed') AS spent_npr
    FROM customers c WHERE c.business_id = ?1`;
  const args: any[] = [b.id];
  if (q) { args.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%'); sql += ` AND (c.name LIKE ?2 ESCAPE '\\' OR c.phone LIKE ?2 ESCAPE '\\' OR c.email LIKE ?2 ESCAPE '\\')`; }
  sql += ' ORDER BY c.last_seen DESC LIMIT 300';
  return json({ items: (await ctx.env.DB.prepare(sql).bind(...args).all()).results });
});
on('GET', '/api/biz/customers/:id', async (ctx, [id]) => {
  const { b } = await myBiz(ctx);
  const c = await ctx.env.DB.prepare('SELECT * FROM customers WHERE id = ?1 AND business_id = ?2').bind(int(id, 1, 1e12), b.id).first<any>();
  if (!c) throw err(404, 'not_found');
  const history = (await ctx.env.DB.prepare('SELECT id, ref, date, start_min, status, service_name, price_npr FROM appointments WHERE business_id = ?1 AND customer_phone = ?2 ORDER BY date DESC, start_min DESC LIMIT 100').bind(b.id, c.phone).all()).results;
  return json({ customer: c, history });
});
on('PATCH', '/api/biz/customers/:id', async (ctx, [id]) => {
  const { b } = await myBiz(ctx);
  const notes = clean(ctx.body.notes, 1000, { required: false });
  if (notes === null) throw err(422, 'invalid', { fields: { notes: 'Keep notes under 1000 characters' } });
  const r = await ctx.env.DB.prepare('UPDATE customers SET notes = ?1 WHERE id = ?2 AND business_id = ?3 RETURNING id').bind(notes, int(id, 1, 1e12), b.id).first();
  if (!r) throw err(404, 'not_found');
  return json({ ok: true });
});
on('DELETE', '/api/biz/customers/:id', async (ctx, [id]) => {
  const { u, b } = await myBiz(ctx);
  // Removes the person from the customer book (e.g. on their request). Appointment records stay for the business's own history.
  const r = await ctx.env.DB.prepare('DELETE FROM customers WHERE id = ?1 AND business_id = ?2 RETURNING id').bind(int(id, 1, 1e12), b.id).first();
  if (!r) throw err(404, 'not_found');
  await audit(ctx.env.DB, u, 'customer.delete', 'customer:' + id);
  return json({ ok: true });
});
on('GET', '/api/biz/stats', async (ctx) => {
  const { b } = await myBiz(ctx);
  const db = ctx.env.DB; const today = ktmNow().date; const from = addDays(today, -6);
  // Past week and coming week by appointment day (cancelled excluded): what the front desk plans with.
  const perDay = (await db.prepare("SELECT date, COUNT(*) AS n FROM appointments WHERE business_id = ?1 AND date BETWEEN ?2 AND ?3 AND status != 'cancelled' GROUP BY date").bind(b.id, from, addDays(today, 7)).all<any>()).results;
  const days = Array.from({ length: 14 }, (_, i) => { const d = addDays(from, i); return { date: d, n: perDay.find((r: any) => r.date === d)?.n || 0 }; });
  const byService = (await db.prepare("SELECT service_name AS name, COUNT(*) AS n FROM appointments WHERE business_id = ?1 AND date >= ?2 AND status != 'cancelled' GROUP BY service_name ORDER BY n DESC LIMIT 6").bind(b.id, addDays(today, -29)).all()).results;
  const byStatus = (await db.prepare('SELECT status, COUNT(*) AS n FROM appointments WHERE business_id = ?1 AND date >= ?2 GROUP BY status').bind(b.id, addDays(today, -29)).all()).results;
  const upcoming = await db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE business_id = ?1 AND date >= ?2 AND status IN ('pending','confirmed')").bind(b.id, today).first<{ n: number }>();
  const pending = await db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE business_id = ?1 AND date >= ?2 AND status = 'pending'").bind(b.id, today).first<{ n: number }>();
  const revenue = await db.prepare("SELECT COALESCE(SUM(price_npr),0) AS s FROM appointments WHERE business_id = ?1 AND date >= ?2 AND status = 'completed'").bind(b.id, addDays(today, -29)).first<{ s: number }>();
  const customers = await db.prepare('SELECT COUNT(*) AS n FROM customers WHERE business_id = ?1').bind(b.id).first<{ n: number }>();
  return json({ days, byService, byStatus, upcoming: upcoming?.n || 0, pending: pending?.n || 0, completed_value_30d: revenue?.s || 0, customers: customers?.n || 0 });
});
on('POST', '/api/biz/plan-request', async (ctx) => {
  const { u, b } = await myBiz(ctx);
  await rateLimit(ctx.env.DB, 'planreq:' + b.id, 3, 86400);
  const admins = (await ctx.env.DB.prepare("SELECT id FROM users WHERE role = 'admin' AND disabled = 0").all<any>()).results;
  for (const a of admins) await notify(ctx.env.DB, a.id, 'plan_request', `${b.name} (${u.email}) asked to upgrade to Pro`, '/admin/businesses');
  await ctx.env.DB.prepare('UPDATE businesses SET plan_requested_at = ?1 WHERE id = ?2').bind(Date.now(), b.id).run();
  return json({ ok: true });
});

// --- platform admin
on('GET', '/api/admin/overview', async (ctx) => {
  need(ctx, 'admin'); const db = ctx.env.DB; const today = ktmNow().date;
  const q = async (sql: string, ...a: any[]) => ((await db.prepare(sql).bind(...a).first<{ n: number }>())?.n || 0);
  const perDay = (await db.prepare("SELECT date(created_at/1000, 'unixepoch', '+345 minutes') AS d, COUNT(*) AS n FROM appointments WHERE created_at >= ?1 GROUP BY d").bind(Date.now() - 14 * 86400000).all<any>()).results;
  const days = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return { date: d, n: perDay.find((r: any) => r.d === d)?.n || 0 }; });
  return json({
    businesses: await q('SELECT COUNT(*) AS n FROM businesses'), active_businesses: await q("SELECT COUNT(*) AS n FROM businesses WHERE status = 'active'"),
    demo_businesses: await q('SELECT COUNT(*) AS n FROM businesses WHERE is_demo = 1'), pro_businesses: await q("SELECT COUNT(*) AS n FROM businesses WHERE plan = 'pro'"),
    users: await q('SELECT COUNT(*) AS n FROM users'), customers: await q("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"), owners: await q("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'"),
    appointments: await q('SELECT COUNT(*) AS n FROM appointments'), plan_requests: await q('SELECT COUNT(*) AS n FROM businesses WHERE plan_requested_at IS NOT NULL AND plan = \'free\''),
    bookings_created: days,
  });
});
on('GET', '/api/admin/businesses', async (ctx) => {
  need(ctx, 'admin');
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60); const st = ctx.url.searchParams.get('status') || '';
  let sql = `SELECT b.id, b.slug, b.name, b.category, b.area, b.status, b.plan, b.plan_until, b.plan_requested_at, b.is_demo, b.created_at, u.email AS owner_email,
    (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id) AS appointments FROM businesses b JOIN users u ON u.id = b.owner_id WHERE 1=1`;
  const args: any[] = [];
  if (q) { args.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%'); sql += ` AND (b.name LIKE ?1 ESCAPE '\\' OR u.email LIKE ?1 ESCAPE '\\' OR b.area LIKE ?1 ESCAPE '\\')`; }
  if (['active', 'suspended'].includes(st)) { args.push(st); sql += ` AND b.status = ?${args.length}`; }
  sql += ' ORDER BY b.created_at DESC LIMIT 300';
  return json({ items: (await ctx.env.DB.prepare(sql).bind(...args).all()).results });
});
on('PATCH', '/api/admin/businesses/:id', async (ctx, [id]) => {
  const admin = need(ctx, 'admin');
  const b = await ctx.env.DB.prepare('SELECT * FROM businesses WHERE id = ?1').bind(int(id, 1, 1e12)).first<any>();
  if (!b) throw err(404, 'not_found');
  const status = ctx.body.status ?? b.status, plan = ctx.body.plan ?? b.plan;
  const until = ctx.body.plan_until === undefined ? b.plan_until : (ctx.body.plan_until === null ? null : parseDate(ctx.body.plan_until));
  if (!['active', 'suspended'].includes(status) || !['free', 'pro'].includes(plan) || (ctx.body.plan_until && !until)) throw err(422, 'invalid');
  await ctx.env.DB.prepare('UPDATE businesses SET status = ?1, plan = ?2, plan_until = ?3, plan_requested_at = CASE WHEN ?2 = \'pro\' THEN NULL ELSE plan_requested_at END WHERE id = ?4').bind(status, plan, until, b.id).run();
  await audit(ctx.env.DB, admin, 'business.update', 'business:' + b.id, JSON.stringify({ status, plan, plan_until: until }));
  if (status !== b.status) await notify(ctx.env.DB, b.owner_id, 'admin', status === 'suspended' ? 'Your booking page was paused by the Palo team. Reply to support to restore it.' : 'Your booking page is active again.', '/dashboard');
  if (plan !== b.plan) await notify(ctx.env.DB, b.owner_id, 'admin', `Your plan is now ${plan === 'pro' ? 'Pro' : 'Free'}.`, '/dashboard/settings');
  return json({ ok: true });
});
on('GET', '/api/admin/users', async (ctx) => {
  need(ctx, 'admin');
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60); const role = ctx.url.searchParams.get('role') || '';
  let sql = 'SELECT id, email, name, phone, role, disabled, created_at FROM users WHERE 1=1'; const args: any[] = [];
  if (q) { args.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%'); sql += ` AND (email LIKE ?1 ESCAPE '\\' OR name LIKE ?1 ESCAPE '\\')`; }
  if (['customer', 'owner', 'admin'].includes(role)) { args.push(role); sql += ` AND role = ?${args.length}`; }
  sql += ' ORDER BY created_at DESC LIMIT 300';
  return json({ items: (await ctx.env.DB.prepare(sql).bind(...args).all()).results });
});
on('PATCH', '/api/admin/users/:id', async (ctx, [id]) => {
  const admin = need(ctx, 'admin');
  const uid = int(id, 1, 1e12);
  if (uid === admin.id) throw err(409, 'cannot_change_self');
  const target = await ctx.env.DB.prepare('SELECT id, role FROM users WHERE id = ?1').bind(uid).first<any>();
  if (!target) throw err(404, 'not_found');
  if (target.role === 'admin') throw err(403, 'forbidden');
  const disabled = ctx.body.disabled ? 1 : 0;
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE users SET disabled = ?1 WHERE id = ?2').bind(disabled, uid),
    ...(disabled ? [ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(uid)] : []),
  ]);
  await audit(ctx.env.DB, admin, disabled ? 'user.disable' : 'user.enable', 'user:' + uid);
  return json({ ok: true });
});
on('GET', '/api/admin/audit', async (ctx) => {
  need(ctx, 'admin');
  return json({ items: (await ctx.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()).results });
});

// ------------------------------------------------------------------ dispatcher
export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  try {
    if (method !== 'GET' && method !== 'HEAD') {
      // CSRF: state-changing requests must be same-origin JSON. Browsers cannot send cross-site JSON without CORS preflight, and we never answer preflights.
      const origin = req.headers.get('Origin');
      if (origin && origin !== url.origin) throw err(403, 'bad_origin');
      const sfs = req.headers.get('Sec-Fetch-Site');
      if (sfs && !['same-origin', 'none'].includes(sfs)) throw err(403, 'bad_origin');
      if (method !== 'DELETE' || req.headers.get('Content-Length') !== '0') {
        const ct = req.headers.get('Content-Type') || '';
        if (!ct.startsWith('application/json')) throw err(415, 'json_required');
      }
    }
    if (method === 'OPTIONS') return new Response(null, { status: 405, headers: SEC_HEADERS });
    await ensureSchema(env.DB);
    let body: any = {};
    if (!['GET', 'HEAD'].includes(method)) {
      const text = await req.text();
      if (text.length > 20000) throw err(413, 'too_large');
      if (text) { try { body = JSON.parse(text); } catch { throw err(400, 'bad_json'); } }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw err(400, 'bad_json');
    }
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const ctx: Ctx = { req, env, url, user: null, ip, body };
    ctx.user = await loadUser(ctx);
    for (const [m, re, h] of routes) {
      if (m !== method && !(method === 'HEAD' && m === 'GET')) continue;
      const match = url.pathname.match(re);
      if (match) return await h(ctx, match.slice(1).map(decodeURIComponent));
    }
    throw err(404, 'not_found');
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.code, ...(e.detail || {}) }, e.status, e.status === 429 && e.detail?.retry_after ? { 'Retry-After': String(e.detail.retry_after) } : {});
    console.error('api_error', e && e.stack || e);
    return json({ error: 'server_error' }, 500);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);
    if (!env.ASSETS) return new Response('Not found', { status: 404 });
    // Static files are served by the platform before this Worker runs; anything that reaches here is an app route -> SPA shell.
    // No conditional headers are forwarded: a 304 from the asset store must never become an empty 200.
    const res = await env.ASSETS.fetch(new Request(new URL('/', url).toString(), { method: 'GET' }));
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SPA_HEADERS)) h.set(k, v);
    const known = /^\/(|explore|login|register|register\/business|me|dashboard(\/[a-z]+)?|admin(\/[a-z]+)?|terms|privacy|b\/[a-z0-9-]+|cancel)$/.test(url.pathname.replace(/\/$/, '') || '/');
    return new Response(res.body, { status: known ? 200 : 404, headers: h });
  },
};
export const SPA_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-cache',
};
