# Tiers

The Auditr API exposes three audit tiers and three monitoring
subscription tiers. Prices below mirror the live API at the time of
this SDK release. The authoritative source for any given request is
the `PAYMENT-REQUIRED` challenge on the 402 response.

## Audit tiers

| Tier       | Price    | Scope                                                                       |
| ---------- | -------- | --------------------------------------------------------------------------- |
| `quick`    | $1 USDC  | Site scan. Headers, TLS, source maps, sensitive paths.                      |
| `standard` | $10 USDC | Site scan plus fingerprint, WAF detection, historical secrets, deeper paths. |
| `web3`     | $25 USDC | Project audit. Site plus smart contract plus token rug check plus wallet scans. |

Invoke with:

```ts
await auditr.audits.quick({ scanType: 'site', target: 'https://example.com', tosAccepted: true });
await auditr.audits.standard({ scanType: 'site', target: 'https://example.com', tosAccepted: true });
await auditr.audits.web3({ scanType: 'site', target: 'https://example.com', tosAccepted: true });
```

For contract scans on the `web3` tier, pass `scanType: 'contract'`,
`chain`, and `language`. Upload the source separately via the
authenticated upload route after creation.

## Monitoring tiers

Monitoring is a recurring subscription that watches an on chain
target and delivers alerts when ownership, proxy implementation, or
pause state changes.

| Tier         | Price (per month) | Targets   | Check cadence | Delivery channels                       |
| ------------ | ----------------- | --------- | ------------- | --------------------------------------- |
| `basic`      | $10 USDC          | 1         | Every 24 h    | Telegram                                |
| `pro`        | $25 USDC          | 5         | Every 1 h     | Telegram, email                         |
| `enterprise` | $50 USDC          | Unlimited | Every 15 min  | Telegram, email, Discord, Slack         |

This SDK release covers audits only. A future minor will add
`auditr.monitoring.<tier>()` methods.

## Network coverage

Audits and monitoring settle in USDC across:

- Ethereum
- Base
- Arbitrum
- Optimism
- Polygon
- BSC
- Solana

The `accepts` array on the 402 challenge advertises which networks
the facilitator can settle for a given request.
