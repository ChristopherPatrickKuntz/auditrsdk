/**
 * Public type surface for the Auditr x402 SDK.
 *
 * Types are kept narrow on the response side (parsed and validated by
 * the Zod schemas under `./schema`) and broad on the request side
 * (forward compatible with new fields the API may introduce).
 */

export type AuditrApiVersion = 'v1';

export type AuditTier = 'quick' | 'standard' | 'web3';

export type MonitoringTier = 'basic' | 'pro' | 'enterprise';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Chain =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'bsc'
  | 'solana';

export type PaymentToken = 'USDC';

export type ScanType = 'site' | 'contract' | 'token' | 'wallet';

export interface AuditrClientOptions {
  /**
   * Base URL of the Auditr API. Defaults to `https://api.auditr.xyz`.
   * Override only for internal testing against a non production
   * deployment.
   */
  baseUrl?: string;

  /**
   * Implementation that signs an EIP-3009 transferWithAuthorization
   * for a given PAYMENT-REQUIRED challenge. The SDK passes the
   * decoded challenge and expects a base64-encoded
   * `PAYMENT-SIGNATURE` value back. See the `examples/` directory
   * for adapters using the Coinbase Agent Kit and a manual
   * implementation with viem.
   */
  signer: PaymentSigner;

  /**
   * Default poll interval for `waitForCompletion`. Milliseconds.
   * Defaults to 5000. Server side caching makes faster polling
   * wasteful; values below 2000 may be rate limited.
   */
  pollIntervalMs?: number;

  /**
   * Default timeout for `waitForCompletion`. Milliseconds. Defaults
   * to 600000 (ten minutes). The web3 tier produces an audit in
   * about three minutes in the typical case; the timeout reserves
   * headroom for queue depth.
   */
  defaultTimeoutMs?: number;

  /**
   * Custom `fetch` implementation. Defaults to `globalThis.fetch`.
   * Override to inject tracing headers, swap to undici, or run
   * against a recording fixture in tests.
   */
  fetch?: typeof fetch;

  /**
   * Optional User-Agent string. The SDK appends a version suffix.
   * The default identifies callers as `auditrxyz-sdk-js/<version>`.
   */
  userAgent?: string;
}

export interface PaymentSigner {
  /**
   * Sign a single `PaymentAccept` from the 402 challenge. Return the
   * base64-encoded JSON the API expects in the `PAYMENT-SIGNATURE`
   * header.
   */
  sign(challenge: PaymentRequired, accept: PaymentAccept): Promise<string>;
}

export interface PaymentAccept {
  scheme: 'exact';
  network: string;
  asset?: string;
  payTo: string;
  price: string;
  maxAmountRequired?: string;
  description?: string;
  extra?: Record<string, unknown>;
}

export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentAccept[];
}

export interface PaymentSettlement {
  /**
   * Decoded from the `PAYMENT-RESPONSE` header on the successful
   * retry. The facilitator populates `transaction`, `network`, and
   * `payer` after on chain settlement. Fields beyond these may be
   * added; the SDK preserves unknown keys.
   */
  transaction?: string;
  network?: string;
  payer?: string;
  [key: string]: unknown;
}

export interface CreateAuditRequest {
  scanType: ScanType;
  target: string;
  chain?: Chain;
  language?: 'solidity' | 'vyper' | 'rust';
  /**
   * Optional referral code. The platform credits a percentage of
   * the audit price to the referrer.
   */
  referralCode?: string;
  /**
   * Optional wallet address to associate with the audit when the
   * caller is acting on behalf of another party. Defaults to the
   * payer settled by the x402 facilitator.
   */
  userWallet?: string;
  /**
   * Terms of service acceptance. Required and validated server side.
   */
  tosAccepted?: boolean;
}

export interface CreateAuditResponse {
  auditId: string;
  tier: AuditTier;
  status: AuditStatus;
  priceUsd: number;
  statusUrl: string;
  /**
   * x402 settlement details from the response headers, when the
   * facilitator returned them. May be omitted if the facilitator
   * version does not expose this.
   */
  settlement?: PaymentSettlement;
}

export type AuditStatus =
  | 'created'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'analyzing'
  | 'ai_processing'
  | 'completed'
  | 'failed';

export interface Finding {
  severity: Severity;
  title: string;
  category?: string;
  description?: string;
  recommendation?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  references?: string[];
}

export interface AuditReport {
  auditId: string;
  status: AuditStatus;
  grade?: string;
  projectName?: string;
  createdAt: string;
  completedAt?: string;
  summary?: {
    managementSummary?: string;
    protocolOverview?: string;
    methodology?: string;
    threatModel?: string;
    architectureReview?: string;
    functionalityAnalysis?: string;
    securityAssessment?: string;
    recommendations?: string[];
    gradeRationale?: string;
  };
  severityCounts?: Partial<Record<Severity, number>>;
  findings: Finding[];
}

export interface WaitForCompletionOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  /**
   * Optional AbortSignal. Aborting rejects the promise with an
   * `AbortError`. Useful for caller side cancellation in long
   * lived processes.
   */
  signal?: AbortSignal;
  /**
   * Callback fired on every poll, receiving the latest known
   * status. Use for progress reporting.
   */
  onStatus?(status: AuditStatus): void;
}
