# Day 1 · Palo — QA report

Date: 1 November 2026 · Live: https://palo.sites.tab.bot/ · Repo: https://github.com/nabinbabuuranw/palo

## Summary
- API unit tests: **23 / 23 pass** (`npm test`, node --test with node:sqlite as a D1 stand-in). Also passed from a fresh clone of the GitHub repo (`npm ci && npm test && npm run build`).
- TypeScript: `tsc --noEmit` clean. Production build: clean (main bundle 283 KB / 93 KB gzip, routes lazy-loaded; Worker 43 KB).
- Live end-to-end (headless Chromium against the published site, desktop 1440×900 and mobile 390×844): **30 / 30 checks pass**.
- Live security probes: 7 / 7 as expected (below).
- 30-point anti-AI design audit: 29 pass, 1 intentional exception (reasoned).
- Console: no JavaScript errors. The only console lines are the browser's own "failed to load resource" notes for requests the test made on purpose to get 403/404/422.

## Bugs found and fixed during QA
1. **Blank page on second visit to an app route** (critical). The Worker forwarded the browser's If-None-Match header to the asset store, got a 304, and turned it into an empty 200. Fixed (no conditional headers forwarded) and covered by a unit test.
2. **Customer modal crash** (critical). The data hook reported "not loading" for one render when its URL changed from nothing to something. Fixed in useApi, plus an app-wide error boundary so a render error can never show a blank page again.
3. **Note typed before the customer finished loading was wiped** (major). Textarea now waits for the data; E2E now verifies the note persists after reopening.
4. **Per-IP limits too strict for Nepal** (major). Nepali mobile carriers put many people behind one shared IP (CGNAT); signup 8/h per IP blocked the test itself. Raised to 30 signups/h, 40 bookings/h, 60 logins/15 min per IP; the per-email login limit (10/15 min) is unchanged.
5. Hero booking widget opened on a day with no free time in the evening. It now skips forward to the next day with free slots until the visitor picks a day.
6. Insights chart was empty because all bookings were in the future; it now shows the past 7 and next 7 days by appointment day, today in red.
7. Booking code wrapped onto two lines in the hero token slip; mobile home had 19 px horizontal overflow from scroll-linked tokens; translucent header let text show through. All fixed and re-checked.

## Live end-to-end checks (run 2026-11-01 14:55 UTC)
| # | Check | Result | Detail |
|---|---|---|---|
| 1 | home: hero + live demo slots load | PASS |  |
| 2 | guest booking from hero returns a palo code | PASS | P-KWNACJ |
| 3 | explore lists demo business | PASS |  |
| 4 | explore search empty state | PASS |  |
| 5 | register validation shows field errors | PASS |  |
| 6 | customer registered and landed on /me | PASS |  |
| 7 | signed-in booking appears in My bookings | PASS |  |
| 8 | customer cancels own booking | PASS |  |
| 9 | customer cannot open owner dashboard (redirected) | PASS | https://palo.sites.tab.bot/me |
| 10 | customer gets 403 from admin API | PASS | 403 |
| 11 | owner sees dashboard day sheet | PASS |  |
| 12 | pending guest booking is in Waiting for you | PASS | 1 pending |
| 13 | owner confirms a booking | PASS |  |
| 14 | appointment search finds the guest | PASS | 1 |
| 15 | owner saves a customer note (persists after reopening) | PASS | Prefers evening slots (E2E note) |
| 16 | owner has a new-booking notification | PASS |  |
| 17 | owner gets 403 from admin API | PASS | 403 |
| 18 | new owner adds a service | PASS |  |
| 19 | new business booking page is live | PASS | e2e-test-clinic-1793544527 |
| 20 | admin overview loads | PASS |  |
| 21 | admin pauses a business -> its booking page 404s | PASS | 404 |
| 22 | audit log records the pause | PASS |  |
| 23 | page /terms renders | PASS |  |
| 24 | page /privacy renders | PASS |  |
| 25 | page /cancel renders | PASS |  |
| 26 | page /does-not-exist renders | PASS |  |
| 27 | mobile home has no horizontal overflow | PASS | 390 |
| 28 | mobile booking page has no horizontal overflow | PASS | 390 |
| 29 | mobile dashboard has no horizontal page overflow | PASS | 390 |
| 30 | reduced motion: hero text is in place without animation | PASS | none |

## Live security probes
| Probe | Result |
|---|---|
| Cross-origin POST /api/auth/login | 403 bad_origin |
| Form-encoded POST (non-JSON) | 415 |
| Admin API without a session | 401 |
| Session cookie flags | HttpOnly; Secure; SameSite=Lax; 14 days |
| SQL-injection style slug | 404 (parameterised SQL, slug regex) |
| /api/setup with a wrong key | 403 |
| /api/setup replay with the real key after setup | 409 already_set_up |

## Unit test coverage (api/test/api.test.ts)
Validation helpers (Nepal phone, email, slug, dates/times); Kathmandu clock (UTC+05:45); slot engine (fits before closing, capacity, lead time, closed days); PBKDF2 hash round trip and tamper; health; registration validation and duplicate email; owner signup creates business with unique slug; login/logout/me, identical errors for wrong password vs unknown email, forged token; per-email login rate limit with Retry-After; CSRF (cross-origin, Sec-Fetch-Site, non-JSON); RBAC on owner/admin/customer APIs; services/hours/capacity; owner A cannot edit owner B's data; public booking incl. capacity refusal, off-grid times, past/too-far dates, Saturday closed; holiday blocks; status transitions (invalid jumps refused); customer book (visits, spend, notes, delete, cross-owner 404); walk-ins; stats; customer cancels own booking only, notifications both ways; guest cancel needs matching code + phone; first-admin setup once; admin overview, pause business hides page, plan change notifies owner, disable user kills sessions, cannot disable self; profile update, password change revokes old sessions, account deletion; SQL-injection strings inert; no secret in source; SPA fallback headers and 404s.

