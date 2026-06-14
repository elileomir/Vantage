# KRDM CRM

Custom CRM & Sales Intelligence Platform for **Stainless Steel Solutions (Pty) Ltd** (KRDM).
Replaces Power BI + SharePoint with a modern web dashboard powered by CIN7 API + Supabase + AI.

## Repo Structure

```
KRDM Report/
├── app/                          # ← Next.js app (Phase 1 build)
├── scripts/                      # Utility scripts
│   └── test-cin7-api.mjs         # CIN7 API connection tester
├── reference/                    # Source files & documentation (read-only)
│   ├── pbix-extracted/           # Extracted Power BI report
│   │   ├── original.pbix         # Original PBIX file
│   │   ├── DAXQueries/           # 11 DAX query files
│   │   ├── Report/               # Report layout + static resources
│   │   └── DataModel             # Binary data model
│   ├── api-docs/
│   │   └── dearinventory.apib    # CIN7 Core API Blueprint (1.7MB)
│   ├── targets/
│   │   ├── KRDM Sales Target 2025.xlsx
│   │   └── KRDM Sales Target 2026.xlsx
│   ├── holidays/
│   │   └── Holiday Calendar.xlsx # South African public holidays
│   ├── branding/                 # KRDM website crawl data (colors, fonts, logo)
│   └── email-request.md          # Account ID request (completed)
└── README.md
```

## Key Data

| Data | Source | Records |
|------|--------|---------|
| Sales | CIN7 API (`saleList`) | 43,268 |
| Products | CIN7 API (`product`) | 3,735 |
| Customers | CIN7 API (`customer`) | 1,512 |
| Targets 2026 | Excel (SharePoint) | 2,677 rows × 12 months |
| Sales Reps | CIN7 (extracted) | 9 |
| Brands | CIN7 (extracted) | 59 |
| Holidays | Nager.Date API (ZA) | ~13/year |

## CIN7 API Credentials

> [!IMPORTANT]
> CIN7 Account ID and API key values are secrets. They must only be provided through local environment variables and must never be committed to the repo. Previously exposed credentials should be rotated in CIN7 before production sync work continues.

Create `.env.local` from `.env.example` and set:

- `CIN7_ACCOUNT_ID`
- `CIN7_API_KEY`
- `CIN7_BASE_URL`

## Supabase Project

- **Project**: `cbrqfqxwexhoguoazhgh`
- **Dashboard**: https://supabase.com/dashboard/project/cbrqfqxwexhoguoazhgh

## Fiscal Year

March → February (e.g., FY2026 = Mar 2026 – Feb 2027)
