# HANDOFF — Nexora Agent v2 (read me first)

Context for a fresh session. Everything planned so far is built, tested and **currently
stopped** (services only — see section 9 to start them). This file is the source of truth
for the next work phases. Work in small chunks, verify each one.

> **v2 status: all roadmap phases (A–E) are implemented and verified.** See the progress log
> in section 7 and the completion summary in section 8 before starting anything new.
> On top of v2: email OTP signup verification, OTP password reset and the password policy
> (8-16 chars, lower + upper + digit) are live via Stytch test creds (`../email-auth.md`,
> copied into `backend/.env`). Smoke is now 83/83.

---

## 0. Current state — 2026-10-19 (where we're at)

- **All planned work is done and verified**: v1 PoC, v2 phases A–E, and the email-auth
  round (OTP signup verification, OTP password reset, password policy).
- Last verification: `DB_ENGINE=sqlite python3 smoke_test.py` → **83/83 passing**;
  `manage.py check` clean; migrations `0001`–`0005` applied to `backend/db.sqlite3`.
- Live Stytch test-env flow was exercised end-to-end with `sandbox@stytch.com` + `000000`
  (signup → verify → dashboard → reset → login with the new password). Real addresses get
  codes emailed by `login@stytchtest.com`.
- Admin account is `admin` / `Admin123`, email `Nexoraagent@proton.me` (both in
  `seed_demo.py` and the dev sqlite DB).
- Services are **stopped** (Django :8000, wa_bridge :3001) — start them with section 9.
- Nothing is half-finished or in-flight. Remaining work = section 5 future plans +
  section 9 known open items.
- `graphify-out/` was refreshed 2026-10-19 after the email-auth work (287 nodes /
  628 edges) — `graphify query` works out of the box. Rebuild recipe (flock workaround)
  is in section 9.
- Design pass 2026-10-19 (no backend changes): automatic dark mode via
  `prefers-color-scheme` (all colors are `:root`/dark tokens; charts read `--chart-*`),
  landing gradient + film-grain treatment, custom `templates/404.html`, staggered
  steps / bottom-aligned plan CTAs, meta `theme-color` everywhere.
- Mascot round 2026-10-19: the site accent family (hero glow, selection, CTA + serif
  gradients, featured tints via `--blush`) now matches the greyish-pink/mauve sphere from
  `mascot.html` (repo root).
- Live-polish round 2026-10-19 (asset version now `?v=4` — bump when editing
  `style.css`/`charts.js`):
  - The mascot is now a small **cursor-following pet** (`.mascot-pet`, fixed, lerp-follow
    with eyes that track the cursor; hidden on coarse pointers and under reduced motion)
    instead of a static hero element; markup + IIFE at the bottom of `landing.html`.
  - Landing hero **chat demo is animated** (`#demo-chat`): messages loop through
    user → typing dots → assistant reply, restarting after a pause; static fallback for
    `prefers-reduced-motion`.
  - Hero `h1` gets a **typing animation** with a caret, then the styled `<em>` version is
    restored (skipped under reduced motion).
  - Below-the-fold polish: per-section radial atmosphere (`.site-section::before`),
    staggered child reveals (`child-in` animation on `.reveal.revealed`), step hover lift +
    gradient step numbers, gradient footer wash, assistant bubble now uses
    `--assist-bg`/`--assist-ink` tokens.
  - Verified after restart: smoke 79/79, landing/login/signup/reset 200, client dashboard
    200 (charts.js?v=4), admin dashboard 200.
- Demo data refresh 2026-10-19: old demo account removed; exactly two shop tenants exist —
  **Zara Fashion** (`zara`/`Zara1234`, PRO) and **Mr Perfect** (`mrperfect`/`Perfect1`, PLUS),
  each with 5 active products + 1 archived "(Legacy)" product (Unsplash images, hotlinked)
  and 2-3 size/color SKUs per product, plus seeded orders/conversations. `seed_demo.py`
  is idempotent and wipes other non-staff tenants first. Agent inventory tools tested
  against the new catalog. `smoke_test.py` now restores `SystemConfig` and cleans up
  its own test users.
