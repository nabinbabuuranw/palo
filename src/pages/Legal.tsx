const UPDATED = '1 November 2026';
const TERMS: [string, string][] = [
  ['What Palo is', 'Palo is an online appointment booking tool. Businesses ("owners") publish a booking page; people ("customers") use it to request or book appointments. Palo is not a party to any appointment: the service, its quality, price and payment are between the customer and the business.'],
  ['Accounts', 'You must give accurate details and keep your password private. You are responsible for activity on your account. We may suspend accounts that break these terms, are used for spam or fraud, or put other users at risk.'],
  ['Businesses', 'Owners must only list real businesses they are authorised to represent, keep services, prices and hours accurate, and treat customer details in line with the Privacy Policy and the laws of Nepal, including the Individual Privacy Act, 2075 (2018). Demo businesses on Palo are clearly labelled and are not real.'],
  ['Customers', 'Book only appointments you intend to keep. Cancel online up to 1 hour before, or call the business. Repeated no-shows are visible to the business you booked with.'],
  ['Payments and plans', 'Palo does not process payments for appointments. Booking pages show how each business takes payment. The optional Pro plan (Rs 999 per month at the time of writing) is arranged directly with the Palo team and can be cancelled at the end of any paid month. We do not charge for features that are not yet available.'],
  ['Availability', 'We work to keep Palo running but do not guarantee it will be uninterrupted or error-free. Palo runs on free hosting tiers during its early phase, which have usage limits. Keep your own record of important appointments.'],
  ['Liability', 'To the extent the law allows, Palo is not liable for indirect losses, lost business, or disputes between customers and businesses. Nothing in these terms limits rights you have under the Consumer Protection Act, 2075 of Nepal.'],
  ['Changes and contact', 'We may update these terms; the date above shows the latest version, and significant changes will be shown in the app. These terms are governed by the laws of Nepal. Questions: use the contact details on the Palo GitHub repository until a support address is published.'],
];
const PRIVACY: [string, string][] = [
  ['What we collect', 'Account: name, email, optional phone, and a password stored only as a salted PBKDF2 hash. Bookings: the name, mobile number, optional email and note you enter, plus the service, date and time. Technical: a session cookie that keeps you signed in, and your IP address used briefly for rate limiting abuse.'],
  ['What we do not do', 'No advertising, no selling or renting of data, no third-party analytics or tracking scripts, no social-media pixels. Fonts and code are served from Palo itself.'],
  ['Who sees your booking', 'The business you book with sees your booking details and keeps them in its customer book, including how many times you visited or did not show up. Businesses may add private notes. Palo administrators can see account and business records to run and protect the service.'],
  ['Cookies', 'One strictly necessary cookie (palo_sid): HttpOnly, Secure, SameSite=Lax, expires after 14 days or when you sign out. No other cookies.'],
  ['Retention', 'Your account stays until you delete it. Customers can delete their account from the Account tab; the business keeps the appointment record it needs for its own records. Businesses can ask us to delete their business and data.'],
  ['Security', 'Traffic is encrypted with HTTPS. Passwords are hashed, sessions are random tokens stored hashed, sign-in and booking are rate limited, and every private request checks your role. No system is perfectly secure; tell us if you find a problem.'],
  ['Where data lives', 'Data is stored in a Cloudflare D1 database on Cloudflare\'s network, which may be outside Nepal.'],
  ['Your rights', 'You can see and correct your details in your account, ask what we hold about you, and delete your account. These rights follow the Individual Privacy Act, 2075 (2018) of Nepal.'],
];
export default function Legal({ doc }: { doc: 'terms' | 'privacy' }) {
  const items = doc === 'terms' ? TERMS : PRIVACY;
  return (
    <article className="container-x py-12 sm:py-16 grid lg:grid-cols-[240px,1fr] gap-10">
      <aside className="lg:sticky lg:top-24 self-start">
        <p className="eyebrow">Legal</p>
        <nav className="mt-3 flex flex-col gap-1 text-sm" aria-label="Sections">
          {items.map(([h], i) => <a key={h} href={`#s${i + 1}`} className="text-ink-2 hover:text-ink py-0.5">{i + 1}. {h}</a>)}
        </nav>
      </aside>
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl sm:text-5xl">{doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h1>
        <p className="text-sm text-muted mt-3">Last updated {UPDATED}. Written in plain language.</p>
        {items.map(([h, t], i) => (
          <section key={h} id={`s${i + 1}`} className="mt-9 scroll-mt-24">
            <h2 className="font-display text-2xl"><span className="text-line-2 tnum mr-2">{i + 1}</span>{h}</h2>
            <p className="mt-3 text-ink-2 leading-relaxed">{t}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
