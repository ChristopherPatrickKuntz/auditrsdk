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

/**
 * Network family for wallet-signature identity binding on the
 * facilitator trial endpoint. `evm` uses EIP-191 `personal_sign`;
 * `svm` uses Solana ed25519 `signMessage`.
 */
export type FacilitatorWalletNetwork = 'evm' | 'svm';

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
   * to 1500000 (25 minutes). Tiers vary widely: quick is ~1-2 min,
   * standard ~5-10 min, and web3 can run 15-20+ min under heavier
   * modules (waymore, katana, nuclei, on-chain posture) — the backend
   * alone allows the web3 site scan up to 1200s before its own timeout.
   * `waitForCompletion` returns as soon as the audit reaches a terminal
   * status, so a generous default only raises the ceiling; pass a
   * smaller `timeoutMs` per call for quick scans if you want to fail fast.
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
  /**
   * CAIP-2 network identifier. The exact value depends on the
   * facilitator the resource server uses. For EVM networks the form
   * is `eip155:<chain-id>` (e.g. `eip155:8453` for Base mainnet,
   * `eip155:84532` for Base Sepolia). For Solana the facilitator
   * typically advertises a value derived from the cluster's genesis
   * hash; do not assume `solana:mainnet`.
   */
  network: string;
  /**
   * Asset contract address (EVM) or mint (Solana). USDC by default
   * across the Auditr API; verify against `extra.name` when present.
   */
  asset?: string;
  /**
   * Settlement recipient. Pay the authorization to this address.
   */
  payTo: string;
  /**
   * Amount in atomic units (NOT a decimal price). USDC has six
   * decimals, so `"1000000"` represents one USDC. Cast to BigInt
   * before passing into a signing helper that expects a uint256.
   */
  amount: string;
  /**
   * Facilitator's hint for how long the authorization should remain
   * valid. Use as the `validBefore` lower bound; the signer is free
   * to pick a tighter window.
   */
  maxTimeoutSeconds?: number;
  description?: string;
  /**
   * Facilitator specific extension. For EIP-3009 EVM accepts this
   * usually carries `{ name: "USDC", version: "2" }` matching the
   * EIP-712 domain. For Solana it may carry a `feePayer`.
   */
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

/** Severity of a recommendation. Backend emits 'informational'. */
export type RecommendationSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'informational'
  | 'info';

/**
 * A structured audit recommendation. The backend returns these as
 * objects (not plain strings). A legacy string recommendation is
 * normalised to `{ title }`.
 */
export interface Recommendation {
  title: string;
  description?: string;
  severity?: RecommendationSeverity;
  /** Concrete next step (code snippet, config change, or action). */
  implementation?: string;
}

export interface AuditReport {
  auditId: string;
  status: AuditStatus;
  grade?: string;
  /**
   * The scan tier this report was produced from (quick / standard /
   * web3), so consumers can interpret depth + module coverage.
   */
  scanProfile?: AuditTier;
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
    recommendations?: Recommendation[];
    /** Maps from backend `grade_justification` (or legacy `grade_rationale`). */
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

export type MonitoringTargetKind = 'contract' | 'token' | 'wallet';

/**
 * Allowed webhook destinations for monitoring alerts. The backend
 * enforces a strict allowlist on the URL host and path to prevent
 * the alert pipeline from being used as an SSRF reflector. Only
 * Discord and Slack incoming webhooks are accepted; other targets
 * are rejected with a 400 at subscription creation time.
 */
export type SupportedWebhookHost =
  | 'discord.com'
  | 'discordapp.com'
  | 'hooks.slack.com';

export interface CreateMonitoringRequest {
  /**
   * The wallet that owns the subscription. Alerts route to this
   * wallet's linked Telegram account when one exists, and the
   * subscription is gated to this wallet on read and delete.
   */
  userWallet: string;
  /**
   * Address of the on chain target to monitor. EVM addresses are
   * `0x` prefixed 40 char hex; Solana addresses are base58.
   */
  contractAddress: string;
  /**
   * Chain the target lives on. Must be in the platform's
   * supported set.
   */
  chain: Chain;
  /**
   * What kind of address `contractAddress` is. Defaults to
   * `contract`. Token and wallet targets use the same monitoring
   * pipeline with different event filters.
   */
  targetKind?: MonitoringTargetKind;
  /**
   * Email to receive alerts in addition to (or instead of) the
   * Telegram channel. The Pro and Enterprise tiers include email.
   */
  notifyEmail?: string;
  /**
   * HTTPS webhook for alert delivery. Must be a canonical Discord
   * (`https://discord.com/api/webhooks/...`) or Slack
   * (`https://hooks.slack.com/services/...`) endpoint. Other hosts
   * are rejected by the API.
   */
  webhookUrl?: string;
  /**
   * Telegram chat id to DM. If the request originates from the
   * Mini App context the SDK transparently uses the verified id
   * from `X-Telegram-Init-Data`; otherwise pass it explicitly.
   */
  telegramChatId?: number;
}

export interface MonitoringSubscription {
  id: string;
  userWallet: string;
  targetAddress: string;
  targetKind: MonitoringTargetKind;
  chain: Chain;
  tier: MonitoringTier;
  intervalMinutes: number;
  delivery: string[];
  active: boolean;
  paidThroughTs?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
  notifyEmail?: string;
  webhookUrl?: string;
}

export interface CreateMonitoringResponse {
  subscription: MonitoringSubscription;
  /**
   * Relative URL that lists all subscriptions for the wallet.
   * Useful for the agent's own bookkeeping; the platform also
   * exposes per subscription routes.
   */
  statusUrl: string;
  /**
   * x402 settlement details when the facilitator returned them.
   */
  settlement?: PaymentSettlement;
}

/**
 * Request body for `POST /api/facilitator/trial`. The trial mints a
 * Bearer token bound to a wallet you control; the wallet signature
 * is verified server-side. The free 25 settles/month are then keyed
 * on this wallet so no one else can claim the address and burn the
 * quota.
 *
 * To produce `signature`, sign the canonical message (verbatim,
 * including newlines and the trailing newline):
 *
 *     Auditr Facilitator Trial Authorization
 *     Wallet:    <walletAddress>
 *     Network:   <walletNetwork>
 *     Timestamp: <timestamp>
 *     Nonce:     <nonce>
 *
 * Use EIP-191 `personal_sign` for EVM, ed25519 `signMessage` for
 * Solana. `timestamp` must be within ±5 minutes of server clock.
 */
export interface FacilitatorTrialRequest {
  /**
   * Display name for our admin UI. Not a secret. Keep it short and
   * recognizable (e.g. "Acme bot fleet").
   */
  label: string;

