import { Link } from '../lib/router';
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="#24493D" />
      <path d="M9 7h9.5a6.5 6.5 0 0 1 0 13H13v5H9z" fill="#F2EDE3" />
      <circle cx="18" cy="13.5" r="2.4" fill="#B5432A" />
    </svg>
  );
}
export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 focus-ring rounded" aria-label="Palo home">
      <Mark />
      <span className="font-display text-[1.45rem] leading-none tracking-tight text-ink">Palo</span>
      <span className="font-deva text-sm text-muted translate-y-[1px]" lang="ne">पालो</span>
    </Link>
  );
}
