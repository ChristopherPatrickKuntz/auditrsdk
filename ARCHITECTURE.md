# Architecture

This document describes the boundary the SDK respects and the
contract it provides to callers. The runtime behavior of the audit
itself (analyzer selection, severity calibration, grading) is owned
by the Auditr backend and is intentionally out of scope here.

## Trust boundary

```
+-----------------------+         +---------------------------+
| Caller process        |         | api.auditr.xyz            |
|                       |         |                           |
|  +----------------+   |         |   +-------------------+   |
|  | @auditrxyz/sdk |---+--HTTPS--+-->|  x402 middleware  |   |
|  +----------------+   |         |   +-------------------+   |
|         |             |         |              |            |
|  +-----------------+  |         |   +-------------------+   |
|  | PaymentSigner   |  |         |   |  audit pipeline   |   |
|  | (caller owned)  |  |         |   +-------------------+   |
|  +-----------------+  |         |                           |
|         |             |         +---------------------------+
|         v             |
|   wallet / agent kit  |
+-----------------------+
```

The SDK never reads, stores, or transmits caller secrets. The
`PaymentSigner` interface delegates all signing to the caller's
chosen wallet implementation. The SDK only forwards the result.

## Request lifecycle

1. The caller invokes a tier method on `auditr.audits` with a
   `CreateAuditRequest`.
2. The SDK serializes the request and `POST`s it to the
   tier-specific x402 endpoint without a `PAYMENT-SIGNATURE`
   header.
3. The API responds with `402 Payment Required` and a
   `PAYMENT-REQUIRED` header carrying a base64 encoded challenge.
4. The SDK decodes the challenge and invokes the configured
   `PaymentSigner` with it.
5. The signer produces a `PAYMENT-SIGNATURE` value (a base64 encoded
   EIP-3009 transferWithAuthorization or the chain equivalent).
6. The SDK retries the request with the signature attached.
7. The API's x402 middleware validates the authorization, hands it
   to the facilitator for on chain settlement, and on success
   invokes the audit handler.
8. The handler returns a `CreateAuditResponse` containing the
   `auditId`, tier, status, and a `statusUrl` for polling.
9. The caller polls `auditr.audits.get(auditId)` or
   `auditr.audits.waitForCompletion(auditId)` until the audit
   reaches a terminal status (`completed` or `failed`).
10. The final response is the `AuditReport` with summary,
    severity counts, and findings.

## Schema validation

Responses are validated against Zod schemas defined in
`src/schema/`. Validation failures throw `ValidationError` rather
than returning malformed data. Callers that need to validate stored
or relayed reports can import the schemas directly from the
`@auditrxyz/sdk/schema` subpath.

## What the SDK does not do

- Sign transactions. The caller supplies a `PaymentSigner`.
- Choose a network. The signer selects which `PaymentAccept` entry
  to honor.
- Mutate state on chain after the audit completes. The audit
  report is immutable once the API marks the audit `completed`.
- Cache responses. Each `get` call hits the API; the API is
  responsible for its own caching policy.

## Stability

Constants under `./constants.ts` (tiers, prices, supported chains)
mirror the live API at the time of the SDK release. The
authoritative source remains the live `PAYMENT-REQUIRED` challenge
on a 402 response. Treat the constants as documentation, not as
binding contract.
