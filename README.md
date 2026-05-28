# @auditrxyz/sdk

[![npm](https://img.shields.io/npm/v/@auditrxyz/sdk.svg)](https://www.npmjs.com/package/@auditrxyz/sdk)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![tests](https://github.com/auditrxyz/sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/auditrxyz/sdk/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@auditrxyz/sdk.svg)](https://nodejs.org)

TypeScript SDK for the [Auditr](https://auditr.xyz) x402 API. Submit
a request, settle the EIP-3009 payment over HTTP 402, receive a
structured Web3 security audit. No API keys. No accounts. No human
review.

## Install

```bash
npm install @auditrxyz/sdk
```

Node 18 or newer. Works in the browser when paired with a wallet
that can sign EIP-3009 typed data.

## Quick start

```ts
import { Auditr } from '@auditrxyz/sdk';
import { mySigner } from './my-signer.js';

const auditr = new Auditr({ signer: mySigner });

const created = await auditr.audits.web3({
  scanType: 'site',
  target: 'https://example.com',
  tosAccepted: true,
});

const report = await auditr.audits.waitForCompletion(created.auditId);

console.log(report.grade, report.severityCounts);
for (const finding of report.findings) {
  console.log(`[${finding.severity}] ${finding.title}`);
}
```

## What the SDK covers

### Audits

| Method                              | Tier            | Price   |
| ----------------------------------- | --------------- | ------- |
| `auditr.audits.quick(req)`          | Quick site scan | $1 USDC |
| `auditr.audits.standard(req)`       | Standard site scan | $10 USDC |
| `auditr.audits.web3(req)`           | Project audit (site + contract + token + wallets) | $25 USDC |
| `auditr.audits.get(id)`             | Fetch the current report state | Free |
| `auditr.audits.waitForCompletion(id)` | Poll until terminal | Free |

### Monitoring

| Method                                | Tier         | Price       |
| ------------------------------------- | ------------ | ----------- |
| `auditr.monitoring.basic(req)`        | Basic        | $10 USDC/mo |
| `auditr.monitoring.pro(req)`          | Pro          | $25 USDC/mo |
| `auditr.monitoring.enterprise(req)`   | Enterprise   | $50 USDC/mo |

### Facilitator API

Run x402 (verify + settle) through our facilitator at
`https://facilitator.auditr.xyz` instead of operating one yourself.
Bearer tokens are minted via the SDK and accepted by any x402-aware
SDK that supports per-endpoint auth headers (the official `x402-py`,
`x402-ts`, Coinbase Agent Kit, etc.).

| Method                                    | Tier         | Price        | Quota |
| ----------------------------------------- | ------------ | ------------ | --------------- |
| `auditr.facilitator.trial(req)`           | Trial        | Free         | 100 / month |
| `auditr.facilitator.signup('basic', req)` | Basic        | $10 USDC/mo  | 1,000 / month |
| `auditr.facilitator.signup('pro', req)`   | Pro          | $50 USDC/mo  | 10,000 / month |
| `auditr.facilitator.signup('enterprise', req)` | Enterprise | $500 USDC/mo | 1,000,000 / month |
| `auditr.facilitator.renew(tier, { keyId })` | Same tier | Same          | +30 days |
| `auditr.facilitator.supported()`          | -            | Free         | Discovery |
| `auditr.facilitator.adminInfo(token)`     | -            | Free         | Usage / quota check |

```ts
// 1. Mint a key (trial = free, signup = pay USDC via x402)
const key = await auditr.facilitator.trial({
  label: 'my bot',
  ownerContact: 'me@example.com',
});

// 2. Wire it into any x402-aware client. Python example using x402-py:
//
//   from x402.http import FacilitatorConfig, HTTPFacilitatorClient
//   from x402.http.facilitator_client_base import CreateHeadersAuthProvider
//
//   bearer = {"Authorization": f"Bearer {token}"}
//   auth = CreateHeadersAuthProvider(
//       lambda: {"verify": bearer, "settle": bearer, "supported": {}}
//   )
//   facilitator = HTTPFacilitatorClient(
//       FacilitatorConfig(url="https://facilitator.auditr.xyz", auth_provider=auth)
//   )
```

The audited public x402 contracts cryptographically bind the
payment destination in the buyer's signature, so we cannot extract a
per-settlement fee. Pricing is a flat monthly subscription only. A
per-network minimum settle floor (`$0.02` EVM / `$0.005` Solana)
prevents sub-cent dust attacks. See
[examples/facilitator-trial.ts](examples/facilitator-trial.ts) and
[examples/facilitator-signup.ts](examples/facilitator-signup.ts) for
working snippets.

The SDK handles the HTTP 402 dance for you. A `POST` to a paid
endpoint without a `PAYMENT-SIGNATURE` header receives a 402 with a
`PAYMENT-REQUIRED` challenge. The SDK decodes the challenge, hands
it to your `PaymentSigner`, and retries with the signed
`PAYMENT-SIGNATURE`. The facilitator settles the payment on chain.
Your code sees only the final result.

## Bring your own signer

The SDK does not bundle a wallet. You supply an implementation of:

```ts
interface PaymentSigner {
  sign(challenge: PaymentRequired, accept: PaymentAccept): Promise<string>;
}
```

The returned string is the base64 value sent in the
`PAYMENT-SIGNATURE` header. The `examples/` directory ships two
reference implementations:

- `examples/coinbase-agent-kit.ts` wraps Coinbase Agent Kit's
  payment helper.
- `examples/manual-eip3009.ts` builds the EIP-3009
  `transferWithAuthorization` from scratch with a viem-compatible
  wallet.

## Validation

Every API response is validated against a Zod schema before being
returned. A mismatch raises `ValidationError` with the underlying
schema failure as `cause`. Import the schema independently if you
need to validate stored or relayed reports:

```ts
import { auditReportSchema } from '@auditrxyz/sdk/schema';

const parsed = auditReportSchema.parse(json);
```

## Errors

| Error                  | When                                              |
| ---------------------- | ------------------------------------------------- |
| `PaymentRequiredError` | Raw 402 surfaced when using low level helpers     |
| `SignerError`          | The `PaymentSigner` threw or returned invalid data |
| `HttpError`            | Non 2xx response from the API                     |
| `TimeoutError`         | `waitForCompletion` exceeded its budget           |
| `ValidationError`      | Response failed schema validation                 |

All extend `AuditrError`.

## Why x402

x402 is a standard HTTP based payment protocol. The audit endpoints
return `402 Payment Required` with structured challenges that a
machine can sign without human intervention. The facilitator settles
the on chain transfer, then your audit runs. Combined with EIP-3009
this is the cheapest known way to bill an autonomous agent without
deploying a smart contract on your side.

See [docs/x402-flow.md](docs/x402-flow.md) for the full request and
response sequence.

## Architecture

The SDK is a thin client. The runtime behavior (analyzer choice,
grading, summary generation) is governed by the Auditr backend. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the boundary the SDK respects.

## Versioning

This package follows semantic versioning. Breaking changes ship in
major releases with at least one prior minor that emits deprecation
warnings.

## Security

See [SECURITY.md](SECURITY.md) for the security policy and
disclosure process.

## License

Apache 2.0. See [LICENSE](LICENSE).
