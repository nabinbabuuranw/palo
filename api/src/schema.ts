export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT,
     password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('customer','owner','admin')),
     disabled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS businesses (
     id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
     slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, area TEXT NOT NULL,
     address TEXT NOT NULL DEFAULT '', phone TEXT, about TEXT NOT NULL DEFAULT '', payment_note TEXT NOT NULL DEFAULT '',
     capacity INTEGER NOT NULL DEFAULT 1, slot_step INTEGER NOT NULL DEFAULT 30, lead_min INTEGER NOT NULL DEFAULT 60,
     auto_confirm INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', plan TEXT NOT NULL DEFAULT 'free',
     plan_until TEXT, plan_requested_at INTEGER, is_demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS services (
     id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL, duration_min INTEGER NOT NULL, price_npr INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1,
     sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_services_biz ON services(business_id)`,
  `CREATE TABLE IF NOT EXISTS hours (
     business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, weekday INTEGER NOT NULL,
     open_min INTEGER NOT NULL, close_min INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (business_id, weekday))`,
  `CREATE TABLE IF NOT EXISTS blocks (
     id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     date TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', UNIQUE (business_id, date))`,
  `CREATE TABLE IF NOT EXISTS appointments (
     id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     service_id INTEGER, service_name TEXT NOT NULL, price_npr INTEGER NOT NULL DEFAULT 0,
     customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT,
     date TEXT NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
     ref TEXT NOT NULL UNIQUE, source TEXT NOT NULL DEFAULT 'online', cancelled_by TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_appt_biz_date ON appointments(business_id, date, start_min)`,
  `CREATE INDEX IF NOT EXISTS idx_appt_customer ON appointments(customer_user_id)`,
  `CREATE TABLE IF NOT EXISTS customers (
     id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     phone TEXT NOT NULL, name TEXT NOT NULL, email TEXT, notes TEXT NOT NULL DEFAULT '',
     first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, bookings INTEGER NOT NULL DEFAULT 0, UNIQUE (business_id, phone))`,
  `CREATE TABLE IF NOT EXISTS notifications (
     id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kind TEXT NOT NULL, body TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, read_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL,
     target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`,
];