- Catalog management upgrade 2026-10-19 (`Product.is_active` + migration `0006`, assets `?v=5`):
  - Products tab rebuilt: **variant-row editor** (SKU/size/color/price/stock per row,
    add/remove rows, `×` remove, inline validation highlighting), **generate size × color
    grid** with auto SKU codes (`SWD-RED-M` style from product initials + color + size),
    **bulk apply** price/stock to all rows, live summary (variant count, total units,
    price range); CSV textarea removed.
  - Catalog list rebuilt: search box (name/desc/SKU/size/color), filter chips with counts
    (All/Active/Archived/Low stock/Out of stock), per-product stats (variants, price
    range, total units, low/out badges), row actions Edit/Duplicate/Archive-Restore,
    and quick stock `−`/`+` steppers on every variant chip (re-renders locally).
  - Archived products are excluded from the agent (`_search_inventory`, catalog prompt)
    and cannot be ordered (`create_or_update_order` refuses); plan limit counts active
    products only. New endpoints: `/api/product/archive/`, `/api/product/duplicate/`,
    `/api/product/stock/`; `/api/product/save/` now rejects duplicate/empty SKU codes
    (within product and across the tenant) and negative price/stock.
  - Smoke grew to **79/79** (13 new checks: variant validation, stock adjust/floor,
    duplicate/archive/restore, agent hides + refuses archived, catalog stats fields).

---

## 1. What exists today (verified)

- `wa_bridge/index.js` — Baileys WhatsApp Web bridge (:3001). Contract with backend:
  `POST /api/webhook/wa/` `{tenant_id, phone, text, image{b64,mime}}` → `{"reply": "..."}`;
  Django calls `POST /wa/:id/send` `{phone, text}`. Don't change this contract.
- `backend/` — Django monolith, single app `core`:
  - `models.py` — SystemConfig; Tenant(user O2O, business_name, plan BASIC/PLUS/PRO,
    plan_status ACTIVE/CANCELLED, wa_status, usage_stats JSON, settings JSON, is_active);
    EmailOTP(email, purpose signup/reset, method_id, code, attempts, used, created_at,
    expires_at); Product(tenant, name, description, base_price, image_url, skus JSON
    [{sku,size,color,price,stock}], is_active — False = archived, hidden from the agent);
    Conversation(tenant, phone, name, messages JSON [{role,content}], needs_human);
    Order(tenant, phone, name, address, items JSON, total,
    status PENDING/ACCEPTED/SHIPPED/CANCELLED/COMPLETED, shipment JSON, created_at).
    Helpers `find_sku`, `adjust_stock`.
  - `agent.py` — OpenAI-compatible chat/completions + vision + 4 tools (search_inventory,
    get_customer_context, create_or_update_order, request_human_support). `_log_error(config, msg)`.
  - `email_auth.py` — Stytch email OTP send/verify (`login_or_create` + `authenticate`),
    dev fallback backend, `CODE_ERROR`; `passwords.py` — `password_error()` 8-16 policy.
  - `plans.py` (limits 50/150/300 + 5/20/50), `couriers.py` (PATHAO stub).
  - `widgets.py` — CLIENT_WIDGETS: `summary_cards, sales_stats, inventory_stats, recent_orders,
    pending_orders, active_orders, order_history, catalog_skus, chat_threads, tenant_settings`;
    ADMIN_WIDGETS: `system_overview, tenant_usage, config_and_logs`.
  - `views.py` — endpoints: `/api/dashboard/?widgets=a,b`, `/api/wa/status/`, `/api/webhook/wa/`,
    `/api/order/<id>/action/` (ACCEPTED|SHIPPED|CANCELLED|COMPLETED + optional note),
    `/api/product/save/` (validates: unique SKU codes per tenant, numeric price/stock >= 0),
    `/api/product/upload/`, `/api/product/archive/` ({id, archived} → is_active),
    `/api/product/duplicate/` (copy with `-COPY` SKU codes), `/api/product/stock/`
    ({id, sku, delta} quick stock adjust), `/api/conversation/<id>/resolve/`,
    `/api/tenant/settings/`, `/api/account/update/`, `/api/admin/config/`, `/api/admin/plan/`,
    `/api/admin/tenant/` (create), `/api/admin/tenant/<id>/`, `/api/admin/tenant/<id>/delete/`;
    pages `/ /login/ /logout/ /signup/ /signup/verify/ /reset/ /reset/verify/`,
    `/dashboard/client/ /dashboard/admin/`.