  /**
   * Off-band contact (email, Telegram, URL) used if we ever need to
   * reach you. Not displayed to other consumers.
   */
  ownerContact: string;

  /**
   * The wallet you control. EVM: 0x-prefixed 40-hex address. Solana:
   * base58 ed25519 pubkey.
   */
  walletAddress: string;

  /**
   * Which signing scheme to verify against — and, importantly, which
   * billing posture the resulting key gets:
   *
   * - `'svm'`: 25 free settlements per month, Solana-only. The
   *   recommended choice for new consumers.
   * - `'evm'`: zero free settlements. Mint an EVM-bound key only if
   *   you intend to `topup()` and settle on Base from a prepaid
   *   balance; the free Solana quota is not transferable.
   */
  walletNetwork: FacilitatorWalletNetwork;

  /** ISO-8601 UTC; must be within ±5 minutes of the server clock. */
  timestamp: string;

  /** 16 bytes of randomness, hex-encoded (32 chars). One-shot. */
  nonce: string;

  /**
   * The signature over the canonical message. EVM: 65-byte hex
   * (`0x...`). Solana: 64-byte base58 or base64.
   */
  signature: string;

  /**
   * Optional comma-separated CAIP-2 network allowlist for this key.
   * Defaults to `'*'` (any network the facilitator advertises).
   */
  networksCsv?: string;
}

/**
 * Request body for `POST /api/x402/facilitator/topup`. The body
 * carries only the key to credit; the payment itself is handled by
 * the SDK's x402 flow.
 */
export interface FacilitatorTopupRequest {
  /** The keyId from a prior `trial()` response. */
  keyId: string;
}

/**
 * Response from `POST /api/facilitator/trial`. The full Bearer
 * `token` is returned ONCE on first mint; if a key already exists
 * for the same wallet the response will set `alreadyExisted: true`
 * and OMIT the `token`. Auditr does not reissue lost tokens; revoke
 * and re-mint with a different wallet if you lose access.
 */
export interface FacilitatorKey {
  /** Short public identifier (8 hex chars). Use as `keyId` later. */
  keyId: string;

  /** Wallet bound to this key's free-tier quota. */
  walletAddress: string | null;

  /** Signing scheme the wallet uses. */
  walletNetwork: FacilitatorWalletNetwork | null;

  /** Free settlements per calendar month under the trial. */
  freeSettlesPerMonth: number;

  /** Current prepaid balance in USDC base units (6 decimals). */
  paidBalanceAtomicUsdc: number;

  /**
   * `true` when this wallet already had a key (the trial endpoint is
   * idempotent on wallet). When `true`, `token` is NOT included.
   */
  alreadyExisted: boolean;

  /**
   * The full Bearer token, returned ONCE. Send as
   * `Authorization: Bearer <token>` to /verify and /settle.
   */
  token?: string;

  /** Public URL of the facilitator. */
  facilitatorUrl: string;

  /** Deep-link to the FAQ integration section. */
  integrationDocs: string;
}

/**
 * Response from `POST /api/x402/facilitator/topup`.
 */
export interface FacilitatorTopupResponse {
  keyId: string;

  /** Settlement tx hash used as the idempotency key. */
  txHash: string;

  /** `true` on first credit; `false` if this tx was already credited. */
  credited: boolean;

  /** Post-credit balance in USDC base units. */
  paidBalanceAtomicUsdc: number;

  /** Convenience: same as above divided by 10^6. */
  paidBalanceUsd: number;

  facilitatorUrl: string;
  integrationDocs: string;
}

/**
 * `GET /admin/info` response (auth-required, Bearer token of the key
 * itself). Use to read remaining balance + free quota before a long
 * run.
 */
export interface FacilitatorAdminInfo {
  ok: true;
  service: 'auditr_facilitator';
  networkMode: 'mainnet' | 'testnet';
  chains: string[];
  billing: {
    /** 25 by default. */
    freeQuotaPerMonth: number;
    /** $10 by default. */
    topupAmountUsd: number;
    /** $10 = 10_000_000. */
    topupAmountAtomicUsdc: number;
    /** Per-settle buffer in USDC base units (default 500 = $0.0005). */
    gasBufferAtomicUsdc: number;
    /** Static breaker ceiling in USDC base units (default 100_000 = $0.10). */
    gasBreakerAtomicUsdc: number;
  };
  auth: {
    keyId: string;
    label: string;
    isInternal: boolean;
    walletAddress: string | null;
    walletNetwork: FacilitatorWalletNetwork | null;
    paidBalanceAtomicUsdc: number;
    freeSettlesUsed: number;
    freeSettlesRemaining: number;
    freePeriodStart: string;
  };
}

/**
 * `GET /supported` response (public).
 */
export interface FacilitatorSupportedKind {
  scheme: string;
  network: string;
  x402Version: number;
}
