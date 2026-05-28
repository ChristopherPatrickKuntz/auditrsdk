/**
 * Stable public constants. These mirror the Auditr API tier table and
 * supported networks at the time this SDK version was released. The
 * authoritative source is the live `PAYMENT-REQUIRED` header on a 402
 * response; treat these as defaults for type narrowing and quoting.
 */

import type { AuditTier, MonitoringTier, Chain, FacilitatorTier } from './types.js';

export const DEFAULT_BASE_URL = 'https://api.auditr.xyz';

/**
 * Public URL for the Auditr-hosted x402 facilitator. Use this as the
 * `url` for `HTTPFacilitatorClient` (or its equivalent in other
 * languages). Verify and settle requests must be sent with a Bearer
 * token (mint one via `auditr.facilitator.trial()` or
 * `auditr.facilitator.signup()`).
 */
export const DEFAULT_FACILITATOR_URL = 'https://facilitator.auditr.xyz';

export const AUDIT_TIERS = {
  quick: { priceUsd: 1, label: 'Quick site scan' },
  standard: { priceUsd: 10, label: 'Standard site scan' },
  web3: { priceUsd: 25, label: 'Project audit' },
} as const satisfies Record<AuditTier, { priceUsd: number; label: string }>;

export const MONITORING_TIERS = {
  basic: { priceUsdPerMonth: 10, label: 'Basic monitoring' },
  pro: { priceUsdPerMonth: 25, label: 'Pro monitoring' },
  enterprise: { priceUsdPerMonth: 50, label: 'Enterprise monitoring' },
} as const satisfies Record<MonitoringTier, { priceUsdPerMonth: number; label: string }>;

export const SUPPORTED_EVM_CHAINS: readonly Chain[] = [
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
  'bsc',
] as const;

/**
 * CAIP-2 mainnet identifiers for the EVM chains the platform supports.
 * The authoritative source for any given request is the
 * `PAYMENT-REQUIRED` challenge on the 402; use this map only for UI
 * defaults and chain id parsing.
 *
 * Solana is intentionally absent: x402 facilitators advertise Solana
 * accepts using a value derived from the cluster's genesis hash, not
 * a friendly `solana:mainnet` token. Pick the network value from the
 * `accepts` array at request time rather than hardcoding it.
 */
export const SUPPORTED_NETWORKS_CAIP2 = {
  ethereum: 'eip155:1',
  base: 'eip155:8453',
  arbitrum: 'eip155:42161',
  optimism: 'eip155:10',
  polygon: 'eip155:137',
  bsc: 'eip155:56',
} as const;

/**
 * Subscription catalog for the Auditr-hosted x402 facilitator at
 * https://facilitator.auditr.xyz. Each paid tier renews for 30 days.
 *
 * `trial` is free with no expiry; mint via `auditr.facilitator.trial()`
 * (the endpoint is unpaid but IP rate-limited). Paid tiers are minted
 * by paying USDC via x402 on the matching signup endpoint.
 *
 * The audited public x402 contracts make per-settlement fees
 * impossible (the destination is cryptographically bound in the
 * buyer's signature), so this tier price is a flat subscription, not
 * a take rate. There is no per-settlement fee on top.
 *
 * A `floorUsd` floor still applies to every settlement to prevent
 * sub-cent dust attacks that would burn our native gas wallet.
 */
export const FACILITATOR_TIERS = {
  trial: {
    monthlyQuota: 100,
    priceUsdPerMonth: 0,
    label: 'Trial',
    description: 'Free 100 settlements per month. No expiry. No SLA.',
  },
  basic: {
    monthlyQuota: 1_000,
    priceUsdPerMonth: 10,
    label: 'Basic',
    description: '1,000 settlements per month. Best-effort support.',
  },
  pro: {
    monthlyQuota: 10_000,
    priceUsdPerMonth: 50,
    label: 'Pro',
    description: '10,000 settlements per month. 24h response SLA.',
  },
  enterprise: {
    monthlyQuota: 1_000_000,
    priceUsdPerMonth: 500,
    label: 'Enterprise',
    description: '1,000,000 settlements per month. Same-day support, custom networks.',
  },
} as const satisfies Record<
  Exclude<FacilitatorTier, 'unlimited'>,
  { monthlyQuota: number; priceUsdPerMonth: number; label: string; description: string }
>;

/**
 * Per-network minimum settle amount (in USD). Settlements below this
 * floor are rejected by the facilitator with HTTP 400 because the
 * facilitator's native-gas spend would exceed the payment value.
 */
export const FACILITATOR_FLOOR_USD = {
  evm: 0.02,
  solana: 0.005,
} as const;
