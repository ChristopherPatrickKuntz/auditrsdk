# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-06-02

Report-contract alignment with the current backend. Audit reports now
parse and expose fields the live API actually returns; previously a
modern report could fail validation or silently drop data.

- **Structured recommendations.** `AuditReport.summary.recommendations`
  is now `Recommendation[]` (`{ title, description?, severity?,
  implementation? }`) instead of `string[]`, matching the backend's
  structured output. A legacy string recommendation is normalised to
  `{ title }`, so old and new reports both parse. New exported types:
  `Recommendation`, `RecommendationSeverity`.
- **`scanProfile`.** `AuditReport.scanProfile` exposes the tier a report
  came from (`quick` / `standard` / `web3`).
- **Grade rationale fix.** The backend field is `grade_justification`;
  the SDK now reads it (falling back to the legacy `grade_rationale`)
  into `summary.gradeRationale`, which previously came back undefined.
- **`waitForCompletion` default timeout raised** 10 min to 25 min and
  the per-tier guidance corrected: web3 scans can run 15-20+ min. The
  call still returns as soon as the audit reaches a terminal status.
- Clean build removes the duplicate sourcemap footer in `dist`.

## [0.3.0] - 2026-05-28

Breaking change to the `auditr.facilitator.*` surface to match the
v0.3 backend rewrite that replaces subscription tiers with
pay-as-you-go gas pass-through billing. Audits and monitoring APIs
are unchanged.

### Breaking

- **Removed**: `auditr.facilitator.signup(tier, req)` and
  `auditr.facilitator.renew(tier, req)`. Subscription tiers are
  gone; usage is metered against a prepaid USDC balance.
- **Removed types**: `FacilitatorTier`, `PaidFacilitatorTier`,
  `FacilitatorSignupRequest`, `FacilitatorRenewRequest`,
  `FacilitatorRenewResponse`.
- **Removed constants**: `FACILITATOR_TIERS`, `FACILITATOR_FLOOR_USD`.
- **`FacilitatorKey` shape changed**: `tier`, `monthlySettleQuota`,
  and `paidThroughAt` removed; `walletAddress`, `walletNetwork`,
  `freeSettlesPerMonth`, `paidBalanceAtomicUsdc`, `alreadyExisted`
  added. `token` is now optional (omitted on `alreadyExisted: true`).
- **`FacilitatorAdminInfo.auth` shape changed**: `tier`,
  `effectiveTier`, `paidThroughAt`, `monthlySettleQuota`,
  `monthlySettleUsed`, `monthlyPeriodStart` removed; `isInternal`,
  `walletAddress`, `walletNetwork`, `paidBalanceAtomicUsdc`,
  `freeSettlesUsed`, `freeSettlesRemaining`, `freePeriodStart`
  added. `feePolicy` block removed; new top-level `billing` block.
- **`auditr.facilitator.trial(request)` request shape changed**:
  now requires `walletAddress`, `walletNetwork`, `timestamp`,
  `nonce`, `signature`. The signature is verified server-side so
  the free 25-settle/month quota is bound to a wallet you control.

### Added

- `auditr.facilitator.topup({ keyId })` pays $10 USDC via x402 and
  credits the key's prepaid balance. Idempotent on the underlying
  settlement tx hash.
- `auditr.facilitator.pricing()` returns the version-baked default
  pricing snapshot (`freeSettlesPerMonth`, `topUpUsd`,
  `topUpAtomicUsdc`); authoritative values come from
  `adminInfo().billing` at runtime.
- `buildTrialAuthMessage({ walletAddress, walletNetwork, timestamp,
  nonce })` builds the canonical trial-authorization message bytes
  the server verifies against. Byte-exact mirror of the server-side
  `canonical_message()` (column-12 label alignment, trailing
  newline). Use this instead of hand-rolling the string; a single
  misplaced space causes a `wallet_signature_invalid` rejection
  that's miserable to debug. Locked in via a golden-bytes vitest.
- Types: `FacilitatorWalletNetwork`, `FacilitatorTrialRequest`,
  `FacilitatorTopupRequest`, `FacilitatorTopupResponse`,
  `BuildTrialAuthMessageArgs`.
- Constants: `FACILITATOR_PRICING`, `CANONICAL_MESSAGE_HEADER` (the
  header line; `buildTrialAuthMessage` builds the whole message).
- New example: `examples/facilitator-topup.ts`; existing
  `examples/facilitator-trial.ts` rewritten to use
  `buildTrialAuthMessage` so the wire format is one function call,
  not five concatenated f-strings.
- `FacilitatorTrialRequest.walletNetwork` TSDoc now spells out that
  `'evm'` keys get zero free settles; the 25/month free quota is
  Solana-only by design and is not transferable.

### Changed

- 13 new vitest cases covering the new request/response shapes,
  topup x402 flow, already-credited replay, wallet-signature
  validation, adminInfo `billing` block, and the
  `buildTrialAuthMessage` golden bytes. 29 tests total, all passing.

