# Product Hunt Promo (50% off DD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer 50% off the Due Diligence report during the Product Hunt launch via promo code `PRODUCTHUNT50`, applied only to the DD line item (never the Financial Statements add-on).

**Architecture:** A fixed `amount_off` Stripe coupon of −€13.61 (= half the €27.23 gross DD price) exposed through promotion code `PRODUCTHUNT50`. The DD line item is always present, so a flat −€13.61 discount is exactly 50% off the DD and leaves the FS add-on at full price. Enforcement, global cap, and expiry are all handled by Stripe. Code changes are limited to enabling Stripe's promo-code box in the backend and showing a launch banner in the frontend.

**Tech Stack:** Stripe (Checkout Sessions, Coupons, Promotion Codes), Cloudflare Workers (`stripe-handler`, in the `local-rag` repo), React + MUI (`mapasocietario` frontend).

**Repos touched:**
- `mapasocietario` (this repo) — frontend banner.
- `standalone_rag/local-rag/workers/stripe-handler` — backend one-line flag.

**Spec:** `docs/superpowers/specs/2026-05-31-producthunt-promo-design.md`

**Testing note:** This change is Stripe config + a one-line backend flag + a static banner. The `mapasocietario` repo has no test harness, and there is no unit-testable surface for "Stripe shows a promo box." Verification is therefore done in **Stripe test mode** end-to-end (Task 4), not via unit tests.

---

### Task 1: Create the Stripe coupon and promotion code (manual, no code)

Do this in the **Stripe Dashboard**. Do it in **test mode first**, verify in Task 4, then replicate in **live mode** before launch.

**Files:** none (Stripe dashboard).

- [ ] **Step 1: Create the coupon**

In Stripe Dashboard → Product catalog → Coupons → **New**:
- Type: **Amount off** (`amount_off`)
- Amount: **13.61** EUR
- Currency: **EUR**
- Duration: **Once**
- (Optional) ID: `producthunt-dd-50`
- Redemption limits → **Limit the total number of times this coupon can be redeemed**: **300** (tune as desired)
- Redemption limits → **Limit the date range when customers can redeem this coupon** → expires at end of launch week

- [ ] **Step 2: Create the promotion code**

