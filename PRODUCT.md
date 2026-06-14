# Product Context: Vantage CRM

## Product

Vantage CRM is a sales intelligence and CRM dashboard for KRDM / Stainless Steel Solutions. It is intended to replace the current Power BI and SharePoint reporting workflow with a responsive web app backed by CIN7 Core data, Supabase, target management, and later AI-assisted insights.

## Audience

- KRDM leadership and sales managers who need executive sales performance, target achievement, and customer/brand analysis.
- Sales representatives who need filtered performance views and target visibility.
- Administrators who will manage target imports, user access, and future automation settings.

## Current Build State

- Next.js App Router application with Supabase email/password auth, login screen, protected dashboard shell, and an executive summary dashboard.
- Current dashboard widgets use placeholder/sample data and do not yet read from Supabase.
- Sidebar navigation includes several planned pages that are not implemented yet.
- Antigravity task history identifies Batch 1 as the active unfinished development batch: target Excel import, SQL dashboard views, and Customer Analysis page.

## Product Register

Product register. Design serves operational analysis and repeated dashboard use, so the UI should stay dense, calm, legible, and data-first rather than marketing-oriented.

## Immediate Product Priorities

1. Remove and rotate exposed CIN7 credentials before expanding integration work.
2. Establish a safe local data layer plan for the correct Supabase project.
3. Import target workbook data into a validated shape.
4. Replace placeholder dashboard data with stable Supabase-backed calculations.
5. Build the Customer Analysis page against the same filter and data model.

## Out Of Scope For The Next Batch

- Multi-tenant SaaS architecture.
- Gemini AI, n8n, WhatsApp, automated reports, and pricing tier implementation.
- Native mobile apps.
- Applying database changes to any Supabase project that is not confirmed as the KRDM project.