- Templates `landing.html signup.html verify.html reset.html login.html client.html admin.html 404.html`;
  `static/app.js` (widget auto-binder, `data-action` delegation, `toast()`, drawers),
  `static/charts.js` (hand-rolled SVG, palette from `--chart-*` vars),
  `static/style.css` (design tokens in `:root` + `prefers-color-scheme: dark` block),
  fonts bundled in `static/fonts/` (Geist, Geist Mono, Instrument Serif), `favicon.svg`.
- `seed_demo.py` (admin/Admin123 **staff**, email Nexoraagent@proton.me; two shop tenants with 5 products
  each and 2-3 size/color SKUs per product, images from Unsplash: `zara`/`Zara1234` → "Zara Fashion" (PRO),
  `mrperfect`/`Perfect1` → "Mr Perfect" (PLUS); wipes all other non-staff tenants first),
  `smoke_test.py` **83 checks, all passing** — run it after every backend change and EXTEND it for new endpoints.
- Design system in place (warm monochrome, hairline cards, pastel badges, toasts, skeletons). Skills installed
  at `~/.config/opencode/skills/`: `minimalist-ui`, `redesign-existing-projects`, `high-end-visual-design`
  (load with the skill tool; they are available because opencode was restarted).

## 2. Environment gotchas (these cost hours if forgotten)

- Path is on an SD-card mount: `/storage/emulated/0/opencode projects/nexora agent/nexora-wa-poc/`
  (canonical `/mnt/sdcard/...` — same files).
- `npm` needs `--no-bin-links` here (FS rejects symlinks). Deps already installed; don't reinstall.
- No MySQL, no Chrome/Chromium on this device. **Dev DB = sqlite** via `DB_ENGINE=sqlite` (backend/db.sqlite3).
  MySQL config (env vars) is documented in README but not runnable here.
- Python: system `python3.14` + Django 6.1 installed via pip `--break-system-packages`. `pip3` binary is broken,
  use `python3 -m pip install --break-system-packages ...`.
- Email OTP creds live in `backend/.env` (gitignored; source of truth is `../email-auth.md`).
  `nexora/settings.py` loads `.env` with `os.environ.setdefault`, so real env vars still win.
  Stytch test env: `sandbox@stytch.com` + code `000000` authenticates without sending any mail.
- `pkill -f "node index.js"` kills the tool's own shell (pattern matches its command line). ALWAYS use the
  bracket trick: `pkill -f "[n]ode index.js"`, `pkill -f "[m]anage.py runserver"`.
- Django `runserver` caches compiled templates in the running process: **after editing templates, restart the
  server** or pages will silently serve old HTML.
- Start services (from the project):
  - Django: `cd backend && DB_ENGINE=sqlite setsid nohup python3 manage.py runserver 0.0.0.0:8000 --noreload > /tmp/opencode/nexora-django.log 2>&1 < /dev/null & disown`
  - Bridge: `cd wa_bridge && setsid nohup node index.js > /tmp/opencode/nexora-bridge.log 2>&1 < /dev/null & disown`
- Verify baseline first: `DB_ENGINE=sqlite python3 smoke_test.py` (must be 83/83), `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/login/` → 200.
- No browser for screenshots. Verify UI by curling pages for expected markers + user checks in their browser.

## 3. Rules for the next session (do not "improve" these accidentally)

- Keep the widget-registry pattern: new dashboard data = lambda in `widgets.py` + `data-widget="key"` element.
- Keep the existing JS contract: `data-action` delegation, element ids, `window.NEXORA`. Extend, never rename.
- Never use `alert()`/`prompt()`. Use `toast(msg, kind)` and drawer patterns already in `app.js`.
- All UI must follow the installed design skills (minimalist protocol): warm monochrome tokens, no gradients
  (subtle radial light spots ok), no heavy shadows, pastel-only accents, sentence-case headings, no emoji.