On the coupon you just created → **Add promotion code**:
- Code: `PRODUCTHUNT50`
- (Leave per-code limits unset; it inherits the coupon's cap + expiry.)

- [ ] **Step 3: Note the IDs**

Record the coupon ID and promotion code ID for reference. No code uses them directly (the customer types the code), but keep them for support/debugging.

---

### Task 2: Enable Stripe promo codes in the backend (`local-rag` repo)

**Files:**
- Modify: `/Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler/src/index.js` (inside `handleCreateDDCheckoutSession()`, the `sessionParams` object, ~line 1328)

- [ ] **Step 1: Confirm the current `sessionParams` shape**

Open the file and locate `const sessionParams = {` (~line 1328). Confirm it begins:

```js
const sessionParams = {
  payment_method_types: ['card'],
  line_items: lineItems,
  mode: 'payment',
  success_url: successUrl,
  cancel_url: cancelUrl,
  // ...
};
```

Confirm the DD and FS line items are already separate (DD pushed unconditionally; FS pushed only when `includeFS`), ~lines 1296–1322. No line-item changes are needed.

- [ ] **Step 2: Add `allow_promotion_codes: true`**

Insert the line immediately after `line_items: lineItems,`:

```js
const sessionParams = {
  payment_method_types: ['card'],
  line_items: lineItems,
  allow_promotion_codes: true,
  mode: 'payment',
  success_url: successUrl,
  cancel_url: cancelUrl,
  // ...unchanged...
};
```

- [ ] **Step 3: Deploy the worker**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler
npm run deploy
```

Expected: `wrangler deploy` completes and prints the deployed URL for `stripe-handler` with no errors.

- [ ] **Step 4: Commit (in the local-rag repo)**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/stripe-handler/src/index.js
git commit -m "feat(stripe): enable promotion codes on DD checkout for Product Hunt launch"
```

---

### Task 3: Add the launch banner to the checkout dialog (`mapasocietario`)

**Files:**
- Modify: `/Users/alessandronurnberg/mapasocietario/src/components/DDCheckoutDialog.jsx` (constants ~line 25–27; `DialogContent` opening ~line 191)

- [ ] **Step 1: Add a toggle constant**

After the existing price constants (the `VAT_RATE` line, ~line 27), add:

```js
const VAT_RATE = 0.21;
// Product Hunt launch promo. Set to null after the launch to hide the banner.
const LAUNCH_PROMO_CODE = 'PRODUCTHUNT50';
```

- [ ] **Step 2: Render the banner at the top of the dialog content**

Find the opening of the content section (~line 191):

```jsx
      <DialogContent sx={{ pt: 1 }}>
        {/* Base product */}
```

Insert the banner immediately after `<DialogContent sx={{ pt: 1 }}>` and before the `{/* Base product */}` comment:

```jsx
      <DialogContent sx={{ pt: 1 }}>
        {LAUNCH_PROMO_CODE && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: 'rgba(255,167,38,0.12)',
              border: '1px solid rgba(255,167,38,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>🚀</Typography>
            <Typography variant="caption" sx={{ color: 'warning.light', fontSize: '0.78rem', lineHeight: 1.45 }}>
              <strong>Product Hunt launch:</strong> enter code{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'warning.main', letterSpacing: '0.04em' }}>
                {LAUNCH_PROMO_CODE}
              </Box>{' '}
              at checkout for <strong>50% off the Due Diligence report</strong>.
            </Typography>
          </Box>
        )}
        {/* Base product */}
```

(`Box` and `Typography` are already imported at the top of the file — no new imports.)

- [ ] **Step 3: Build to verify it compiles**

```bash
cd /Users/alessandronurnberg/mapasocietario
npm run build
```

Expected: Vite build succeeds with no errors referencing `DDCheckoutDialog.jsx`.

- [ ] **Step 4: Commit (in the mapasocietario repo)**

```bash
cd /Users/alessandronurnberg/mapasocietario
git add src/components/DDCheckoutDialog.jsx
git commit -m "feat: show Product Hunt 50%-off launch banner in DD checkout dialog"
```

---

### Task 4: End-to-end verification (Stripe test mode)

**Files:** none (manual verification).

Run against the test-mode coupon from Task 1 and the deployed test backend. Use a deploy/preview of the frontend (or local `npm run dev`).

- [ ] **Step 1: DD only, with code**

Open the DD checkout dialog, confirm the launch banner shows `PRODUCTHUNT50`. Proceed to Stripe. Confirm the **"Add promotion code"** field is present. Enter `PRODUCTHUNT50`.
Expected: discount of **−€13.61** applied; new total ≈ **€13.62** (was €27.23). This is ~50% off the DD.

- [ ] **Step 2: DD + FS, with code**

Re-open the dialog, tick **Financial Statements**, proceed to Stripe, enter `PRODUCTHUNT50`.
Expected: discount is still exactly **−€13.61** (not more); total ≈ **€34.80** = FS full (€21.18) + DD half (€13.62). The FS add-on is **not** discounted.

- [ ] **Step 3: No code**

Proceed to Stripe without entering a code.
Expected: full price (€27.23, or €48.41 with FS). Unchanged.

- [ ] **Step 4: Registered/waived user unaffected**

Trigger a DD as a waived user (email in `WAIVED_EMAILS`).
Expected: still free / instant success URL, never routed to Stripe. Promo has no effect on this path.

- [ ] **Step 5: Cap / expiry behavior (spot check)**

Confirm in the Stripe dashboard that the promotion code shows the configured `max_redemptions` (300) and expiry. (Optional) set a temporary test code with `max_redemptions: 1`, redeem once, and confirm a second attempt is rejected with full price charged.

- [ ] **Step 6: Go live**

After test-mode verification passes: recreate the coupon + `PRODUCTHUNT50` promotion code in **live mode** (Task 1 steps, live), and confirm the production `stripe-handler` is deployed with the change (Task 2). Frontend banner deploys via the normal `mapasocietario` deploy process.

---

## Rollback / turn-off

- **Fastest:** in the Stripe dashboard, deactivate (archive) the `PRODUCTHUNT50` promotion code — existing and new checkouts can no longer redeem it. The `allow_promotion_codes: true` flag can safely stay.
- **Hide the banner:** set `LAUNCH_PROMO_CODE = null` in `DDCheckoutDialog.jsx`, rebuild, redeploy.
- The promotion also self-disables at its `expires_at` and once `max_redemptions` is reached.
