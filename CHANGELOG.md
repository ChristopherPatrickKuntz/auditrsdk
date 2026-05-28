# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.1.0] - YYYY-MM-DD

Initial release.

[Unreleased]: https://github.com/auditrxyz/sdk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/auditrxyz/sdk/releases/tag/v0.1.0
