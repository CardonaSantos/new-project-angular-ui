# POS carrito compacto — 2026-11-05

**Branch:** `refactor/pos-orders-kds-express-ui-20261105` (PR UI #28), backend unchanged (`new-project` PR #30).

## Fix
- Cart adds identical variants to the existing line (quantity increments) instead of duplicating rows. Stable line key and serialized payload quantity.
- Merge only when variant ID, currency, displayed unit price, modifier IDs, modifier labels, notes and **zero discount** are identical. Discounted lines remain separate by design to preserve the line discount amount and lifecycle.
- Enforces 100 distinct lines and 999 units/line; helper has pure unit tests.
- Cart shows accurate line total (including quantity and discounts), units and distinct-line count.
- Existing table order is a compact, collapsed summary with an optional item list.
- The aside has a scrollable body and a **separate always-visible action footer**, with estimated amount, errors and send/pay button. Notes are in an optional expander; kitchen processing remains visible.
- On mobile widths <=1180px, checkout remains a bottom drawer; the desktop sticky override no longer breaks it in the 1181-1250px range.

## Kitchen and server invariants
- Bottled water (INVENTARIABLE, no preparation) does **not** create KDS tickets. It belongs in the order and payment receipt; only PREPARADO items appear on kitchen printouts.
- No database records or server logic are modified. Historical orders keep their original separate order lines, as required by audit records.
- Server quote and pricing remain authoritative. No new Prisma migrations.

## Verification
- `npm ci`, `npm run lint`, `npm run build`, `npm test -- --watch=false` in GitHub Actions.
- Manual QA: add two identical water bottles; verify a single cart line with quantity 2 and 20 GTQ, a single order line on new order, stock consumption, receipt, and no water in the kitchen printout.
- Different modifiers, notes or discounts should stay separate; changing qty and adding product still work. Verify 390px / 768px / 1366px with a long cart and existing occupied table.
