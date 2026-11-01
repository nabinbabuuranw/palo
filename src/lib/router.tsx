// A tiny history router: enough for this app, no dependency.
import { createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent, type AnchorHTMLAttributes } from 'react';
const Ctx = createContext<{ path: string; search: string }>({ path: '/', search: '' });
export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new Event('palo:nav'));
  window.scrollTo({ top: 0 });
}
export function RouterProvider({ children }: { children: ReactNode }) {
  const read = () => ({ path: location.pathname.replace(/\/+$/, '') || '/', search: location.search });
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('popstate', on); window.addEventListener('palo:nav', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('palo:nav', on); };
  }, []);
  return <Ctx.Provider value={loc}>{children}</Ctx.Provider>;
}
export const useLocation = () => useContext(Ctx);
export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); navigate(to);
  };
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}
