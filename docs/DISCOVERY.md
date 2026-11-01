# Day 1 · Palo — Product discovery

Date: 1 November 2026 · Day 1 of 100 · Live: https://palo.sites.tab.bot/

## 1. Market
Kathmandu Valley has thousands of appointment-based small businesses: dental and skin clinics, polyclinics, physiotherapy rooms, salons, barbers, spas, tutors. Most take bookings by phone, Viber/WhatsApp and Facebook Messenger, and keep them in a paper diary or in someone's head. Customers find them on Facebook and Google Maps, then have to call during opening hours.

## 2. Target customer
Owner or front-desk person of a 1–10 seat appointment business in the Valley (first: salons/barbers and small dental/skin clinics), comfortable with a smartphone and Facebook, unwilling to pay foreign-card subscriptions.

## 3. Main problem
- Phone tag: bookings only happen while someone can answer the phone.
- Double bookings and forgotten appointments from a paper diary.
- No customer history: who comes often, who never shows up, what they had last time.
- Existing tools are either foreign (USD, card payment, no Nepal phone formats) or full management suites priced for established businesses.

## 4. Competitors (checked 1 Nov 2026)
| Product | What it is | Price seen | Source |
|---|---|---|---|
| Chairlyo | Nepal-built salon & spa management suite (booking page, BS calendar, POS, inventory) | Basic $31.56 per branch/month, Pro $56.81, Premium $94.68 (shown in USD at fetch time) | https://chairlyo.com/pricing |
| Delta Tech Nepal salon system | Salon management software from a Nepali software house | Price not published | https://deltatechnepal.com/business-apps/salon-management-system |
| ClinicSathi | Nepal clinic management software focused on dental clinics, 30-day trial | Pricing page did not render for a plain fetch | https://www.clinicsathi.com/ |
| Mero Doctor | Patient app for booking hospital / doctor tickets | Free for patients; hospital-side | https://merodoctor.com/ |
| Setmore, SimplyBook.me, Picktime | Global booking tools with free tiers | Free tiers; paid in USD by card | https://www.setmore.com/ · https://simplybook.me/en/ · https://www.picktime.com/ |

Gap: nothing simple and very cheap that a one-chair salon or a two-chair dental clinic can start using in five minutes, priced in rupees, without a card, with Nepal phone numbers and Nepal time built in.

## 5. Design opportunities
- The Nepali queue token ("palo" = your turn): booking confirmation as a printed token slip with a code, familiar from hospital and bank counters.
- A front-desk "day sheet" rather than a generic SaaS dashboard grid.
- Warm paper and pine/vermilion palette instead of the default dark-purple SaaS look; editorial serif type.

## 6. USP
"Your booking page in five minutes, Rs 0 to start." Real capacity-aware slots (chairs/doctors), phone-first booking (no customer account needed), a customer book that fills itself, Nepal time and phone formats, honest pay-at-venue messaging.

## 7. Product spec (built)
- Public: home with live booking demo, directory with search and category filter, booking page per business (services, 7-day strip, real free slots, booking form, token slip), guest cancellation by code + phone, Terms, Privacy, 404.
- Customer: register/login, My bookings (upcoming/past), cancel, profile, password change, account deletion, notifications.
- Business owner: day sheet (timeline + waiting requests), week calendar, appointments (search/filter/status flow), phone/walk-in bookings, customer book (visits, no-shows, spend, private notes), services CRUD, opening hours, holidays, insights (bookings by day, top services, outcomes), business settings (capacity, slot interval, notice, auto-confirm), booking link, Pro request, notifications.
- Platform admin: overview counts + chart, businesses (search, pause/activate, plan + paid-until), people (search, role filter, disable/enable), audit log.

## 8. Design direction: Organic Editorial
Chosen because booking is a calm, human, front-desk activity in a city with strong paper and print culture; an editorial look (serif display, paper tones, ruled lines, numbered sections) feels trustworthy for clinics and premium for salons, and is the opposite of a neon tech dashboard.
- Palette: paper #F2EDE3, card #FAF7F0, ink #1D2925, pine #24493D (primary), sindoor vermilion #B5432A (accent), marigold #B87A12 (waiting), lines #D9CFBE.
- Type: Fraunces (display, optical sizes) + Figtree (text) + Mukta for Devanagari, all self-hosted (SIL OFL).
- Icons: Palo's own 20px set (square terminals), no icon library.

## 9. Technical architecture
- React 18 + Vite + TypeScript + Tailwind 3, Motion (LazyMotion/domAnimation), hand-written router, lazy-loaded routes.
- One Cloudflare Worker serves the SPA (static assets binding) and the JSON API under /api.
- Cloudflare D1 (SQLite) replaces PostgreSQL/Prisma at $0; schema created by the Worker.
- Auth: PBKDF2-SHA256 (100k) password hashes, random session tokens stored hashed, HttpOnly Secure SameSite=Lax cookie, Origin + Sec-Fetch-Site + JSON-only CSRF defence, D1 rate limits, RBAC (customer / owner / admin).
- Atomic capacity check in a single INSERT…SELECT so two people cannot take the last seat.
