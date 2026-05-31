# Product Hunt Launch Promo — 50% off the Due Diligence report

**Date:** 2026-05-31
**Status:** Design approved pending spec review

## Goal

For the Product Hunt launch, offer **50% off the Due Diligence (DD) report** via a
promo code (`PRODUCTHUNT50`). The discount must apply **only to the DD report**, never
to the Financial Statements (FS / Cuentas Anuales) add-on, because the FS is a
passthrough cost paid to the Registro Mercantil.

## Scope and constraints

- **Public buyers only.** Registered/"waived" users never pay for DD — the backend
  short-circuits them before Stripe (`stripe-handler/src/index.js` lines ~1213–1284).
  The promo only affects the public Stripe checkout path, by construction. No work is
  needed to exclude registered users.
- **Discount applies to DD only**, not the FS add-on.
- **Time-boxed launch promo.** It should be easy to cap and to turn off after launch.
- **No per-email "first N" counting.** Stripe cannot natively enforce "N redemptions
  per email," and it is unnecessary for a launch. Cost is bounded by a global
  redemption cap + expiry instead. (Considered and explicitly rejected: backend
  per-email order counting — too much work for no launch benefit.)

## Chosen approach: `amount_off` Stripe coupon

A fixed-amount Stripe coupon of **−€13.61** (1361 cents EUR), exposed via promotion
code `PRODUCTHUNT50`, surfaced through Stripe's built-in promo-code box on the hosted
checkout page.

### Why this works for "DD only"

The DD line item is **€27.23 gross** (€22.50 net × 1.21 IVA = 2723 cents). Half of that
is €13.61 (1361 cents). The DD line item is **always present** in every order. So a flat
−€13.61 discount on the order total is exactly 50% off the DD, regardless of whether the
FS add-on is included:

- **DD only:** 2723 − 1361 = 1362 cents → ~50% off DD. ✅
- **DD + FS:** (2723 + 2118) − 1361 = 3480 cents → FS full (2118) + DD half (1362). ✅

The FS add-on is never discounted.

### Why `amount_off` instead of `percent_off` + `applies_to.products`

A `percent_off` coupon scoped to a single product requires a **stable Stripe Product ID**
in `coupon.applies_to.products`. The backend currently builds line items with inline
`price_data.product_data` (no stable Product ID), so a percent-scoped coupon would
require restructuring the DD line item to reference a pre-created Product and would drop
the dynamic per-company line description. `amount_off` avoids all of that: it needs no
product scoping and no line-item changes — just enabling the promo-code box.

Trade-off accepted: the coupon is a hardcoded euro amount. If the DD price ever changes,
the coupon amount must be updated. This is irrelevant for a time-boxed launch promo.

## Changes required

### 1. Stripe Dashboard (manual, no code)

- **Coupon:**
  - Type: `amount_off`
  - Amount: **13.61 EUR** (1361 cents)
  - Currency: EUR
  - Duration: `once`
  - Redemption limit (`max_redemptions`): **300** (tune as desired)
  - Redeem-by / expiry: end of launch week
- **Promotion code:**
  - Code: `PRODUCTHUNT50`
  - Linked to the coupon above
  - (Inherits the coupon's cap/expiry; can add its own `expires_at` / `max_redemptions`
    if finer control is wanted.)

### 2. Payments backend — `local-rag` repo

**File:** `/Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler/src/index.js`
**Function:** `handleCreateDDCheckoutSession()` (~line 1160), `sessionParams` object (~lines 1328–1365)

- Add **one line** to `sessionParams`:
  ```js
  allow_promotion_codes: true,
  ```
  Place it alongside `line_items` (~line 1330). Stripe then renders an "Add promo code"
  field on the hosted checkout page, validates `PRODUCTHUNT50`, applies the −€13.61
  discount, and enforces the cap/expiry itself.
- **No line-item restructuring.** DD and FS are already separate line items; the
  `amount_off` approach needs no `applies_to` scoping.
- Deploy the `stripe-handler` worker after the change.

### 3. Frontend — this repo (`mapasocietario`)

**File:** `src/components/DDCheckoutDialog.jsx`

- Add a small launch banner near the top of the dialog content, e.g.:
  > 🚀 Product Hunt launch — enter code **PRODUCTHUNT50** at checkout for **50% off the
  > Due Diligence report**.
- Wording should make clear the discount is on the DD report (not the FS add-on), to set
  correct expectations.
- **No price-calc changes.** The dialog continues to show the full total; the discount is
  entered and confirmed on the Stripe checkout page before payment.

## Trade-offs accepted

- The in-dialog total still shows full price; the discounted total appears on Stripe's
  page after the code is entered. (Chosen for minimal, fast-to-ship work over an in-dialog
  validate/price endpoint.)
- The coupon is a fixed euro amount tied to the current DD price (fine for a time-boxed
  promo).
- Anyone with the code gets the discount up to the global cap (no per-email limit), which
  is the intended, bounded launch behavior.

## Out of scope

- Per-email "first 5" enforcement.
- Auto-apply via `?ref=producthunt` URL param.
- In-dialog discounted-total display / promo validation endpoint.
- Any change to the registered/waived-user path.

## Verification

- Stripe dashboard: confirm coupon `−€13.61 EUR`, code `PRODUCTHUNT50`, cap + expiry set.
- Public checkout, DD only + code: total reflects −€13.61 (50% off DD).
- Public checkout, DD + FS + code: discount is exactly −€13.61; FS billed full.
- Without the code: full price unchanged.
- Registered/waived user: still free, unaffected.
- After expiry / cap reached: code rejected by Stripe; full price charged.
