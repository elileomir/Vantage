# App Comprehension Report: Vantage CRM

Analyzed: 2026-06-08 | Files: 78 | Lines: 4919 | Completeness: partial-deep

## Executive Summary

Vantage CRM is a Next.js sales intelligence dashboard for KRDM / Stainless Steel Solutions. It is intended to replace a Power BI plus SharePoint reporting workflow with a responsive web app backed by CIN7 Core, Supabase, Excel target imports, and future AI/report automation. The current app has auth, a dashboard shell, and an executive summary UI, but the dashboard still renders placeholder/sample data and has no local database schema or data API yet.

## Tech Stack

| Layer | Technology | Evidence |
|---|---|---|
| Framework | Next.js 16.2.7 | `package.json:17` |
| Language | TypeScript strict | `tsconfig.json:7` |
| Runtime UI | React 19.2.4 | `package.json:18` |
| Styling | Tailwind CSS v4 plus global CSS tokens | `package.json:30`, `src/app/globals.css:8` |
| Auth | Supabase Auth via `@supabase/ssr` | `package.json:12`, `src/lib/supabase/middleware.ts:7` |
| Charts | Recharts | `package.json:20` |
| Animation | Motion | `package.json:16` |
| Excel parsing | xlsx | `package.json:21` |
| External data | CIN7 Core API | `README.md:35`, `reference/api-docs/dearinventory.apib:33` |

## Architecture

Type: single-tenant Next.js app
Pattern: App Router pages with colocated dashboard components
Rendering: hybrid, with server redirects and client dashboard widgets

Key structure:

```text
src/app/
  page.tsx                         redirect root
  login/page.tsx                   login UI
  dashboard/layout.tsx             protected app shell
  dashboard/page.tsx               executive summary
  auth/callback/route.ts           Supabase callback
src/lib/supabase/
  client.ts, server.ts, middleware.ts
src/app/dashboard/components/
  kpi-cards, daily-chart, brand-breakdown, filter-bar, top-customers
reference/
  api-docs, pbix-extracted, targets, branding, holidays
scripts/
  test-cin7-api.mjs
```

## Pages And Routes

| Route | Component | Auth | Description | Evidence |
|---|---|---:|---|---|
| `/` | `Home` | no direct UI | Redirects based on Supabase user | `src/app/page.tsx:4` |
| `/login` | `LoginPage` | public | Email/password Supabase login | `src/app/login/page.tsx:9` |
| `/dashboard` | `ExecutiveSummaryPage` | yes | Executive summary dashboard | `src/app/dashboard/page.tsx:10` |
| `/auth/callback` | `GET` route | public | Exchanges Supabase code for session | `src/app/auth/callback/route.ts:4` |
| all matched routes | `middleware` | mixed | Redirects unauthenticated users | `src/middleware.ts:4`, `src/lib/supabase/middleware.ts:32` |

Planned but missing pages are linked from the dashboard sidebar: `/dashboard/customers`, `/dashboard/brands`, `/dashboard/reps`, `/dashboard/tabular`, `/dashboard/daily`, `/dashboard/targets`, and `/dashboard/settings` (`src/app/dashboard/layout.tsx:28`).

## API Endpoints

| Method | Path | Handler | Auth | Description |
|---|---|---|---:|---|
| GET | `/auth/callback` | `GET` | public | Supabase PKCE session exchange |

No `src/app/api` application routes exist yet.

## Current Data Model

No local Supabase schema, migration folder, or generated TypeScript database types are present. Antigravity history says Supabase tables were created and that `sales` and `sales_targets` were empty at the last check, but the local repo does not contain the migrations. Local `.env.local` and README refer to Supabase project `cbrqfqxwexhoguoazhgh`, while the current MCP account only exposes `sjziqdbyobfekcyljgpt`, which appears unrelated.

Reference data available locally:

| Source | Files | Purpose |
|---|---|---|
| CIN7 API docs | `reference/api-docs/dearinventory.apib` | API endpoints and auth requirements |
| PBIX export | `reference/pbix-extracted/` | Original Power BI layout, DAX queries, measures and filters |
| Target workbooks | `reference/targets/*.xlsx` | 2025 and 2026 sales targets |
| Holidays workbook | `reference/holidays/Holiday Calendar.xlsx` | South African holidays |
| Branding scrape | `reference/branding/*.json` | KRDM visual context |

## Key Data Flows

### Login

1. User submits the login form (`src/app/login/page.tsx:126`).
2. `handleLogin` calls `supabase.auth.signInWithPassword` (`src/app/login/page.tsx:22`).
3. On success, the router navigates to `/dashboard` and refreshes (`src/app/login/page.tsx:31`).
4. On failure, Supabase error text is rendered in the form (`src/app/login/page.tsx:165`).

### Route Protection

1. `src/middleware.ts` delegates every matched request to `updateSession` (`src/middleware.ts:4`).
2. `updateSession` creates a Supabase server client using cookies (`src/lib/supabase/middleware.ts:7`).
3. It calls `supabase.auth.getUser` (`src/lib/supabase/middleware.ts:28`).
4. Unauthenticated users are redirected to `/login`, except `/login` and `/auth` paths (`src/lib/supabase/middleware.ts:32`).

