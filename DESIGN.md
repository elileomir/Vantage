# Design Context: Vantage CRM

## Register

Product UI. The dashboard is for business users reviewing sales performance during work hours on laptops, desktops, and phones. Light mode is appropriate because the app will be used in office and retail operations contexts where printed reports and spreadsheets are familiar.

## Current Design System

- Primary accent: KRDM magenta currently represented as `#a1145c`.
- Surface strategy: warm light neutrals with raised panels, subtle borders, compact navigation, and data visualization color roles.
- Typography: Geist Sans and Geist Mono through Next font loading.
- Motion: Motion-based fade/stagger/count-up effects with reduced-motion overrides in global CSS.
- Icons: Lucide React.

## Design Direction

- Keep the product restrained: tinted neutrals, one strong brand accent, and clear semantic chart colors.
- Prioritize scanability, stable chart/table dimensions, keyboard access, and predictable page structure.
- Use cards only for individual metrics and framed dashboard widgets. Avoid nested card layouts.
- Keep tap targets at least 44px on mobile for icon buttons, filter chips, and menu actions.
- Use data-state, accessible labels, and visible focus states for all interactive controls.

## Known UI Risks To Address

- Dashboard navigation links point to unimplemented routes.
- Filters are local-only and some filter option lists are empty.
- Dashboard values are placeholder/sample values, including random chart data.
- Some controls need stronger accessible names and menu semantics.
- Several components repeat raw hex colors instead of using tokens.
- Recharts emitted zero-size container warnings in Antigravity verification logs.

## Anti-Patterns To Avoid

- Do not add decorative gradient text, glass effects, or one-note dashboard palettes.
- Do not make a marketing landing page before the product workflow is functional.
- Do not hide unfinished pages behind links that appear complete.
- Do not use emoji as UI icons.
