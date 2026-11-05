# Gastro Core — Compact POS/Mesas, Detalle y Cobros (2026-11-05)

**Angular PR #28, branch:** `refactor/pos-orders-kds-express-ui-20261105`.

## Changes
- POS mesa picker: horizontal compact and horizontally scrollable table buttons with room, occupancy state, search, refresh and direct link to table dashboard. No API changes.
- POS selected existing order: direct **Imprimir comanda** points to the latest non-cancelled kitchen ticket of that order, subject to `canKitchenRead()`. New orders with no ticket do not show an invalid print action; after creating the order the existing confirmation panel displays the newly generated print link.
- Detail: most recent non-cancelled ticket printing moved to the order header. Remaining tickets stay discoverable behind a collapsed summary. Summary metrics and products are denser without hiding edit/cancellation or payments.
- Payments: removes redundant large selected-account balance for single-account orders; the due amount remains visible in the summary. For split accounts the current account balance remains visible. Product list in cashier sidebar is collapsed by default; total always visible. Method, amount, cash received, validation errors and submit remain unhidden and usable, with smaller paddings.
- Responsive table strip and touch-safe button sizes preserved. No backend/Prisma changes.

## Manual UAT
- Open a branch with 2+ occupied mesas, verify compact strip scroll and fast existing-order retrieval, and add new items to the correct mesa.
- Confirm **Imprimir comanda** appears only for a ticket with kitchen read permission; verify kitchen ticket print route and newly created order post-save print.
- Test order with multiple tickets and cancelled-only tickets.
- Cashier: single account due equals summary, partial payment, split account and transfer/other payment still function. Check cash total and browser mobile 390px / tablet 768px / desktop 1366px.
- GitHub Actions: lint, build, tests on the PR head.