## Responsive, motion, accessibility
- Desktop 1440 and mobile 390 inspected by screenshot for every main screen (screenshots/ folder). No horizontal overflow at 390 px on home, booking page, dashboard.
- Mobile navigation: collapsible menu; dashboard uses a horizontal section strip; "Waiting for you" moves above the day sheet on small screens.
- Motion: hero headline line reveal, hero card entrance with subtle pointer tilt (mouse only), scroll-linked day-sheet tokens that slide in and back out when scrolling up, section reveals that reverse when scrolled away, page and dashboard-section transitions, modal spring, staggered slot grid, bar charts that grow in view, token slip "printing" on booking, layout-animated nav indicators.
- Reduced motion: `MotionConfig reducedMotion="user"` plus a CSS media query that removes transitions/animations; verified with an emulated prefers-reduced-motion browser (hero text rendered in place, transform none).
- Keyboard: skip link, visible focus rings, modals trap focus and close on Escape, radio-group semantics for service/day/time pickers, labelled inputs with error text tied by aria-describedby.

## 30-point anti-AI design audit
| # | Pattern | Result | Notes |
|---|---|---|---|
| 1 | Harsh gradients | Pass | No decorative gradients. Only the skeleton shimmer and a hatched pattern marking closed days in the week view (functional). |
| 2 | Pure white backgrounds | Pass | Paper #F2EDE3 page, #FAF7F0 cards. No #FFFFFF surfaces. |
| 3 | Rainbow colouring | Pass | Three accents, each with one meaning: pine = confirmed/primary, marigold = waiting, sindoor = action/no-show/today. |
| 4 | Heavy drop shadows | Pass | One soft shadow for raised objects (hero card, modals, token slips). Everything else uses 1px rules. |
| 5 | Liquid glass | Pass | None. The header was translucent with a 2px blur in pass 1; changed to solid paper after the screenshot review. |
| 6 | Generic purple + black | Pass | Warm paper, pine green, vermilion. No purple, no black canvas. |
| 7 | Radial orbs | Pass | None. |
| 8 | Excessive neon | Pass | None. All colours are muted, print-like. |
| 9 | Basic pastel palette | Intentional exception | Soft tints appear only as status-pill and calendar-block backgrounds, derived from the core colours so text stays AA readable. Not used as the brand palette. |
| 10 | Default Lucide icons | Pass | No icon library. 22 custom 20px SVG icons with square terminals (src/components/Icons.tsx). |
| 11 | Emojis as UI icons | Pass | None. |
| 12 | Inter / Geist / Space Grotesk | Pass | Fraunces (display) + Figtree (text) + Mukta (Devanagari), self-hosted. |
| 13 | Sparkle icons | Pass | None. |
| 14 | Animated arrows | Pass | None. Chevrons are static controls. |
| 15 | Hover animations everywhere | Pass | Hover is a colour/border change on interactive elements only. No scale, lift or bounce on hover. |
| 16 | Three-feature-card layout | Pass | Features are four numbered editorial rows with rules, not cards. |
| 17 | Coloured left stripes on cards | Pass | None. The admin audit log uses a neutral timeline rule, which is a timeline, not a card accent. |
| 18 | Repetitive bento grids | Pass | None. |
| 19 | Terminal mockups | Pass | None. |
| 20 | Generic three-tier pricing | Pass | Two-column comparison table (Free / Pro) with honest notes about what is not available yet. |
| 21 | Soft rounded corners everywhere | Pass | 3px default radius, 8px only on large panels; the token slip has a torn edge instead of rounding. |
| 22 | Dot-grid backgrounds | Pass | None. (An unused paper-texture utility was removed.) |
| 23 | Excessive em dashes | Pass | Zero em dashes in the interface copy (checked by search over src/). |
| 24 | "It's not X, it's Y" copy | Pass | None. Copy is plain and specific. |
| 25 | Repetitive checkmark lists | Pass | None. Pricing uses words in a table. |
| 26 | Fake testimonials | Pass | None. No testimonials, no customer counts, no logos. The directory says it only lists businesses that signed up themselves. |
| 27 | Missing real product demo | Pass | The home hero is the real booking flow against the live API on a clearly labelled demo business; bookings there are stored and appear in that business's dashboard. |
| 28 | Missing skeleton loaders | Pass | Skeletons on page load, booking widget, slots, lists, dashboard sections, notifications, admin. Shimmer stops under reduced motion. |
| 29 | Missing Terms of Service | Pass | /terms (8 sections, Nepal law references), linked in footer, signup and booking form. |
| 30 | Missing Privacy Policy | Pass | /privacy (8 sections: data, cookie, retention, rights under the Individual Privacy Act 2075), linked in footer, signup and booking form. |

## Not done / known limits
- No online payment (eSewa/Khalti need merchant accounts and keys). Booking pages say "pay at the venue".
- No SMS/email reminders (paid per message; needs approval). In-app notifications only, refreshed every 45 s (no websockets).
- One shared calendar per business with a capacity number; no per-staff calendars or staff logins yet.
- English UI only; Nepali translation not done.
- No automated accessibility scanner run (axe/Lighthouse) today; checks above were manual + scripted.
- Test data left on the live site: E2E test accounts (e2e.*@example.com) and paused "E2E Test Clinic" businesses; E2E bookings on the demo business were cancelled and E2E customers removed from its book.
