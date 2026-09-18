# PayPal Routing Console

A private dashboard for scheduling which of several legitimate PayPal
merchant configurations should be handling checkout, on a recurring
schedule, with one-time and emergency overrides, conflict detection, audit
logging, and RBAC.

See the full architecture write-up (feasibility research, decision gate,
DB schema, scheduling algorithm, security model, roadmap):
https://claude.ai/artifact/6R1jBjJJk9JJSuUKWrZ92W

## Why this doesn't flip a live Shopify switch (yet)

The connected store is on Shopify's **Basic** plan. Real, fully-automatic
routing of checkout payments across multiple PayPal accounts requires a
custom Shopify **Payments App**, which needs **Shopify Plus** plus Shopify
Partner approval (see the architecture doc's Decision Gate). Until that's in
place, this app does everything *except* the final Shopify-side switch:

- It resolves, at every point in time, exactly which configuration *should*
  be active (priority: emergency override → one-time override → recurring
  schedule → safe default).
- When the resolved configuration changes, the Dashboard shows a banner
  telling you what to do in Shopify Admin (Settings → Payments → reconnect
  PayPal) and a **Confirm switched** button.
- Clicking it records the transition in `ActivationHistory` and the audit
  log — the same bookkeeping a fully-automated switch would produce.
- If a resolved switch sits unconfirmed past 15 minutes, the banner turns
  red ("Overdue").

Once Plus + Payments App approval are in place, only the final "confirm"
step needs replacing with a real PayPal Orders API call inside the
Payments App backend — the scheduling engine, conflict detection, RBAC,
and audit trail underneath don't change.

## Stack

Next.js 16 (App Router, Server Actions) · Prisma 7 + Postgres (via the `pg`
driver adapter) · Luxon for timezone-safe scheduling · Vitest for the
scheduling engine's unit tests.

## Setup

Needs a Postgres connection string in `DATABASE_URL` (`.env`) — see
**Deployment** below for a genuinely free one (Neon).

```bash
npm install
npx prisma migrate dev --name init   # applies the schema to your DATABASE_URL
npm run db:seed                       # creates an OWNER user, a store, 4 sample
                                       # PayPal configurations — see the schedule
                                       # note below
npm run dev
```

The seeded recurring schedule (Mon-Fri 00-08/08-16/16-00 across Accounts
1/2/3, Sat-Sun 00-12/12-00 across Accounts 2/4) is placeholder data copied
from the original spec — edit it for real via the Schedule page before
relying on this for real routing decisions.

## Deployment (free, no card required)

This runs on **Render**'s free web-service tier (explicitly allows
commercial use, unlike some competitors) plus **Neon**'s free Postgres
(permanent, no card). Total cost: $0. Trade-off: the free Render instance
spins down after 15 minutes idle and takes ~30-60s to wake on the next
request — acceptable for an internal admin tool, not for something that
needs instant response at 3am.

