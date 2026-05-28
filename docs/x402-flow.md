# x402 Flow

The Auditr API speaks the [x402](https://x402.org) protocol. This
document traces a single paid request from invocation to response so
SDK callers know exactly what is happening on the wire.

## Overview

x402 is HTTP based. A paid resource responds `402 Payment Required`
on the first attempt, carries the price as structured data in
response headers, and accepts a signed authorization on the retry.
A facilitator settles the on chain transfer; the resource server
serves the response only after settlement confirms.

The SDK handles steps 1 through 4 for you. You only see the final
response in step 5.

## Sequence

```
+------------+                  +-----------------+               +------------+
| SDK caller |                  | api.auditr.xyz  |               | facilitator|
+------------+                  +-----------------+               +------------+
       |                                |                                |
  1.   |--------- POST /api/x402/...--->|                                |
       |          (no PAYMENT-SIGNATURE)|                                |
       |                                |                                |
  2.   |<- 402 + PAYMENT-REQUIRED ------|                                |
       |          (base64 challenge)    |                                |
       |                                |                                |
  3.   | sign EIP-3009 authorization    |                                |
       |     locally                    |                                |
       |                                |                                |
  4.   |--------- POST /api/x402/... -->|                                |
       |          + PAYMENT-SIGNATURE   |                                |
       |                                |---- settle ------------------->|
       |                                |<--- settlement receipt --------|
       |                                |                                |
  5.   |<- 201 + AuditResponse ---------|                                |
       |     + PAYMENT-RESPONSE         |                                |
```

## Headers

| Header              | Direction          | Encoding              | Carries                                                |
| ------------------- | ------------------ | --------------------- | ------------------------------------------------------ |
| `PAYMENT-REQUIRED`  | Server -> Client   | base64 JSON           | x402 version, resource description, `accepts` array    |
| `PAYMENT-SIGNATURE` | Client -> Server   | base64 JSON           | Signed EIP-3009 authorization for one `accept` entry  |
| `PAYMENT-RESPONSE`  | Server -> Client   | base64 JSON           | Settlement receipt: tx hash, network, payer            |

## Challenge shape

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://api.auditr.xyz/api/x402/audits/web3",
    "description": "Auditr web3 audit ($25.00)",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x...",
      "price": "25.00"
    }
  ]
}
```

Each `accepts` entry is a network the resource server is willing to
settle on. The caller picks the one the signer can produce an
authorization for.

## Settlement shape

```json
{
  "transaction": "0xdeadbeef...",
  "network": "eip155:8453",
  "payer": "0x..."
}
```

The SDK exposes this as `CreateAuditResponse.settlement`. Use it for
your own bookkeeping. Auditr also persists the transaction on the
audit row.

## Errors

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 402    | First response; carries the challenge                         |
| 201    | Settled and accepted; audit created                           |
| 400    | Malformed body (validation failed)                            |
| 401    | Settlement was attempted but rejected by the facilitator      |
| 409    | Replay (the authorization nonce was already used)             |
| 422    | Authorization parsed but failed verification                  |
| 5xx    | Server or facilitator outage; safe to retry                   |

The SDK maps each to a typed error. See [errors.ts](../src/errors.ts)
for the exact shapes.

## Further reading

- [x402.org](https://x402.org) protocol documentation.
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) on
  transferWithAuthorization.
- The [Coinbase Agent Kit](https://github.com/coinbase/agentkit) for
  a reference signer implementation.
