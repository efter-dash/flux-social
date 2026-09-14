# FLUX

Content production command centre for social media teams. Plan, produce and
publish as a team — one pipeline, one calendar, one set of numbers.

Built from two inputs: a *Content Production Management System* spreadsheet
(which defined the domain) and a Stitch design export (which defined the look —
the **Obsidian Flux** dark theme). It is a generalised product: nothing about any
particular team is hard-coded.

---

## What it does

| Section | Replaces | Notes |
| --- | --- | --- |
| **Dashboard** | `01 Dashboard` | KPIs, stage queues, trend/status/platform charts, team snapshot — all for a selected month |
| **Calendar** | part of `02 Monthly Content Plan` | Month grid on desktop, agenda on mobile, unscheduled items surfaced below |
| **Pipeline** | `04 Production Tracker` | Board with a column per configured stage, plus an "Attention" table of blockers and stalls |
| **Content plan** | `02 Monthly Content Plan` | Cards or a dense sortable table, with filters shared across the app |
| **Tasks** | `03 Daily Task Tracker` | Defaults to your own work; overdue is computed, not typed |
| **Idea bank** | `09 Content Ideas` | Funnel + one-click promotion of an approved idea into the plan |
| **Publishing** | `05 Publishing & Performance` | Ready-to-publish queue, metric entry, engagement rate computed live |
| **Library** | `07 Content Library` | A view over everything published — no separate filing step |
| **Team** | `06 Team Performance` + `08 Team Directory` | Per-stage output columns generated from *your* pipeline |
| **Weekly review** | `10 Weekly Review` | Numbers computed per week; only the discussion notes are typed |
| **Settings** | `Lists` tab + README instructions | Pipeline, dropdowns, join codes, access, export |

### The one structural rule

**Nothing that can be computed is stored.** Current stage, overall status,
responsible person, days remaining, overdue flags, engagement, engagement rate,
completion rates, every dashboard figure and every alert are derived at render
time in `src/lib/derive.ts` and `src/lib/metrics.ts`.

That is the actual fix for the spreadsheet's biggest weakness: formula columns
that someone eventually types over, after which the tabs quietly disagree with
each other.

### Generalisation

The spreadsheet assumed a video team (`Script → Shoot → Editing → Review`, and
columns literally named "Videos Edited"). FLUX takes those as one option:

- **Pipeline stages** are workspace-configurable — rename, reorder, add, remove,
  and set which job role owns each. Five starting templates ship (Video, Design,
  Written, Agency with a client-approval gate, and a simple two-step).
- **Every dropdown** — content types, categories, platforms with their brand
  colours, priorities, task types, objectives, ratings, job roles — is editable
  per workspace in *Settings → Dropdowns*.
- **Code prefixes** (`CN-0001`, `T-0042`, `ID-007`) are configurable, and the
  counters live on the workspace so a deleted item never frees its code.
- **Multi-workspace**: one person can belong to several teams or clients and
  switch between them; all data is scoped per workspace.

---

## Running it

```bash
cd flux
npm install
npm run dev
```

Opens on <http://localhost:5199>. No account, no backend, no configuration — the
default storage is IndexedDB in your browser. On first run, create a workspace
and optionally load sample data so every screen has something in it.

Other scripts:

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # types only
```

---

## Switching to Firebase

The app talks to a storage interface (`src/lib/db/types.ts`) with two
implementations. Swapping them is an environment variable — no application code
changes.

| | `local` (default) | `firestore` |
| --- | --- | --- |
| Setup | none | Firebase project |
| Users | this browser only | real teams, live sync |
| Offline | always | cached |
| Cost | free | free on the Spark plan at team scale |

### 1. Create the project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. **Build → Authentication → Get started → Google** → enable.
3. **Build → Firestore Database → Create database** → production mode.
4. **Project settings → Your apps → Web (`</>`)** → register, and copy the config.

### 2. Point the app at it

```bash
cp .env.example .env
```

```ini
VITE_DATA_BACKEND=firestore
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

The sign-in screen becomes "Continue with Google" automatically.

### 3. Deploy

```bash
npm install -g firebase-tools
firebase login
```

Put your project id in `.firebaserc`, then:

```bash
npm run build
firebase deploy --only firestore:rules,hosting
```

Everything used here is on the **free Spark plan**: Hosting, Auth and Firestore.
Nothing in FLUX needs Cloud Functions, Cloud Scheduler or Storage — which is why
invitations are join codes rather than emails, and why alerts are in-app rather
than a nightly digest.

### Data layout