1. **Database — Neon** (https://neon.tech): sign up free, create a project,
   copy the connection string it gives you (starts `postgresql://...`).
   Keep it somewhere private — you'll paste it directly into Render in step 3,
   not into any file that gets committed. **Use the direct connection string,
   not the pooled one** (the one *without* `-pooler` in the hostname) — see
   the troubleshooting note below for why.
2. **Code — GitHub**: create a private repository and push this project to
   it (`git init` is already done here; `git add -A && git commit -m
   "Initial commit"`, then follow GitHub's instructions to add the remote
   and push).
3. **Hosting — Render** (https://render.com): sign up free (no card), New →
   Blueprint, connect the GitHub repo — it will read `render.yaml` in this
   project and set up the web service automatically. When prompted, paste
   your Neon connection string as the `DATABASE_URL` environment variable
   (`SESSION_SECRET` is generated for you automatically). Deploy.
4. Once deployed, run the seed once against production — easiest way is
   temporarily setting `DATABASE_URL` in your own terminal to the Neon
   string and running `npm run db:seed` locally (it seeds whatever database
   `DATABASE_URL` points at). **Change the seeded password immediately**
   after first login, via Settings.
5. Share the Render URL with whoever needs access, and create their
   accounts via Settings → Users with the right role (OWNER/ADMIN/VIEWER).
   The link alone doesn't grant access — login is still required.

### Troubleshooting: deploy fails with "Timed out trying to acquire a
### postgres advisory lock" (error P1002)

This happens when `DATABASE_URL` is Neon's **pooled** connection (hostname
contains `-pooler`). `prisma migrate deploy` takes a session-scoped advisory
lock while it runs; if a deploy is killed or times out mid-migration, the
pooler can leave that lock stuck on a backend connection that never gets
cleaned up, which then wedges every future migration attempt (including
against the direct URL, since the lock is now held server-side, not a
client-side pooling artifact).

Fix: switch `DATABASE_URL` to the **direct** (unpooled) connection string —
same value, minus `-pooler` in the hostname. This app runs as a single
process (`WEB_CONCURRENCY=1` on Render's free tier), so there's no
connection-pooling benefit being given up.

If it's already wedged, clear the stuck lock directly against the database:

```sql
SELECT l.pid, a.query
FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory';
-- then, for the pid found:
SELECT pg_terminate_backend(<pid>);
```

Seeded login: the email in `SEED_OWNER_EMAIL` (defaults to
`pierlucafranzone@gmail.com`) with password `changeme123` — **change this
immediately** via Settings → Users, or by re-seeding with
`SEED_OWNER_PASSWORD` set.

Run the scheduling engine's tests (priority resolution, conflict detection,
midnight/DST handling):

```bash
npm test
```

## Roles

- **OWNER** — everything, plus user management and the Simulation/Live
  automation-mode toggle.
- **ADMIN** — manage configurations, schedules, and overrides; confirm
  switches.
- **VIEWER** — read-only.

## Notifications

Two live alert channels, both free:

- **Email**, via your own Gmail account (nodemailer + Gmail SMTP — no
  third-party email service or domain verification needed).
- **Push**, via [ntfy.sh](https://ntfy.sh) (no account needed — install the
  free ntfy app and subscribe to your topic to get phone notifications).

A scheduled [GitHub Actions workflow](.github/workflows/schedule-check.yml)
pings `/api/cron/check-schedule` every 5 minutes (there's no always-on
background worker on the free hosting tier, so this is what actually
triggers the check). It notifies once when a switch becomes due, and once
more — urgently — if it's still unconfirmed 15 minutes later, then stays
quiet until you confirm it.

**Setup (all free, no card anywhere):**

1. **Gmail App Password**: in your Google Account → Security → 2-Step
   Verification (must be enabled first) → App passwords → create one for
   "Mail". Set it as `GMAIL_APP_PASSWORD` in Render's environment variables,
   along with `GMAIL_USER` (that Gmail address) and `ALERT_EMAIL_TO` (where
   alerts should land — can be the same address).
2. **ntfy push**: install the ntfy app (iOS/Android) or open ntfy.sh in a
   browser, and subscribe to the topic name set in `NTFY_TOPIC` (treat it
   like a password — it's a random string specifically so strangers can't
   guess it and subscribe to your alerts).
3. **Cron secret**: set `CRON_SECRET` to the same random value in both
   Render's environment variables and this GitHub repo's Settings → Secrets
   and variables → Actions (as `CRON_SECRET`), plus `APP_URL` there too
   (your Render URL, e.g. `https://paypal-routing-console.onrender.com`,
   no trailing slash). This is what stops randoms from hitting the endpoint
   and spamming your phone/inbox.

Any channel left unconfigured is simply skipped — the app doesn't require
all three.

## Timezone

All schedule times are entered and displayed in the store's configured
timezone (`Store.timezone`, currently `Europe/Rome`) and stored internally
as UTC. Recurring-rule expansion uses the IANA timezone database (via
Luxon) so DST transitions resolve correctly per calendar date rather than
with a flat 24-hour offset.
