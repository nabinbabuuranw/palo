import { StrictMode, Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import './styles.css';
import { RouterProvider, useLocation } from './lib/router';
import { AuthProvider } from './lib/auth';
import { Header, Footer } from './components/Shell';
import { Toaster, Skeleton } from './components/ui';
import Home from './pages/Home';
import { ErrorBoundary } from './components/ErrorBoundary';

const Explore = lazy(() => import('./pages/Explore'));
const Booking = lazy(() => import('./pages/Booking'));
const AuthPage = lazy(() => import('./pages/Auth'));
const Me = lazy(() => import('./pages/Me'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const Legal = lazy(() => import('./pages/Legal'));
const Cancel = lazy(() => import('./pages/Cancel'));
const NotFound = lazy(() => import('./pages/NotFound'));

const TITLES: Record<string, string> = { '/': 'Palo · Appointment booking for Kathmandu clinics and salons', '/explore': 'Find a place to book · Palo', '/login': 'Sign in · Palo', '/register': 'Create an account · Palo', '/register/business': 'List your business · Palo', '/me': 'My bookings · Palo', '/terms': 'Terms of Service · Palo', '/privacy': 'Privacy Policy · Palo', '/cancel': 'Cancel a booking · Palo' };

function route(path: string) {
  if (path === '/') return <Home />;
  if (path === '/explore') return <Explore />;
  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/register') return <AuthPage mode="customer" />;
  if (path === '/register/business') return <AuthPage mode="business" />;
  if (path === '/me') return <Me />;
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return <Dashboard section={path.split('/')[2] || 'today'} />;
  if (path === '/admin' || path.startsWith('/admin/')) return <Admin section={path.split('/')[2] || 'overview'} />;
  if (path === '/terms' || path === '/privacy') return <Legal doc={path.slice(1) as 'terms' | 'privacy'} />;
  if (path === '/cancel') return <Cancel />;
  const b = /^\/b\/([a-z0-9-]+)$/.exec(path);
  if (b) return <Booking slug={b[1]} />;
  return <NotFound />;
}
function PageFallback() {
  return <div className="container-x py-16 flex flex-col gap-4" role="status" aria-label="Loading page"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-64 w-full mt-6" /></div>;
}
function App() {
  const { path } = useLocation();
  const section = '/' + (path.split('/')[1] || '');
  const appArea = section === '/dashboard' || section === '/admin';
  useEffect(() => { if (TITLES[path]) document.title = TITLES[path]; }, [path]);
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] bg-ink text-paper px-3 py-2 rounded">Skip to content</a>
      <Header compact={appArea} />
      <AnimatePresence mode="wait" initial={false}>
        <m.main id="main" key={section} className="flex-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}>
          <ErrorBoundary resetKey={path}><Suspense fallback={<PageFallback />}>{route(path)}</Suspense></ErrorBoundary>
        </m.main>
      </AnimatePresence>
      {!appArea && <Footer />}
      <Toaster />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <RouterProvider><AuthProvider><App /></AuthProvider></RouterProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
