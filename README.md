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
   not into any file that gets committed.
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

Events (manual override started, etc.) are recorded in the `Notification`
table and visible under Notifications, but delivery to email/Slack/webhook
is stubbed (`deliveryStatus` stays `PENDING`) — wire a real sender in
`src/lib/audit.ts`'s `writeNotification` when a channel is available.

## Timezone

All schedule times are entered and displayed in the store's configured
timezone (`Store.timezone`, currently `Europe/Rome`) and stored internally
as UTC. Recurring-rule expansion uses the IANA timezone database (via
Luxon) so DST transitions resolve correctly per calendar date rather than
with a flat 24-hour offset.
