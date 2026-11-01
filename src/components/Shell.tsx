import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Link, navigate, useLocation } from '../lib/router';
import { useAuth, homeFor } from '../lib/auth';
import { Logo } from './Logo';
import { IconBell, IconMenu, IconClose, IconLeave } from './Icons';
import { Notifications } from './Notifications';

export function Header({ compact }: { compact?: boolean }) {
  const { user, unread, logout } = useAuth();
  const { path } = useLocation();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  useEffect(() => { setOpen(false); setBell(false); }, [path]);
  const nav = [
    { to: '/explore', label: 'Find a place' },
    { to: '/register/business', label: 'For businesses' },
  ];
  const doLogout = async () => { await logout(); navigate('/'); };
  return (
    <header className={`sticky top-0 z-40 bg-paper border-b border-line`}>
      <div className={`${compact ? 'px-5 sm:px-8' : 'container-x'} h-16 flex items-center justify-between gap-4`}>
        <Logo />
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {!compact && nav.map((n) => (
            <Link key={n.to} to={n.to} className={`relative px-3 py-2 text-[0.95rem] rounded focus-ring ${path === n.to ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
              {n.label}
              {path === n.to && <m.span layoutId="navline" className="absolute left-3 right-3 -bottom-0.5 h-[2px] bg-sindoor" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="relative">
                <button onClick={() => setBell((b) => !b)} className="relative p-2 rounded hover:bg-sunk focus-ring" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={bell}>
                  <IconBell />
                  {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-sm bg-sindoor text-paper text-[10px] font-bold leading-4 text-center tnum">{unread > 9 ? '9+' : unread}</span>}
                </button>
                <AnimatePresence>{bell && <Notifications onClose={() => setBell(false)} />}</AnimatePresence>
              </div>
              <Link to={homeFor(user.role)} className="hidden sm:inline-flex h-9 items-center px-3 rounded border border-line-2 text-sm hover:border-ink focus-ring">
                {user.role === 'owner' ? 'Dashboard' : user.role === 'admin' ? 'Admin' : 'My bookings'}
              </Link>
              <button onClick={doLogout} className="hidden sm:inline-flex p-2 rounded hover:bg-sunk focus-ring" aria-label="Sign out" title="Sign out"><IconLeave /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex h-9 items-center px-3 text-[0.95rem] text-ink-2 hover:text-ink rounded focus-ring">Sign in</Link>
              <Link to="/register/business" className="hidden sm:inline-flex h-9 items-center px-4 rounded bg-pine text-paper text-[0.95rem] hover:bg-pine-deep focus-ring">List your business</Link>
            </>
          )}
          <button className="md:hidden p-2 rounded hover:bg-sunk focus-ring" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <m.nav aria-label="Mobile" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 0.8, 0.24, 1] }}
            className="md:hidden overflow-hidden border-t border-line bg-paper">
            <div className="px-5 py-3 flex flex-col">
              {nav.map((n) => <Link key={n.to} to={n.to} className="py-3 border-b border-line font-display text-xl">{n.label}</Link>)}
              {user ? (
                <>
                  <Link to={homeFor(user.role)} className="py-3 border-b border-line font-display text-xl">{user.role === 'owner' ? 'Dashboard' : user.role === 'admin' ? 'Admin' : 'My bookings'}</Link>
                  <button onClick={doLogout} className="py-3 text-left font-display text-xl text-sindoor">Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="py-3 border-b border-line font-display text-xl">Sign in</Link>
                  <Link to="/register" className="py-3 font-display text-xl">Create a customer account</Link>
                </>
              )}
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-x py-10 grid gap-8 sm:grid-cols-[1.4fr,1fr,1fr]">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted max-w-xs">Appointment booking and a customer book for clinics, salons and service businesses in Nepal. Made in Kathmandu.</p>
        </div>
        <div className="text-sm flex flex-col gap-2">
          <p className="eyebrow mb-1">Use Palo</p>
          <Link to="/explore" className="text-ink-2 hover:text-ink">Find a place to book</Link>
          <Link to="/register/business" className="text-ink-2 hover:text-ink">List your business</Link>
          <Link to="/cancel" className="text-ink-2 hover:text-ink">Cancel a booking</Link>
        </div>
        <div className="text-sm flex flex-col gap-2">
          <p className="eyebrow mb-1">Legal</p>
          <Link to="/terms" className="text-ink-2 hover:text-ink">Terms of Service</Link>
          <Link to="/privacy" className="text-ink-2 hover:text-ink">Privacy Policy</Link>
        </div>
      </div>
      <div className="container-x pb-8 text-xs text-muted">© {new Date().getFullYear()} Palo. Times shown in Nepal time (UTC+05:45).</div>
    </footer>
  );
}
