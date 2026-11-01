
import json, sys, time, re
from playwright.sync_api import sync_playwright
BASE='https://palo.sites.tab.bot'
OUT=sys.argv[1]; creds=json.load(open(sys.argv[2]))
stamp=str(int(time.time()))
log=[]; errors=[]
def ok(name, cond, detail=''):
    log.append({'check':name,'pass':bool(cond),'detail':detail}); print(('PASS ' if cond else 'FAIL ')+name+(' :: '+detail if detail else ''), flush=True)
def watch(page):
    page.on('console', lambda m: errors.append(f'{page.url} console.{m.type}: {m.text}') if m.type=='error' else None)
    page.on('pageerror', lambda e: errors.append(f'{page.url} pageerror: {e}'))
def shot(page, name, full=True):
    page.wait_for_timeout(900); page.screenshot(path=f'{OUT}/{name}.png', full_page=full)
def login(page, who):
    page.goto(BASE+'/login'); page.fill('input[type=email]', creds[who]['email']); page.fill('input[type=password]', creds[who]['password'])
    page.click('button[type=submit]'); page.wait_for_load_state('networkidle')
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- desktop
    ctx=b.new_context(viewport={'width':1440,'height':900}); page=ctx.new_page(); watch(page)
    page.goto(BASE+'/'); page.wait_for_selector('text=Live booking page'); page.wait_for_selector('[role=radiogroup][aria-label=Time] button', timeout=20000)
    ok('home: hero + live demo slots load', page.locator('[aria-label=Time] button:not([disabled])').count()>0)
    shot(page,'desktop-home-hero', full=False)
    page.goto(BASE+'/'); page.wait_for_selector('[aria-label=Time] button:not([disabled])', timeout=20000)
    # scroll through to trigger reveals then full page
    for i,(sel,name) in enumerate([('text=The whole day on one sheet.','desktop-home-daysheet'),('text=What a business gets','desktop-home-features'),('#pricing','desktop-home-pricing')]):
        page.locator(sel).scroll_into_view_if_needed(); page.mouse.wheel(0, 250 if i else 120); page.wait_for_timeout(1500); shot(page, name, full=False)
    # guest booking from the hero widget
    page.goto(BASE+'/'); page.wait_for_selector('[aria-label=Time] button:not([disabled])', timeout=20000)
    page.locator('[aria-label=Time] button:not([disabled])').first.click()
    page.fill('input[autocomplete=name]', 'E2E Guest '+stamp); page.fill('input[autocomplete=tel]', '9800'+stamp[-6:])
    page.locator('form button[type=submit]').click()
    page.wait_for_selector('text=Your palo', timeout=20000)
    ref=page.locator('p.font-display.tnum').first.inner_text()
    ok('guest booking from hero returns a palo code', re.match(r'^P-[A-Z0-9]{6}$', ref) is not None, ref)
    shot(page,'desktop-home-booked', full=False)
    # explore + booking page
    page.goto(BASE+'/explore'); page.wait_for_selector('text=Thamel Hair Studio'); ok('explore lists demo business', True)
    page.fill('input[placeholder^=Search]', 'zzzz-nothing'); page.wait_for_selector('text=No matches'); ok('explore search empty state', True)
    shot(page,'desktop-explore-empty', full=False)
    page.goto(BASE+'/b/demo-business-thamel-hair-studio'); page.wait_for_selector('[aria-label=Time] button:not([disabled])', timeout=20000)
    shot(page,'desktop-booking-page')
    # register customer, then book while signed in
    page.goto(BASE+'/register'); page.click('button[type=submit]'); page.wait_for_selector('text=Please fix the highlighted fields', timeout=8000)
    ok('register validation shows field errors', page.locator('[role=alert]').count()>=3)
    cemail=f'e2e.customer.{stamp}@example.com'
    page.fill('input[autocomplete=name]', 'E2E Customer'); page.fill('input[type=email]', cemail); page.fill('input[autocomplete=tel]', '9811'+stamp[-6:]); page.fill('input[type=password]', 'Testpass123')
    page.check('input[type=checkbox]'); page.click('button[type=submit]'); page.wait_for_url('**/me', timeout=15000)
    ok('customer registered and landed on /me', '/me' in page.url)
    page.wait_for_selector('text=No upcoming bookings'); shot(page,'desktop-me-empty', full=False)
    page.goto(BASE+'/b/demo-business-thamel-hair-studio')
    try: page.wait_for_selector('[aria-label=Time] button:not([disabled])', timeout=20000)
    except Exception:
        page.screenshot(path=f'{OUT}/fail-signed-in-booking.png'); raise
    page.locator('[aria-label=Time] button:not([disabled])').nth(1).click()
    page.fill('textarea', 'E2E test booking, please ignore'); page.locator('form button[type=submit]').click(); page.wait_for_selector('text=Your palo', timeout=20000)
    page.click('text=See my bookings'); page.wait_for_selector('text=Thamel Hair Studio', timeout=15000)
    ok('signed-in booking appears in My bookings', page.locator('li:has-text("Thamel Hair Studio")').count()>=1)
    shot(page,'desktop-me-bookings', full=False)
    # cancel it via modal
    page.locator('li button:has-text("Cancel")').first.click(); page.wait_for_selector('[role=dialog]'); shot(page,'desktop-me-cancel-modal', full=False)
    page.locator('[role=dialog] button:has-text("Cancel booking")').click(); page.wait_for_selector('text=Booking cancelled', timeout=10000)
    ok('customer cancels own booking', True)
    # RBAC from browser: customer opening /dashboard is redirected
    page.goto(BASE+'/dashboard'); page.wait_for_timeout(2500); ok('customer cannot open owner dashboard (redirected)', '/dashboard' not in page.url, page.url)
    r=page.evaluate("fetch('/api/admin/overview').then(r=>r.status)"); ok('customer gets 403 from admin API', r==403, str(r))
    page.locator('button[aria-label="Sign out"]').click(); page.wait_for_timeout(1000)
    # owner
    login(page,'owner'); page.wait_for_url('**/dashboard**', timeout=15000)
    page.wait_for_selector('text=Waiting for you'); page.wait_for_timeout(1500)
    ok('owner sees dashboard day sheet', True)
    shot(page,'desktop-dash-today', full=False)
    pend=page.locator('li.slip'); n=pend.count(); ok('pending guest booking is in Waiting for you', n>=1, f'{n} pending')
    if n: pend.first.locator('button:has-text("Confirm")').click(); page.wait_for_selector('text=confirmed', timeout=10000); ok('owner confirms a booking', True)
    page.click('nav[aria-label=Dashboard] >> text=Week'); page.wait_for_timeout(1800); shot(page,'desktop-dash-week', full=False)
    page.click('nav[aria-label=Dashboard] >> text=Appointments'); page.wait_for_timeout(1800)
    page.fill('input[placeholder^="Name, phone"]', 'E2E Guest '+stamp); page.wait_for_timeout(1500)
    ok('appointment search finds the guest', page.locator('tbody tr').count()==1, str(page.locator('tbody tr').count()))
    page.fill('input[placeholder^="Name, phone"]', ''); page.wait_for_timeout(1200); shot(page,'desktop-dash-appointments', full=False)
    page.click('nav[aria-label=Dashboard] >> text=Customers'); page.wait_for_timeout(1800)
    page.wait_for_selector('main li button:has-text("visit")', timeout=15000); page.locator('main li button:has-text("visit")').first.click(); page.wait_for_selector('[role=dialog] textarea:not([disabled])', timeout=15000); page.fill('[role=dialog] textarea', 'Prefers evening slots (E2E note)'); page.click('[role=dialog] >> text=Save notes'); page.wait_for_selector('text=Notes saved', timeout=8000)
    page.keyboard.press('Escape'); page.wait_for_timeout(600); page.locator('main li button:has-text("visit")').first.click(); page.wait_for_selector('[role=dialog] textarea:not([disabled])', timeout=15000)
    ok('owner saves a customer note (persists after reopening)', page.input_value('[role=dialog] textarea')=='Prefers evening slots (E2E note)', page.input_value('[role=dialog] textarea')); shot(page,'desktop-dash-customer', full=False); page.keyboard.press('Escape')
    page.click('nav[aria-label=Dashboard] >> text=Services'); page.wait_for_timeout(1500); shot(page,'desktop-dash-services', full=False)
    page.click('nav[aria-label=Dashboard] >> text=Hours & holidays'); page.wait_for_timeout(1500); shot(page,'desktop-dash-hours', full=False)
    page.click('nav[aria-label=Dashboard] >> text=Insights'); page.wait_for_timeout(2200); shot(page,'desktop-dash-insights', full=False)
    page.click('nav[aria-label=Dashboard] >> text=Settings'); page.wait_for_timeout(1500); shot(page,'desktop-dash-settings', full=False)
    page.click('button[aria-label^=Notifications]'); page.wait_for_timeout(1500); shot(page,'desktop-notifications', full=False)
    ok('owner has a new-booking notification', page.locator('text=New booking').count()>=1)
    page.keyboard.press('Escape')
    r=page.evaluate("fetch('/api/admin/users').then(r=>r.status)"); ok('owner gets 403 from admin API', r==403, str(r))
    page.locator('button[aria-label="Sign out"]').click(); page.wait_for_timeout(1000)
    # new business signup + add service -> booking page live
    page.goto(BASE+'/register/business')
    oemail=f'e2e.owner.{stamp}@example.com'
    page.fill('input[autocomplete=name]', 'E2E Owner'); page.fill('input[autocomplete=organization]', f'E2E Test Clinic {stamp}')
    page.select_option('select', 'clinic'); page.fill('input[placeholder^="e.g. Baneshwor"]', 'Baneshwor, Kathmandu')
    page.fill('input[type=email]', oemail); page.fill('input[type=password]', 'Testpass123'); page.check('input[type=checkbox]')
    page.click('button[type=submit]'); page.wait_for_url('**/dashboard**', timeout=15000)
    page.click('nav[aria-label=Dashboard] >> text=Services'); page.wait_for_selector('text=No services yet'); shot(page,'desktop-dash-services-empty', full=False)
    page.click('text=Add your first service'); page.fill('[role=dialog] input >> nth=0', 'General consultation'); page.fill('[role=dialog] input[type=number] >> nth=0', '20'); page.fill('[role=dialog] input[type=number] >> nth=1', '500')
    page.click('[role=dialog] button[type=submit]'); page.wait_for_selector('text=Service saved', timeout=8000); ok('new owner adds a service', True)
    slug=page.evaluate("fetch('/api/biz').then(r=>r.json()).then(j=>j.business.slug)")
    page.goto(BASE+'/b/'+slug); page.wait_for_selector('text=General consultation', timeout=15000); ok('new business booking page is live', True, slug)
    page.locator('button[aria-label="Sign out"]').click(); page.wait_for_timeout(800)
    # admin
    login(page,'admin'); page.wait_for_url('**/admin**', timeout=15000); page.wait_for_selector('text=Palo register'); page.wait_for_timeout(1800)
    ok('admin overview loads', page.locator('text=Businesses').count()>=1); shot(page,'desktop-admin-overview', full=False)
    page.click('nav[aria-label=Admin] >> text=Businesses'); page.wait_for_timeout(1800)
    row=page.locator(f'tr:has-text("E2E Test Clinic {stamp}")'); row.locator('text=Manage').click(); page.wait_for_selector('[role=dialog]')
    page.locator('[role=dialog] select').first.select_option('suspended'); page.click('[role=dialog] >> text=Save'); page.wait_for_selector('text=Business updated', timeout=8000)
    st=page.evaluate(f"fetch('/api/public/b/{slug}').then(r=>r.status)"); ok('admin pauses a business -> its booking page 404s', st==404, str(st))
    shot(page,'desktop-admin-businesses', full=False)
    page.click('nav[aria-label=Admin] >> text=People'); page.wait_for_timeout(1500); shot(page,'desktop-admin-people', full=False)
    page.click('nav[aria-label=Admin] >> text=Audit log'); page.wait_for_timeout(1500); ok('audit log records the pause', page.locator('text=business.update').count()>=1); shot(page,'desktop-admin-audit', full=False)
    page.locator('button[aria-label="Sign out"]').click()
    for path,txt in [('/terms','Terms of Service'),('/privacy','Privacy Policy'),('/cancel','Cancel a booking'),('/does-not-exist','not on the sheet')]:
        page.goto(BASE+path); page.wait_for_selector('text='+txt, timeout=10000); ok(f'page {path} renders', True)
    shot(page,'desktop-404', full=False)
    page.goto(BASE+'/terms'); shot(page,'desktop-terms', full=False)
    ctx.close()
    # ---------- mobile 390
    m=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); page=m.new_page(); watch(page)
    page.goto(BASE+'/'); page.wait_for_selector('[aria-label=Time] button', timeout=20000); shot(page,'mobile-home-hero', full=False)
    page.locator('text=The whole day on one sheet.').scroll_into_view_if_needed(); page.wait_for_timeout(1500); shot(page,'mobile-home-daysheet', full=False)
    w=page.evaluate('document.documentElement.scrollWidth'); ok('mobile home has no horizontal overflow', w<=390, str(w))
    page.click('button[aria-label="Open menu"]'); page.wait_for_timeout(500); shot(page,'mobile-menu', full=False); page.click('button[aria-label="Close menu"]')
    page.goto(BASE+'/b/demo-business-thamel-hair-studio'); page.wait_for_selector('[aria-label=Time] button', timeout=20000); shot(page,'mobile-booking')
    w=page.evaluate('document.documentElement.scrollWidth'); ok('mobile booking page has no horizontal overflow', w<=390, str(w))
    login(page,'owner'); page.wait_for_url('**/dashboard**', timeout=15000); page.wait_for_selector('text=Waiting for you'); shot(page,'mobile-dash-today', full=False)
    w=page.evaluate('document.documentElement.scrollWidth'); ok('mobile dashboard has no horizontal page overflow', w<=390, str(w))
    page.goto(BASE+'/dashboard/insights'); page.wait_for_timeout(2500); shot(page,'mobile-dash-insights', full=False)
    m.close()
    # ---------- reduced motion
    r=b.new_context(viewport={'width':1440,'height':900}, reduced_motion='reduce'); page=r.new_page(); watch(page)
    page.goto(BASE+'/'); page.wait_for_selector('[aria-label=Time] button', timeout=20000); page.wait_for_timeout(300)
    op=page.evaluate("getComputedStyle(document.querySelector('h1 span span')).transform")
    ok('reduced motion: hero text is in place without animation', op in ('none','matrix(1, 0, 0, 1, 0, 0)'), op)
    shot(page,'desktop-reduced-motion', full=False)
    r.close(); b.close()
json.dump({'checks':log,'console_errors':errors,'stamp':stamp}, open(f'{OUT}/e2e.json','w'), indent=1)
print('ERRORS', len(errors)); [print(e) for e in errors[:20]]
print('SUMMARY', sum(1 for l in log if l['pass']), '/', len(log))
