/**
 * Stable public constants. These mirror the Auditr API tier table and
 * supported networks at the time this SDK version was released. The
 * authoritative source is the live `PAYMENT-REQUIRED` header on a 402
 * response; treat these as defaults for type narrowing and quoting.
 */

import type { AuditTier, MonitoringTier, Chain } from './types.js';

export const DEFAULT_BASE_URL = 'https://api.auditr.xyz';

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
