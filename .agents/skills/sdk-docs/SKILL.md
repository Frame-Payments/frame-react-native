---
name: sdk-docs
description: How to author TSDoc comments on public exports in frame-react-native. Loaded automatically when an agent is writing or editing TSDoc in this repo.
---

# frame-react-native — TSDoc authoring

TSDoc on public exports is the source of truth for `docs.framepayments.com/api-reference/integrations/frame-react-native/`. A generator in `frame-docs` reads these comments on every SDK release.

## Central standards (read first)

Cross-SDK style, terminology, and naming live in `frame-docs/lib/sdk-docs-standards/`. They override anything in this file.

1. **Local first** — if `~/Development/frame-docs/lib/sdk-docs-standards/` exists, read from there.
2. **GitHub fallback** — otherwise fetch from `https://github.com/Frame-Payments/frame-docs/tree/main/lib/sdk-docs-standards/` (requires `gh` auth; the repo is private).
3. **If absent** — those documents don't exist yet. Use this file as the baseline until they do.

## Public surface

The public API is the set of symbols re-exported from `src/index.ts`. Every public export there requires TSDoc on the symbol at its definition site. The modules that contribute to the barrel are:

* `src/native.tsx` — `initialize`, `presentCheckout`, `presentCart`, `presentOnboarding`, `presentApplePay`, `presentGooglePay` and their option types (`PresentCheckoutOptions`, `PresentCartOptions`, `PresentOnboardingOptions`)
* `src/types.ts` — shared option-bag types
* `src/errors.ts` — `ErrorCodes`, `FrameErrorShape`, `FrameErrorCode`
* `src/ui/FrameProvider.tsx` — `FrameProvider`, `FrameProviderProps`
* `src/ui/theme/` — `useFrameTheme`, `resolveTheme`, `ResolvedFrameTheme`, `ColorScheme`
* `src/ui/primitives/` — `Button`, `ValidatedTextField`, `ApplePayButton`, `GooglePayButton` and their prop types
* `src/validation.ts` — the validator functions and `Validators` namespace
* `src/countries.ts`, `src/currency.ts` — the public helper exports
* `src/evervault.ts` — `configureEvervault`, `encryptWithEvervault`, `isEvervaultConfigured`
* `src/attestation.ts` — `ensureAttested`, `generateAssertionForPayment`, `getAttestedKeyId`, `isAttestationSupported`, `resetAttestation`

Internal modules (`client.ts`, `config.ts`, `api-errors.ts`, `applePay.ts`, `googlePay.ts`, `camera.ts`, `ipAddress.ts`, `plaid.ts`, `prove.ts`, `debug/`, `presenter/`) are not part of the public surface. If a public symbol references an internal-only type that surfaces in the rendered docs, tag the type `@internal` rather than documenting it.

If you add a new public export, re-export it from `src/index.ts` so TypeDoc picks it up.

## Required tags

* **Summary** — one sentence, active voice, second person, what the symbol does from the integrating developer's perspective.
* **`@param`** — every parameter. For inline option objects, document each property.
* **`@returns`** — what the caller gets, including Promise shape.
* **`@example`** — at least one, using realistic merchant-side calling code (React Native components shown in JSX where appropriate).
* **`@throws`** — every error class or rejection reason the function can produce (see `src/errors.ts`).

## Optional tags

* **`@see`** — link related symbols. Use `{@link symbolName}` syntax.
* **`@remarks`** — context that doesn't fit the summary (native-bridge constraints, iOS/Android differences, threading).
* **`@deprecated`** — when retiring, include migration guidance inline.
* **`@internal`** — exclude a symbol from generated docs even if it's TypeScript-public.

## Voice and terminology (baseline; central standards override)

* Active voice, second person. "Present the checkout sheet." Not "The checkout sheet is presented."
* **Merchant** = the integrating app developer. **Customer** = the merchant's end user.
* **Card** (not "credit card" — debit is supported).
* **Publishable key** for `pk_...`, **secret key** for `sk_...`, **client secret** for `ci_...` (charge-intent secret) or `onb_sess_...` (onboarding-session secret).
* Examples use `pk_sandbox_...` / `sk_sandbox_...`, never live keys.
* RN-specific: call out iOS / Android divergence when behavior differs. Use `@remarks` for platform notes.

## Example

```tsx
/**
 * Presents the native checkout sheet for the given cart. Resolves when the user
 * completes or cancels payment.
 *
 * @param options - Checkout options.
 * @param options.items - Line items to display in the cart.
 * @param options.clientSecret - Short-lived token from the merchant's
 *   `POST /charge-intents`. Always starts with `ci_`.
 * @returns The payment result on completion.
 * @throws {FrameErrorShape} If `initialize` has not been called first, or the
 *   user cancels the sheet.
 * @example
 * ```tsx
 * await initialize({ publishableKey: 'pk_sandbox_...' });
 *
 * const result = await presentCheckout({
 *   items: [{ name: 'T-shirt', amount: 2500 }],
 *   clientSecret,
 * });
 *
 * if (result.status === 'succeeded') {
 *   // payment complete
 * }
 * ```
 * @remarks On iOS the sheet uses ApplePayPresentationContext; on Android it
 *   uses a bottom sheet. Both block the JS thread until dismissed.
 * @see {@link initialize}
 * @see {@link presentCart}
 */
```