- Small files, no comments, follow existing code style. Run smoke test after backend changes; extend it.
- Bangla/English mixed customers: agent replies in customer language (already handled in prompt).
- Don't touch `wa_bridge` protocol; don't migrate frameworks; don't add heavy deps (chart = hand-rolled SVG).

## 4. Roadmap (implement in this order — one chunk per session if needed)

### Phase A — Public site & auth v2
1. Landing page at `/` (anonymous) — marketing page for "Nexora Agent" designed with the taste skills
   (hero, features, how-it-works, pricing teaser matching plans below, footer). Logged-in users: `/` redirects
   to their dashboard as today. Keep it server-rendered template `landing.html` + same static CSS.
2. Signup at `/signup/`: fields **business name, email, password** (email is the login id).
   Email verification was the one future item here — since implemented with Stytch email OTP
   (see section 8 "Email auth"): signup now creates an inactive user + tenant and activates
   it after `/signup/verify/`.
3. Login stays ONE page for everyone (`/login/`); it already routes staff → admin, tenant → client.
   Change login to accept **email OR username**: if input contains `@`, resolve user by
   `User.objects.filter(email__iexact=input)` then authenticate with `user.username`.
4. Account menu (both client + admin dashboards): change username and change password.
   Endpoint `POST /api/account/update/` `{username?, current_password, new_password?}` — require current
   password for any change; validate uniqueness; on username change re-login session (call `login()`).
5. Extend smoke_test with: signup happy path + duplicate email, email login, username/password change, wrong
   current-password rejection.

### Phase B — Products with images
1. Image upload: `MEDIA_URL=/media/`, `MEDIA_ROOT=backend/media/`, served in DEBUG via urls.py.
   Endpoint `POST /api/product/upload/` (multipart `file`) → validates content type/size (≤5MB, jpeg/png/webp),
   saves under `media/<tenant_id>/`, returns `{url}`. Store URL in existing `Product.image_url`.
2. Client product form gets a file input + preview; keep JSON `product_save` accepting `image_url`.
   Dashboard catalog shows a thumbnail (small, hairline border).
