# Palo — Business plan (Day 1)

All revenue figures below are targets and scenarios, not promises. Actual revenue to date: Rs 0. Actual expenses: $0.

## Customers
1. Salons, barbers and beauty parlours in Kathmandu, Lalitpur, Bhaktapur (1–6 chairs).
2. Small clinics: dental, skin, eye, physiotherapy, polyclinics with a few doctors.
3. Other appointment trades: tutors, tattoo studios, photo studios, car wash, repair shops.

## Problems they pay to solve
Missed calls = missed bookings; double bookings; no-shows with no record; no customer history; time spent on Messenger answering "are you free at 4?".

## Competitors in Nepal
Chairlyo (full salon suite, from $31.56 per branch/month), Delta Tech Nepal (salon software, price on request), ClinicSathi (dental clinic software), Mero Doctor (hospital ticket booking), plus global free tiers (Setmore, SimplyBook.me, Picktime) that bill in USD by card. Sources in DISCOVERY.md.

## Unique selling proposition
Booking page live in five minutes, Rs 0 to start, rupee pricing paid by eSewa/Khalti/bank, Nepal phone and time built in, capacity-aware slots, customer book that fills itself. Deliberately small: booking and customers, not a full POS.

## Pricing (NPR)
- Free: booking page, up to 50 services, day sheet, week view, customer book, insights.
- Pro: Rs 999/month (or Rs 9,990/year): phone and on-site setup help in the Valley, priority support; later SMS reminders and Fonepay/eSewa/Khalti deposit links once those integrations exist. We do not charge for features that do not exist yet.
- Setup service (one-time, optional): Rs 1,500–3,000 to enter services/hours, print a QR poster for the counter and add the link to Facebook/Google Maps.

## Monetization model
Freemium SaaS + optional paid setup. Later: payment-link fee once a licensed gateway is integrated (merchant account needed), and a "featured in directory" listing.

## Customer acquisition
1. Walk-in sales in one area at a time (Baneshwor, Thamel, Lazimpat, Patan): show the live demo on a phone, set up the free page in 10 minutes on the spot.
2. QR poster for the counter ("Book your palo online") so the business's own customers spread it.
3. Facebook groups for salon owners and dental associations; short Nepali demo video (ADSRUN AGENCY can make it).
4. Bundle with ADSRUN website/ads clients: every website client gets Palo free.
5. Referral: a free month of Pro for each business referred.

## Recurring revenue potential (scenarios, not forecasts)
| Paying Pro businesses | Monthly revenue |
|---|---|
| 30 | Rs 29,970 |
| 60 | Rs 59,940 |
| 100 | Rs 99,900 |
Plus one-time setup fees. Reaching 30–100 paying businesses requires steady door-to-door sales over months; conversion from free to paid is unknown until tested.

## Operating cost
$0 today: Cloudflare Workers + D1 free tier through Tab's hosting, open-source fonts, no paid APIs, no domain (palo.sites.tab.bot).

## Free-tier limits and risks
- Cloudflare free tier (as published by Cloudflare; re-check before scaling): about 100,000 Worker requests/day; D1 free tier 5 GB storage, 5 million rows read and 100,000 rows written per day. Enough for hundreds of small businesses; beyond that the paid tier starts at $5/month (would need approval).
- No SMS or email notifications yet (SMS costs money per message in Nepal; needs approval and a provider).
- No online payments (eSewa/Khalti merchant integration needs a registered business and merchant keys).
- No custom domain (buying palo.com.np or similar needs approval; .np domains are free for Nepali entities but need documents).
- Risk: well-funded Nepali suites (Chairlyo) could add a cheaper plan; Palo's answer is simplicity, price and local hands-on setup.
