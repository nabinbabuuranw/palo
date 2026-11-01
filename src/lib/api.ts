// Thin fetch wrapper: same-origin JSON, cookie session, typed errors.
export class ApiError extends Error {
  status: number; code: string; fields: Record<string, string>; data: any;
  constructor(status: number, data: any) {
    super(data?.message || data?.error || 'request_failed');
    this.status = status; this.code = data?.error || 'request_failed'; this.fields = data?.fields || {}; this.data = data;
  }
}
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method, credentials: 'same-origin', signal: opts.signal,
      headers: opts.body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : method !== 'GET' ? '{}' : undefined,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, { error: 'network', message: 'Could not reach Palo. Check your connection and try again.' });
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: 'bad_response' }; }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
const MESSAGES: Record<string, string> = {
  bad_credentials: 'That email and password do not match.',
  account_disabled: 'This account has been disabled. Contact support.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  slot_taken: 'Someone just took that time. Please pick another slot.',
  email_taken: 'An account with this email already exists.',
  too_late: 'Bookings can be cancelled online up to 1 hour before. Please call the business.',
  not_cancellable: 'This booking can no longer be cancelled.',
  not_found: 'We could not find that.',
  forbidden: 'You do not have access to this.',
  not_signed_in: 'Please sign in first.',
  server_error: 'Something went wrong on our side. Please try again.',
  bad_transition: 'That status change is not allowed.',
};
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.data?.message || MESSAGES[e.code] || (Object.keys(e.fields).length ? 'Please fix the highlighted fields.' : 'Something went wrong. Please try again.');
  return 'Something went wrong. Please try again.';
}

export type Role = 'customer' | 'owner' | 'admin';
export interface User { id: number; email: string; name: string; phone: string | null; role: Role }
export interface Service { id: number; name: string; duration_min: number; price_npr: number; active?: number }
export interface Hours { weekday: number; open_min: number; close_min: number; closed: number | boolean }
export interface Appointment {
  id: number; ref: string; date: string; start_min: number; end_min: number; status: Status; service_name: string; price_npr: number;
  customer_name: string; customer_phone: string; customer_email: string | null; note: string; source: string; created_at: number;
}
export type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
