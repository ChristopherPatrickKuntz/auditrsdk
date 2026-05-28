/**
 * @auditrxyz/sdk
 *
 * TypeScript SDK for the Auditr x402 API.
 *
 * Auditr exposes every paid audit, monitoring, and wallet-scan SKU at
 * the standard HTTP 402 surface. A caller submits a request without
 * payment, receives a 402 with a PAYMENT-REQUIRED header describing
 * the price and accepted networks, signs an EIP-3009
 * transferWithAuthorization, and retries with the PAYMENT-SIGNATURE
 * header. The facilitator settles on chain. The audit runs. The
 * caller polls the free status endpoint until completion.
 *
 * The SDK is unopinionated about how the EIP-3009 signing happens.
 * Pass in a `PaymentSigner` that can produce a base64-encoded
 * authorization for a given PaymentRequired challenge. Use the
 * Coinbase Agent Kit, the official x402 reference signer, or any
 * implementation that produces a valid signed authorization.
 */

export { Auditr } from './client.js';

export type {
  AuditrClientOptions,
  AuditrApiVersion,
  PaymentSigner,
  PaymentRequired,
  PaymentAccept,
  PaymentSettlement,
  AuditTier,
  MonitoringTier,
  MonitoringTargetKind,
  FacilitatorTier,
  PaidFacilitatorTier,
  FacilitatorSignupRequest,
  FacilitatorRenewRequest,
  FacilitatorKey,
  FacilitatorRenewResponse,
  FacilitatorAdminInfo,
  FacilitatorSupportedKind,
  CreateAuditRequest,
  CreateAuditResponse,
  CreateMonitoringRequest,
  CreateMonitoringResponse,
  MonitoringSubscription,
  AuditStatus,
  AuditReport,
  Finding,
  Severity,
  Chain,
  PaymentToken,
  ScanType,
  SupportedWebhookHost,
} from './types.js';

export {
  AuditrError,
  PaymentRequiredError,
  SignerError,
  HttpError,
  TimeoutError,
  ValidationError,
} from './errors.js';

export {
  AUDIT_TIERS,
  MONITORING_TIERS,
  FACILITATOR_TIERS,
  FACILITATOR_FLOOR_USD,
  SUPPORTED_EVM_CHAINS,
  SUPPORTED_NETWORKS_CAIP2,
  DEFAULT_BASE_URL,
  DEFAULT_FACILITATOR_URL,
} from './constants.js';
