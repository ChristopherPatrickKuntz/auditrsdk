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

| Method                              | Tier            | Price   |
| ----------------------------------- | --------------- | ------- |
| `auditr.audits.quick(req)`          | Quick site scan | $1 USDC |
| `auditr.audits.standard(req)`       | Standard site scan | $10 USDC |
| `auditr.audits.web3(req)`           | Project audit (site + contract + token + wallets) | $25 USDC |
| `auditr.audits.get(id)`             | Fetch the current report state | Free |
| `auditr.audits.waitForCompletion(id)` | Poll until terminal | Free |

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