3. Product limit by plan (see Phase D) enforced in `product_save` for NEW products.
4. Future (note only, don't build): ingest products from a shared social post / link → auto-index.

### Phase C — Client dashboard v2 (menus, modern)
New top-nav tabs (order matters, first = default): **Stats, Orders, Active Orders, Products, Assistant, Settings, Conversations**.
1. **Stats (default tab)**: widgets `sales_stats` + `inventory_stats`.
   - Aggregate in Python from non-cancelled Orders `items` JSON: units sold & revenue per product (top sellers);
     pie/donut data `[{label, value}]`; inventory remaining per product (sum of skus stock) + units sold.
   - Charts: new `static/charts.js` — hand-rolled **SVG** donut + horizontal bars (~80 lines), colors from
     CSS vars/pastels, accessible (title text, no lib).
2. **Orders** (rename of today's queue): PENDING with Accept/Cancel (drawer already built), history below.
3. **Active Orders**: ACCEPTED orders; actions **Cancel** (existing flow) or **Ship** →
   new status `SHIPPED`; calls `core/couriers.py::dispatch(order)` stub that logs + returns
   `{courier:"PATHAO", consignment:"<fake-id>"}` stored on `Order.shipment` JSON. Notify customer via
   `_wa_send` ("handed to courier"). Future: real Pathao/other API, creds in SystemConfig.
4. **Assistant** tab: greeting message + custom commands editor → `POST /api/tenant/settings/`,
   stored in new `Tenant.settings` JSON: `{"greeting": str, "commands": [{"trigger": str, "reply": str}]}`.
   Agent integration (in `run_agent`): if conversation was empty → prefix reply with greeting;
   before calling the LLM, exact/prefix case-insensitive match on a command trigger → canned reply,
   no LLM call (still counts in usage).
5. **Settings**: store profile (business name display) + Account (username/password, Phase A.4).
6. Order statuses become: PENDING → ACCEPTED → SHIPPED → COMPLETED (+CANCELLED). Update widgets/badges/
   smoke test. Keep `summary_cards`; add `shipped` count instead of completed if cleaner.

### Phase D — Plans, rate limits, admin v2
1. Model: `Tenant.plan` in {BASIC, PLUS, PRO}, `Tenant.plan_status` {ACTIVE, CANCELLED}. Limits dict in
   `core/plans.py`: products 50/150/300, `messages_per_min` 5/20/50.
2. Enforcement:
   - `product_save`: creating beyond plan product limit → 400 with plan hint.
   - `wa_webhook`: sliding window in `Tenant.usage_stats["recent_msgs"]` (prune >60s). Over limit → skip LLM,
     reply once per window "You're sending messages too fast, one moment please.", log to error_logs, continue.
3. Admin panel v2:
   - Tenant rows become clickable → **tenant detail drawer/page**: per-user stats = total inbound messages,
     orders count, converted sales count, conversion rate (orders/messages, shown as plain text %),
     plan, wa status, usage. New endpoint `GET /api/admin/tenant/<id>/` (JSON) or widget `tenant_detail`
     with `?tenant_id=` — pick endpoint, simpler.
   - Plan controls: upgrade/downgrade (set plan), **cancel plan** (`plan_status=CANCELLED` → webhook ignores
     messages like inactive; admin can reactivate). Extend `/api/admin/config/` or new `/api/admin/plan/`.
   - Troubleshooting: keep Reset WA + Suspend/Activate; add **Delete tenant** (deletes user+tenant, cascades,
     also calls bridge reset to clear session dir). Confirm via drawer, not confirm().
   - Overview widgets: add conversion summary across tenants (`tenant_usage` gains messages/orders/conversion).
4. Extend smoke test: plan enforcement (product limit, rate limit skip), plan change, delete tenant,
   tenant detail endpoint, SHIPPED transition via courier stub.

### Phase E — Polish
- Landing page final pass with taste skills (static audit; no browser available).
- README/HANDOFF refresh; final full smoke run; demo seed updated (give Demo Boutique BASIC plan, a couple
  of SHIPPED/COMPLETED orders + conversations so charts look alive).

## 5. Future plans (explicitly NOT now)

- Courier integration (Pathao etc.) with real credentials.
- Social post → product auto-indexing.
- Payments/subscription billing.
- Real email sending from our own domain (Stytch test sender `login@stytchtest.com` until then).

## 6. Key decisions already made (don't relitigate)

- Signup identity = email (username mirrors email initially). One login page for user + admin.
- Charts = hand-rolled SVG in `static/charts.js`, no external libs.
- Image storage = local `media/` (no S3), multipart upload endpoint.
- Plan limits: products 50/150/300; messages/min 5/20/50 (BASIC/PLUS/PRO).
- Order flow: PENDING → ACCEPTED → SHIPPED → COMPLETED, CANCELLED side-exit; Ship = hand to courier + notify.
- Email OTP = Stytch test env for now (`backend/.env`); no Django email backend/SMTP. Dev fallback
  (`EMAIL_OTP_BACKEND=dev` or no creds) prints codes; smoke test forces the dev backend.
- Signup requires OTP verification before the account is usable (inactive user until verified).
- Password policy everywhere new passwords are set: 8-16 chars, lowercase + uppercase + digit.
- Everything still tenant-scoped; widget/lambda pattern stays.

## 7. Progress log (tick as you go)

- [x] Phase A: landing, signup, email login, account update (+smoke) — 32/32 passing
- [x] Phase B: image upload (+smoke) — 38/38 passing
- [x] Phase C: stats/charts, active orders + ship stub, assistant settings (+smoke) — 44/44 passing
- [x] Phase D: plans + limits + admin detail/delete (+smoke) — 52/52 passing
- [x] Phase E: polish + docs + seed refresh — 52/52 passing
- [x] Email auth: OTP signup verify, OTP password reset, password policy (Stytch test) — 79/79 passing

After each phase: restart Django (template cache!), re-run `DB_ENGINE=sqlite python3 smoke_test.py`,
curl-check the touched pages, and update this checkbox list.

---

## 8. v2 completion summary (phases A–E done)

What shipped on top of v1:

- **Phase A** — `landing.html` public site; `/signup/` (business name + email + password,
  `Tenant(plan="BASIC")`, auto-login); login accepts email *or* username; account drawer
  (username/password change, `POST /api/account/update/`) on both dashboards.
- **Phase B** — `MEDIA_URL=/media/` + `MEDIA_ROOT=backend/media/`; `POST /api/product/upload/`
  (jpeg/png/webp ≤5MB, saved under `media/<tenant_id>/`, written directly to avoid FS lock
  issues on SD mounts); product form file input + preview and catalog thumbnails;
  product limit enforced in `product_save` for new products.
- **Phase C** — client tabs Stats / Orders / Active Orders / Products / Assistant / Settings /
  Conversations; `charts.js` hand-rolled SVG donut + bars; `sales_stats`/`inventory_stats`/
  `pending_orders`/`active_orders`/`order_history`/`tenant_settings` widgets;
  `SHIPPED` status + `core/couriers.py::dispatch` stub (PATHAO consignment, stored on
  `Order.shipment`), ship/cancel/complete flows with WhatsApp notices; assistant greeting +
  instant canned commands (`Tenant.settings`, matched before the LLM, usage still counted).
- **Phase D** — `core/plans.py` (50/150/300 products, 5/20/50 msgs/min), `Tenant.plan_status`
  (cancelled plan → webhook ignored); sliding-window rate limit in `wa_webhook` (recent_msgs
  60s, one "too fast" notice per window, logged); admin tenant drawer with detail
  (`GET /api/admin/tenant/<id>/`, conversion rate), plan/cancel-reactivate
  (`POST /api/admin/plan/`), suspend/reset, two-step delete (cascades + bridge reset);
  `tenant_usage` shows plan, messages, orders, conversion.
- **Phase E** — seed refresh (Demo Boutique BASIC plan, greeting/commands, SHIPPED/COMPLETED/
  PENDING orders, conversations incl. a `needs_human` flag); README rewritten for v2.
- **Email auth (post-v2)** — `core/email_auth.py` sends/verifies OTPs through Stytch
  (`/v1/otps/email/login_or_create` + `/v1/otps/authenticate`, creds in `backend/.env`);
  signup creates an inactive user + tenant and only activates after `/signup/verify/`;
  `/reset/` + `/reset/verify/` do OTP password reset; policy in `core/passwords.py`
  (8-16 chars, lowercase + uppercase + digit) enforced on signup, reset, account update
  and admin tenant creation; login of an unverified user redirects to the verify page;
  `EmailOTP` model tracks method_id/code/attempts/expiry (5 tries, 10 min TTL); dev
  backend (no creds) prints codes to the log and shows them on the page when `DEBUG=1`.
- **Post-v2 audit fixes** — admin tenant drawer buttons were dead (bindings lived in the
  `tenant_settings` renderer, which never ran on admin.html; fixed with a hidden widget +
  one-time `dataset.bound` guard); order status machine added in `order_action`
  (PENDING→ACCEPTED→SHIPPED→COMPLETED, cancel only from PENDING/ACCEPTED, no restock on
  repeat cancel, no reviving cancelled/completed orders); SHIPPED orders can now be
  completed from Order history; malformed webhook image payload returns 400 instead of
  500; `product_save` returns 404 for unknown/foreign product ids; `get_customer_context`
  is scoped to the current chat phone (no cross-customer lookups); `run_agent` re-reads
  `usage_stats` before saving (reduces lost updates vs `_rate_limit`); `charts.js` uses
  inline `style` for CSS variables in SVG; wa_bridge rejects non-numeric tenant ids
  (path-traversal fix).

Verification: `DB_ENGINE=sqlite python3 smoke_test.py` → **79/79 passing** (52 v2 checks
plus 14 email-auth checks). Migrations: `0002_tenant_plan`,
`0003_order_shipment_tenant_settings_alter_order_status`, `0004_tenant_plan_status`,
`0005_emailotp` (already applied to the dev sqlite DB).

Not built (still future plans per section 5): real courier APIs, social-post product
ingest, billing, real-domain email sender.

---

## 9. Next session quick start

All green as of this handoff: smoke **83/83**, demo seed fresh, graph built. Services
(Django :8000, wa_bridge :3001) may be stopped — check, then start if needed:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/login/   # 200 = Django up
curl -s http://127.0.0.1:3001/wa/1/status                               # JSON = bridge up

# Restart Django (pkill MUST be its own command — the start command text matches
# the pkill pattern, and combining them kills your own shell):
pkill -f "[m]anage.py runserver"; sleep 1
DB_ENGINE=sqlite setsid nohup python3 manage.py runserver 0.0.0.0:8000 --noreload \
  > /tmp/opencode/nexora-django.log 2>&1 < /dev/null & disown; sleep 4

# Restart bridge:
pkill -f "[n]ode index.js"; sleep 1
cd wa_bridge && setsid nohup node index.js > /tmp/opencode/nexora-bridge.log 2>&1 < /dev/null & disown
```

- After ANY backend change: restart Django (runs `--noreload`), then
  `cd backend && DB_ENGINE=sqlite python3 smoke_test.py` → expect `83/83 checks passed`.
  Template edits need that restart too — Django 6.1's default template loader is cached
  per process; static file edits are served fresh without a restart.
- Static assets are referenced with a `?v=N` cache-buster (`style.css?v=2`, `charts.js?v=2`)
  because dev-server responses carry no `Cache-Control` and browsers heuristically cache
  them. Bump the version in the templates whenever you change `style.css`/`charts.js`.
- Demo logins: `admin`/`Admin123` (staff, email Nexoraagent@proton.me),
  `zara`/`Zara1234` (Zara Fashion, PRO), `mrperfect`/`Perfect1` (Mr Perfect, PLUS).
- AI provider is OpenAI-compatible (`{base}/chat/completions` + Bearer key + `tools`):
  set it in the admin panel → AI tab, or seed a fresh DB from env
  (`LLM_BASE_URL`, `LLM_API_KEY`/`OPENAI_API_KEY`, `LLM_MODEL`). Local servers
  (Ollama/LM Studio/vLLM) can leave the key blank; a missing key only hard-fails for
  `api.openai.com`. `smoke_test.py` restores the config after its run and deletes its
  own `smoke_*`/`renamed_*` users, so the demo tenants stay pristine.
- Email OTP: Stytch test creds in `backend/.env` (`STYTCH_PROJECT_ID`, `STYTCH_SECRET`,
  `STYTCH_ENV=test`; source `../email-auth.md`). Local testing without a mailbox:
  sign up with `sandbox@stytch.com` and enter `000000` (test-env sandbox value, no
  email sent). Codes for real addresses are emailed by `login@stytchtest.com`.
- `EMAIL_OTP_BACKEND=dev` (or missing creds) generates local codes, printed to the
  Django log and shown on the verify page while `DEBUG=1`.
- Graph: from `/mnt/sdcard/opencode projects/nexora agent` run `graphify query "<question>"`
  (or open `graphify-out/graph.html`). Plain `graphify update` CRASHES on this device
  (flock unsupported on the SD-card mount, plus the CLI re-execs itself and drops
  monkeypatches) — rebuild with this instead (no LLM needed, ~1 min):
  ```bash
  PYTHONHASHSEED=0 /usr/bin/python3 -c "
  import fcntl; fcntl.flock = lambda fd, flags: None
  import sys; sys.argv = ['graphify', 'update', '.']
  from graphify.__main__ import main; main()"
  ```
  Doc-only semantic nodes (README/HANDOFF text) are not regenerated by this path.
- Known open items (audited, deliberately not done): per-customer rate limit (one spammer
  currently blocks the whole tenant), duplicate-SKU validation, browser UI tests
  (Playwright), real courier APIs, billing, OTP resend cooldown (currently relies on
  Stytch rate limits), real-domain email sender.
- Environment gotchas: SD-card mount lacks `flock` (product_upload writes files manually);
  npm needs `--no-bin-links`; bridge rejects non-numeric tenant ids; `run_agent` re-reads
  usage_stats before saving (race narrowed, not eliminated); `_wa_send` logs bridge
  failures under `wa_bridge send ...` in Admin → Logs.