### Fixed

- `tsconfig.examples.json` gains a `paths` mapping for
  `@auditrxyz/sdk` and `@auditrxyz/sdk/schema` pointing at
  `src/index.ts` and `src/schema/index.ts`. The legacy examples
  (`basic.ts`, `monitoring.ts`, `coinbase-agent-kit.ts`,
  `manual-eip3009.ts`) import the package by its bare specifier;
  TypeScript's Bundler resolution self-references through the
  package `exports` map to `./dist/index.d.ts`. CI runs
  `typecheck:examples` BEFORE `build`, so the previous config
  failed with `Cannot find module '@auditrxyz/sdk'` on a clean
  checkout. The paths mapping resolves examples to source, no
  build required. Reproduced by removing `dist/` locally and
  rerunning the typecheck; with the fix in place a clean
  prepublish gate passes top to bottom (typecheck + typecheck
  examples + lint + 29 tests + build).

## [0.2.0] - 2026-05-28

First publish to npm. 0.1.0 was never released, so the
contents of this entry are everything shipped to the registry.

### Added

- `auditr.facilitator` namespace for the Auditr-hosted x402
  facilitator at `https://facilitator.auditr.xyz`.
- `facilitator.trial(req)` mints a free Bearer token (100/mo, no
  expiry). Does not invoke the signer.
- `facilitator.signup(tier, req)` pays $10 / $50 / $500 USDC via
  x402 and returns a basic / pro / enterprise key with a 30 day
  paid_through window.
- `facilitator.renew(tier, { keyId })` pushes the paid_through
  forward 30 days; pays the higher tier price to upgrade in the
  same call.
- `facilitator.supported()` discovery probe for the public
  `/supported` endpoint.
- `facilitator.adminInfo(token)` reads a key's tier, quota usage,
  and paid_through window.
- New constants: `DEFAULT_FACILITATOR_URL`, `FACILITATOR_TIERS`,
  `FACILITATOR_FLOOR_USD`.
- New types: `FacilitatorTier`, `PaidFacilitatorTier`,
  `FacilitatorSignupRequest`, `FacilitatorRenewRequest`,
  `FacilitatorKey`, `FacilitatorRenewResponse`,
  `FacilitatorAdminInfo`, `FacilitatorSupportedKind`.
- New examples: `examples/facilitator-trial.ts` and
  `examples/facilitator-signup.ts`.
- `tsconfig.examples.json` plus a `typecheck:examples` npm script
  and CI step so the reference signers under `examples/` are
  guarded against bit-rot. `prepublishOnly` runs both typecheck
  passes.
- 10 new vitest cases (5 facilitator API + 5 review-fix
  coverage): trial validation, parsed shape, signup x402 flow,
  renew validation, `paidPost` 2xx-without-402 happy path,
  malformed 2xx as `ValidationError`, `facilitator.supported`
  happy path + ValidationError on missing `kinds`,
  `facilitator.adminInfo` happy path + bare-token rejection,
  `facilitator.renew` x402 flow. Total: 24 tests, all passing.

### Changed

- `SDK_VERSION` (used in the `User-Agent` header) is now inlined
  at build time from `package.json` via tsup `define`, so it can
  no longer drift from the package version. Vitest is configured
  with the same define so unit tests see the real version too.
- `PaymentRequiredError`'s TSDoc no longer references a
  nonexistent `client.http.raw()` method; the doc now describes it
  as an internal flow control signal that consumers only see if
  they reach into the `@internal` helpers directly. README error
  table updated to match.
- `paidPost` now accepts an optional `AbortSignal` and forwards it
  to both the challenge and signed-retry `fetch` calls. Callers
  using the high-level methods (`audits.*`, `monitoring.*`,
  `facilitator.signup`, `facilitator.renew`) pick this up
  automatically when an internal API adds signal threading.
- A malformed JSON body returned from the unusual "2xx without a
  402" branch of `paidPost` now surfaces as a `ValidationError`
  instead of a bare `SyntaxError`, matching the wrapping every
  other JSON parse site already does.

## [0.1.0]

### Added

- Initial public release of the `Auditr` client.
- `audits.quick`, `audits.standard`, and `audits.web3` paid creators.
- `audits.get` and `audits.waitForCompletion` poll helpers.
- Typed error hierarchy: `AuditrError`, `PaymentRequiredError`,
  `SignerError`, `HttpError`, `TimeoutError`, `ValidationError`.
- Zod schemas exported under `@auditrxyz/sdk/schema`.
- Reference signers under `examples/` for the Coinbase Agent Kit
  and a manual viem implementation.
- TSDoc on the entire public surface.

[Unreleased]: https://github.com/ChristopherPatrickKuntz/auditrsdk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ChristopherPatrickKuntz/auditrsdk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ChristopherPatrickKuntz/auditrsdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ChristopherPatrickKuntz/auditrsdk/releases/tag/v0.1.0
