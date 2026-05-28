/**
 * Stable public constants. These mirror the Auditr API tier table and
 * supported networks at the time this SDK version was released. The
 * authoritative source is the live `PAYMENT-REQUIRED` header on a 402
 * response; treat these as defaults for type narrowing and quoting.
 */

import type { AuditTier, MonitoringTier, Chain } from './types.js';

export const DEFAULT_BASE_URL = 'https://api.auditr.xyz';

/**
 * Public URL for the Auditr-hosted x402 facilitator. Use this as the
 * `url` for `HTTPFacilitatorClient` (or its equivalent in other
 * languages). Verify and settle requests must be sent with a Bearer
 * token (mint one via `auditr.facilitator.trial()`; refill the
 * prepaid balance with `auditr.facilitator.topup()`).
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
 * Pricing for the Auditr-hosted x402 facilitator at
 * https://facilitator.auditr.xyz.
 *
 * Pay-as-you-go: each settle debits the actual chain gas cost in
 * USDC from the consumer's prepaid balance. No subscription, no
 * markup. The free trial gives 25 Solana-only settles per month
 * bound to a signed wallet (mint via `auditr.facilitator.trial`).
 * `auditr.facilitator.topup` adds `topUpUsd` to the balance for
 * `topUpAtomicUsdc` atomic credits.
 */
export const FACILITATOR_PRICING = {
  freeSettlesPerMonth: 25,
  topUpUsd: 10,
  topUpAtomicUsdc: 10_000_000,
} as const;

/**
 * Header line of the canonical trial-authorization message. Exported
 * for consumers that want to assemble the message bytes manually.
 * Prefer `buildTrialAuthMessage()` below — it's a byte-exact mirror
 * of the server's verifier, so a successful build guarantees a
 * successful verify.
 */
export const CANONICAL_MESSAGE_HEADER = 'Auditr Facilitator Trial Authorization';

/**
 * Parameters for `buildTrialAuthMessage()`. Mirrors the
 * `FacilitatorTrialRequest` fields that feed into the canonical
 * message body.
 */
export interface BuildTrialAuthMessageArgs {
  /**
   * Your wallet address (EVM 0x-prefixed hex or Solana base58).
   * Use the same casing the server will see when it reconstructs
   * the message; canonicalization happens server-side AFTER
   * verifying the signature against this exact byte sequence.
   */
  walletAddress: string;

  /** `'evm'` or `'svm'`. Selects the signing scheme. */
  walletNetwork: 'evm' | 'svm';

  /** ISO-8601 UTC timestamp; must be within ±5 minutes of server now. */
  timestamp: string;

  /** 16 bytes of randomness as 32 hex chars. One-shot. */
  nonce: string;
}

/**
 * Build the canonical message bytes the trial endpoint verifies your
 * signature against. **Byte-exact mirror** of the server side
 * `canonical_message()` (column-12 label alignment, trailing
 * newline). Sign the returned string verbatim with your wallet's
 * `personal_sign` (EVM) or `signMessage` (Solana), then pass the
 * signature back into `auditr.facilitator.trial(...)`.
 *
 * ```ts
 * const timestamp = new Date().toISOString();
 * const nonce = Array.from(
 *   crypto.getRandomValues(new Uint8Array(16)),
 *   (b) => b.toString(16).padStart(2, '0'),
 * ).join('');
 *
 * const message = buildTrialAuthMessage({
 *   walletAddress: signer.address,
 *   walletNetwork: 'svm',
 *   timestamp, nonce,
 * });
 * const signature = await signer.signMessage(message);
 * ```
 *
 * Using this helper instead of hand-building the string is the
 * difference between "it works" and "spend an hour debugging a
 * single missing space in the Network: label."
 */
export function buildTrialAuthMessage(args: BuildTrialAuthMessageArgs): string {
  // Order, label widths, and trailing newline are all part of the
  // signed payload. DO NOT REFLOW. The server reconstructs this
  // exact byte sequence to verify.
  return (
    `${CANONICAL_MESSAGE_HEADER}\n` +
    `Wallet:    ${args.walletAddress}\n` +
    `Network:   ${args.walletNetwork}\n` +
    `Timestamp: ${args.timestamp}\n` +
    `Nonce:     ${args.nonce}\n`
  );
}
