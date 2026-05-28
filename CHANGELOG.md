# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ChristopherPatrickKuntz/auditrsdk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ChristopherPatrickKuntz/auditrsdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ChristopherPatrickKuntz/auditrsdk/releases/tag/v0.1.0
