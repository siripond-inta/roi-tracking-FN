# ROI Tracking — Frontend

Angular 21 (standalone components) frontend for the ROI Tracking system. All data and every
calculated figure (ROI, payback month, cash flow, worthwhile status) come from the backend API in
[`roi-tracking-BN`](https://github.com/siripond-inta/roi-tracking-BN) — the frontend doesn't
hardcode lists or recompute financial results.

## Running locally

Start the backend first (see its README — MySQL in Docker + `npm run dev` on port 3000), then:

```bash
npm install
npm start                    # ng serve on http://localhost:4200
npm start -- --host 0.0.0.0  # if localhost doesn't resolve (IPv6-only binding on some Windows setups)
```

`ng` doesn't need to be installed globally — `npm start` / `npx ng ...` use the project's local
Angular CLI.

Demo logins (from the backend seed, password `Passw0rd!` for all): `nichakan@example.com`,
`araya@example.com` (project owners), `admin@example.com` (admin), `viewer@example.com`
(read-only).

## Features

| Page | What it does |
|---|---|
| Community | Public projects shared by other users (read-only reports) |
| Dashboard | Totals across your projects (budget, direct + indirect benefit, average ROI), per-project comparison chart, project cards with status and worthwhile badge |
| Projects | Sortable, paginated list with filters (type, status, worthwhile), CSV export (opens correctly in Excel), edit project details and status |
| New project | Basic info + project type; shows which benefits the chosen type counts |
| Estimated / Actual report | Enter and view data in three sections — **direct revenue**, **indirect benefit**, **costs** — with KPIs, benefit composition, monthly cash flow, plan-vs-actual comparison, charts and print / PDF |
| Admin | Users (incl. dormant-account soft delete), all projects, categories, project types |

### Direct revenue vs indirect benefit

- **Direct revenue** — an amount (THB) per month, e.g. sales or subscription income.
- **Indirect benefit** — pick one of the benefit categories (staff time saved, document costs,
  project analysis costs, error costs) and enter *quantity per month × rate per unit* using your
  organisation's own rate. The form shows the monthly value, the total for the selected months and
  the annualized value; the report and PDF include a breakdown table of quantity, rate, monthly
  value and annual value.
- Every row covers a month range (e.g. month 2–12) instead of one row per month.
- The project type decides what is counted: *revenue-focused* counts direct revenue, *cost-saving*
  counts indirect benefit, *mixed* counts both. Sections that aren't counted are hidden (or shown
  with a warning if they still contain data).
- While editing, the KPI cards are recalculated by the backend
  (`POST /api/projects/:id/analytics/preview`) so they use exactly the same formulas as the saved
  report.

Project status (`planning` → `in_progress` → `completed`) is shown everywhere; completed projects
are locked until reopened from the Actual report or the Projects page.

## Code layout

```
src/app/
├── models/                 Shared interfaces (Project, ProjectLedger, status labels)
├── services/               API clients — one per backend resource
├── user/project.-report/
│   ├── estimated-report/   Estimated report page
│   ├── actual-report/      Actual report page (charts, plan-vs-actual)
│   ├── shared/             Section editor / section view / benefit summary / KPI cards
│   ├── ledger-row.util.ts  Form row model: month ranges, grouping saved rows, API payload
│   ├── ledger-draft.ts     Edit-mode state + debounced live preview from the backend
│   └── report-shared.css   Styles shared by both reports (incl. print rules)
├── user/ admin/            Other pages
└── styles.css              Global styles, status badges, print layout
```

## Building and tests

```bash
npx ng build   # output in dist/
npx ng test    # unit tests (Vitest)
```

## Running with Docker

`docker-compose.yml` and `Dockerfile` in this folder build the app (multi-stage Node build →
served as static files by nginx) and run it standalone:

```bash
docker compose up -d --build
```

Open http://localhost:4200 (override the host port with `FRONTEND_PORT` in the environment, e.g.
`FRONTEND_PORT=8081 docker compose up --build`).

The API base URL (`http://localhost:3000/api/...`) is hardcoded in
`src/app/services/*.service.ts` and resolved by the **browser**, not by this container, so it
keeps working as-is as long as the backend (`roi-tracking-BN`, run separately — see its own
`docker-compose.yml`) publishes port `3000` to the host. Stop a locally running `npm run dev`
backend first, otherwise the backend container can't bind port 3000.

This compose file declares `name: roi-tracking`, matching the backend's. They're still two
separate `docker compose up` commands (two separate repos), but Docker Desktop groups both
containers under one "roi-tracking" stack, and they share the same default Docker network.