```
workspaces/{ws}                     the Workspace document
workspaces/{ws}/members/{uid}       one per person — id is their auth uid
workspaces/{ws}/content/{id}
workspaces/{ws}/tasks/{id}
workspaces/{ws}/ideas/{id}
workspaces/{ws}/reviews/{id}
joinCodes/{CODE}                    { workspaceId } — lookup for "join with a code"
users/{uid}/memberships/{ws}        which workspaces a person can open
```

### Security model

`firestore.rules` enforces permissions server-side, resting on one decision: a
signed-in person's member document is stored at `workspaces/{ws}/members/{uid}`.
Rules can therefore ask "what is this caller allowed to do here" in a single
`get()`.

- `workspaces` cannot be **listed**, only fetched by id — and ids only come from
  the `joinCodes` mapping, which also cannot be listed.
- Content, tasks, ideas, reviews and the roster are readable by members only.
- Ordinary members may update the workspace document *only* to bump the ID
  counters; everything else on it is admin-only.
- Someone joining with a code may create only their own member row, at exactly
  the access level the workspace grants — so joining cannot be used to award
  yourself admin.
- People may edit their own profile but never their own access level.

### Access levels

Separate from job roles. A **job role** (Videographer, Designer…) decides which
stage gets suggested to whom; an **access level** decides what someone may do.

| Level | Can |
| --- | --- |
| Owner | Everything, including deleting the workspace |
| Admin | Manage people, pipeline, dropdowns, delete content |
| Member | Create and edit content, tasks and ideas |
| Viewer | Read everything, change nothing |

---

## Design system

Obsidian Flux, implemented as CSS custom properties in
`src/styles/index.css` and mapped into Tailwind in `tailwind.config.js`. Colours
are stored as RGB channel triplets so opacity modifiers (`bg-panel/60`) work and
the whole theme can be re-skinned by editing one block.

- **Elevation ladder** — `void → base → sunken → panel → raised → overlay`,
  lighter as elements rise toward the viewer.
- **Type** — Inter throughout, JetBrains Mono for labels, metadata and every
  figure (tabular numerals, so columns align).
- **Accent** — `#4b8eff` for solid primary actions, `#adc6ff` for accent text and
  active states; emerald = done, amber = in progress, violet = ready/scheduled,
  salmon = late or blocked.
- **Charts** are hand-written SVG (`src/components/charts/charts.tsx`) — 2px
  strokes, area gradients fading into the page, a glowing endpoint on the latest
  value. No charting dependency.
- **Icons** are a hand-drawn 24px set (`src/components/ui/Icon.tsx`). No icon
  font, so the app works offline and every glyph shares one optical weight.

Mobile-first: a glass top bar, a four-slot bottom bar with a "More" sheet, and a
floating action button; from `lg` up it becomes the fixed 280px rail plus sticky
header, because the dense tables and month grid need the width.

Total runtime dependencies: React, React Router, and Firebase (lazy-loaded, and
never downloaded at all on the local backend).

---

## Project structure

```
src/
  brand.ts                 app name — rename the product from one file
  lib/
    types.ts               domain model
    date.ts                calendar-day helpers (dates are YYYY-MM-DD strings,
                           never timestamps, so time zones cannot shift a deadline)
    derive.ts              every formula the spreadsheet had, as pure functions
    metrics.ts             dashboard, team performance, weekly rollups, alerts
    factories.ts           object factories + the code/counter system
    templates.ts           default pipelines and dropdown vocabularies
    sample.ts              generic demo workspace, generated relative to today
    db/                    storage interface + local and Firestore adapters
  state/store.tsx          single store: session, workspace, all mutations
  components/
    ui/                    primitives, icons, overlays, month nav
    charts/                SVG charts
    content/               content cards, forms, filters, metric entry
    tasks/                 task row and editor
    layout/                app shell, navigation, command palette, notifications
  routes/                  one file per section
```

---

## Notes and limits

- **Production management, not auto-publishing.** FLUX tracks work and records
  results; it does not post to Instagram, Facebook or YouTube. Real publishing
  would need Meta Business verification and App Review, plus the paid Firebase
  plan for scheduled functions. Each item stores a link to the live post.
- **One primary platform per item**, with additional cross-post platforms for
  planning. Performance is recorded against the primary one, which keeps metrics
  one-to-one with content — the same shape the spreadsheet used.
- **⌘K / Ctrl-K** opens search across content, tasks, ideas, people and pages.
  Typing a code like `CN-0012` is the fastest way to navigate.
- **Deleting a person** who has work attached deactivates them instead, so
  history stays intact — the spreadsheet's "Active? = No" rule.
- On the Firestore backend, a directory entry an admin pre-creates for someone
  is a placeholder; when that person joins with the code, their real row is
  created under their uid and the placeholder is retired.
- Alert dismissals are stored per browser (`localStorage`) — that is the right
  scope for "I have seen this".
