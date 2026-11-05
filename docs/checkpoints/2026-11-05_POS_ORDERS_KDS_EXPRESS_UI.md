# Gastro Core — Angular POS/Órdenes/Cocina Express UX-R (2026-11-05)

**UI repository:** `CardonaSantos/new-project-angular-ui`
**Feature branch:** `refactor/pos-orders-kds-express-ui-20261105`
**PR:** #28 (DRAFT); base `feat/thermal-receipts-pos-ui-20261104` (PR #27). No merges.
**Backend dependency:** `CardonaSantos/new-project` PR #30, branch `feat/pos-orders-kitchen-express-20261105` (DRAFT), not main. Use matching branches together.
**Business invariant:** server computes money, modifies inventory, records payments and audit, and decides whether order/mesa may close. UI does not fake sale success.

## Implemented UX

### /orders/pos — Express + existing table in same canvas
- Visible catalog with 5 compact cards per row on ordinary desktop widths ≥1300px; adaptive to 4/3/2 cards on smaller screens, fixed cart on wide screens, drawer on mobile.
- No-modifier product selection still adds in one click. Existing modifier modal remains accessible.
- When cart contains only INVENTARIABLE/SERVICIO, mode MOSTRADOR/PARA_LLEVAR and user has `orders.create`+`payments.collect`, primary action becomes **Cobrar ahora**.
- Checkout is a keyboard-operable, focus-trapped dialog with **server quote** (POST /api/orders/quote), live GTQ/USD formatting, cash/card/verified-other method, payment change, cash shift from CashContext. Requires terminal authorization on cards and reference on other. Unverified transfers use standard checkout.
- On confirm, one `POST /api/pos/quick-checkout` with durable `claveOperacion` for identical retries. On failure cart and form remain visible with role=alert and persistent toast. On success response includes Venta real; shows sale receipt print link and Nueva venta.
- Keyboard: F2 or / focuses catalog search; F4 opens quick checkout when eligible; Escape closes only dialogs not currently executing payment.
- Occupied table selection now loads existing order **inside POS** via GET /api/orders/:id. `POST /api/orders/:id/lines` appends only new lines. Do not navigate out of POS. It is blocked until the existing order has loaded to prevent creating a second order on the same occupied table. A confirmation protects unsaved cart when switching table.
- Dedicated links to view existing order or collect its account without losing context. After append, stays on same mesa. Correctly distinguishes newly-created kitchen tickets from historical tickets.
- With prepared products, retains full order/kitchen flow; does not allow quick-close behind the scenes. Existing POS configuration, customer-facing notes and receipt continue unchanged.

### /orders/list — worklist versus historical list
- Defaults to **En curso**: calls `GET /api/orders/worklist`, with true server pagination, branch/mode/search filters, compact cards (up to 5 wide) showing mesa, total, pagado/saldo, pending/preparing/delivery and actions. Mesa's add-products link goes to `/orders/pos?mesaId=...`.
- **Historial** preserves previous paginated list, state filters, actions, links and detail.
- All displayed money uses existing centralized money formatting; no browser-side financial netting.

### /orders/kitchen — true queue and atomic handoff
- GET /api/kitchen/queue with `ACTIVAS`, `PARA_ENTREGAR`, `ENTREGADAS`, `TODAS`, server global FIFO ordering and real counts; separate legacy `CANCELADA` filter remains supported.
- Distinct **Marcar lista** vs **Lista y entregada**. The latter prompts for actual physical handoff, then performs ONE `POST /api/kitchen/tickets/:id/ready-deliver` or `POST /api/kitchen/lines/:id/ready-deliver`, keeping the same operation key if the network fails. No browser loop sending multiple deliver requests.
- Preparation (including partial line) shows a success toast. Global totals are not mistakenly presented as page totals. Polling remains 7s on visible screens with change feed; branch changes discard stale async replies.
- Existing modifier snapshots and notes are unchanged. Ticket thermal printing remains available.

### /payments/order/:id
- Shows **Cobrar y enviar a Cocina** only for orders with unprocessed lines, a single account, no pending transfer and payment covering the full outstanding balance. Uses one `POST /api/orders/:id/pay-and-send`, not separate client calls.
- Partial/transfer/multi-account flows remain in PAY-A; never claim an order is closed while kitchen remains pending. Backend also guards that the full balance was collected before dispatching a pay-before-prepare order.

## API models / tests
- Typed `OrderQuote`, `QuickCheckoutInput`, `QuickCheckoutResult`, `WorkOrder`, `KitchenQueueResponse`, `PayAndSendInput`.
- `orders.api.spec.ts` covers endpoint paths, payload idempotency, server paging/filters, quote and one-request delivery.
- CI must succeed on final head: npm ci, npm run lint, npm run build, npm test -- --watch=false.
- Backend PR #30 must also be green, in particular the paid-and-closed ticket handoff edge case and partial-payment guard.

## Local QA (with BOTH draft branches checked out)
- [ ] Log in to authorized branch with open cash shift; sale a bottle of water (INVENTARIABLE) with exact Q7, only one cash payment; order closed, one stock movement, no KDS ticket, print 80mm sale slip.
- [ ] Sell 2 bottles with Q20 cash, confirm authoritative quote and server-calculated change; verify server receipt and cash movement.
- [ ] Turn closed: quick dialog clearly disables operation and links to opening cash, no API POST.
- [ ] Reject terminal card without authorization, reject transfer in express mode; fallback standard PAY-A.
- [ ] Force stale/invalid price or insufficient stock; UI retains cart, no partial sale or cash movement.
- [ ] Duplicate-click Confirmar and retry same key after network interruption; no duplicate sale, payment, inventory move or event.
- [ ] Switch branches during quick dialog / request: do not show another branch's sale as local success.
- [ ] Select occupied Mesa 1 in POS; see existing order without page redirect; append 2 prepared products and confirm only those lines. Receipt and kitchen ticket should appear according to server.
- [ ] Switch to another mesa with unsaved products; confirmation before discarding, no accidental cross-table changes.
- [ ] /orders/list En curso: compact cards show server saldo and KDS counts, paginación 2+ works, table link directly back to POS; Historial still shows state filters.
- [ ] KDS: Marcar lista leaves product pending physical delivery, not marked Entregada.
- [ ] KDS: Lista y entregada uses a single POST and shows feedback; same idempotency key on retry, no repeated ingredient deduction or event.
- [ ] KDS: already-ready ticket from a paid CLOSED order can be delivered, no new cooking.
- [ ] KDS: >30 pending tickets, verify server-wide FIFO sorting and global counters, not sorted only current page.
- [ ] /payments/order/:id: if it needs dispatch and will be fully paid, show Cobrar y enviar; partial payments stay normal.
- [ ] Verify 390px mobile, tablet, 1366px Firefox desktop/90% zoom, tab order, focus trap, Escape and F2/F4, light/dark Cappuccino and all notices.

## Local commands
Backend (ensure no local uncommitted changes first):
```powershell
git status
git fetch origin
git switch -c feat/pos-orders-kitchen-express-20261105 --track origin/feat/pos-orders-kitchen-express-20261105
npm run start:dev
```
Angular:
```powershell
git status
git fetch origin
git switch -c refactor/pos-orders-kds-express-ui-20261105 --track origin/refactor/pos-orders-kds-express-ui-20261105
npm ci
npm start
```
If local branch already exists, use `git switch <branch>` then `git pull --ff-only origin <branch>` rather than `switch -c`.
Both PRs intentionally remain DRAFT until actual PostgreSQL and visual/touch acceptance.
