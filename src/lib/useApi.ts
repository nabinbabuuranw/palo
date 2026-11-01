import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from './api';
// Load data with loading / error / reload. A new path counts as loading until its own answer arrives.
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const load = useCallback(async (quiet = false) => {
    if (!path) return;
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    if (!quiet) setBusy(true);
    setError(null);
    try { const r = await api<T>(path, { signal: c.signal }); if (!c.signal.aborted) { setData(r); setDoneFor(path); } }
    catch (e: any) { if (e?.name !== 'AbortError') { setError(errorText(e)); setDoneFor(path); } }
    finally { if (!c.signal.aborted) setBusy(false); }
  }, [path]);
  useEffect(() => { load(); return () => ctrl.current?.abort(); }, [load]);
  const loading = !!path && (busy || doneFor !== path);
  return { data: loading && doneFor !== path ? null : data, error: doneFor === path ? error : null, loading, reload: load, setData };
}
