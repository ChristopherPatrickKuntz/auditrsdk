# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-28

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
- 5 new vitest cases covering trial validation, parsed shape,
  signup x402 flow, renew validation. Total: 17 tests passing.

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

[Unreleased]: https://github.com/auditrxyz/sdk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/auditrxyz/sdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/auditrxyz/sdk/releases/tag/v0.1.0