### Dashboard Render

1. `/dashboard` renders `FilterBar`, `KPICards`, `DailyChart`, `BrandBreakdown`, and `TopCustomers` (`src/app/dashboard/page.tsx:25`).
2. The page passes `data={null}` into data widgets (`src/app/dashboard/page.tsx:31`).
3. KPI cards use placeholder values (`src/app/dashboard/components/kpi-cards.tsx:25`).
4. The daily chart generates random sample data (`src/app/dashboard/components/daily-chart.tsx:23`).
5. Top customers and brand breakdown use sample arrays (`src/app/dashboard/components/top-customers.tsx:10`, `src/app/dashboard/components/brand-breakdown.tsx:30`).

### CIN7 Test Script

1. `main` starts connection and endpoint tests (`scripts/test-cin7-api.mjs:155`).
2. `callAPI` sends CIN7 auth headers (`scripts/test-cin7-api.mjs:49`).
3. A bug prevents the env account id from being used by the headers because `callAPI` still reads the empty `ACCOUNT_ID` constant (`scripts/test-cin7-api.mjs:52`, `scripts/test-cin7-api.mjs:323`).

## UI Element Inventory

| Type | Label | Handler | File |
|---|---|---|---|
| Form | Sign in form | `handleLogin` | `src/app/login/page.tsx:126` |
| Button | Sign in | form submit | `src/app/login/page.tsx:175` |
| Button | Collapse/expand sidebar | `setCollapsed` | `src/app/dashboard/layout.tsx:122` |
| Button | Close mobile nav | `setMobileOpen(false)` | `src/app/dashboard/layout.tsx:133` |
| Button | Open navigation | `setMobileOpen(true)` | `src/app/dashboard/layout.tsx:201` |
| Button | Sign out | `handleSignOut` | `src/app/dashboard/layout.tsx:180` |
| Nav | Main navigation | Next links | `src/app/dashboard/layout.tsx:142` |
| Dropdown | Dashboard filters | `setFilter`, `clearFilter` | `src/app/dashboard/components/filter-bar.tsx:77` |
| Button | Clear all | `setActiveFilters({})` | `src/app/dashboard/components/filter-bar.tsx:128` |
| Table | Top Customers | render only | `src/app/dashboard/components/top-customers.tsx:35` |

## Integrations

| Service | Purpose | Status |
|---|---|---|
| Supabase | Auth now, intended database later | Auth wired, DB schema absent from repo |
| CIN7 Core | Sales, customer, product, brand, transaction source | Test script exists, no sync engine yet |
| Excel target workbooks | Sales target source | Files exist, import unfinished |
| Power BI PBIX export | Design and metric reference | Extracted assets exist |
| Nager.Date | Holiday source | Mentioned in README, no runtime integration |
| Gemini/n8n/WhatsApp | Future AI and automation | Planned only |

## Security Posture

Overall: poor until secrets are removed and rotated.

- P0: CIN7 credentials are exposed in documentation and script files (`README.md:43`, `scripts/test-cin7-api.mjs:7`). CIN7 documentation states account id and application key are equivalent to login/password and must be kept secret (`reference/api-docs/dearinventory.apib:38`).
- P1: No `.gitignore` or `.env.example` exists, while `.env.local` exists.
- P1: The local database schema and RLS policies are not versioned in the repo.
- P1: `npm audit --omit=dev` reports one high production advisory for `xlsx` and two moderate advisories around PostCSS via Next.
- P2: Current Next.js 16 guidance renames `middleware.ts` to `proxy.ts`; Antigravity logs also show the deprecation warning.
- P2: Some UI controls need stronger accessible names, semantics, and 44px mobile tap targets.

## Research Notes

- Official Next.js docs say Middleware is renamed to Proxy starting in Next.js 16 and provide a codemod for `middleware-to-proxy`.
- Official Supabase SSR docs now show `proxy.ts`, `getClaims`, publishable keys, and cache header handling for `setAll`.
- Official CIN7 Core docs confirm requests need both `api-auth-accountid` and `api-auth-applicationkey`, and those values must be kept secret.

## Key Files

| File | Why It Matters |
|---|---|
| `src/app/page.tsx` | Root auth redirect |
| `src/app/login/page.tsx` | Login flow and first screen |
| `src/app/dashboard/layout.tsx` | Main shell, nav, sign out |
| `src/app/dashboard/page.tsx` | Executive summary composition |
| `src/lib/supabase/middleware.ts` | Auth protection logic |
| `src/lib/supabase/server.ts` | Server Supabase client |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/app/globals.css` | Product design system tokens and primitives |
| `scripts/test-cin7-api.mjs` | CIN7 validation script with current secret and env bug |
| `reference/pbix-extracted/` | Original Power BI metric and layout source |
| `reference/targets/` | Target import source files |
| `README.md` | Product intent and current security exposure |

## Recommended Next Development Slice

Do not apply database changes to the accessible MCP Supabase project. Continue locally by hardening secrets, creating versioned migrations/import scripts for the confirmed KRDM project, fixing the CIN7 test script, migrating `middleware.ts` to `proxy.ts`, removing unstable mock/random data, and implementing the Batch 1 target import plus Customer Analysis page behind real data contracts.
