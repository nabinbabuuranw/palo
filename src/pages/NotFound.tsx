import { Link } from '../lib/router';
export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="font-display text-[7rem] leading-none text-line-2 tnum">404</p>
      <h1 className="font-display text-3xl mt-4">This page is not on the sheet</h1>
      <p className="text-ink-2 mt-3">The link may be old or mistyped.</p>
      <Link to="/" className="inline-flex mt-8 h-11 items-center px-5 rounded bg-pine text-paper">Back to Palo</Link>
    </div>
  );
}
