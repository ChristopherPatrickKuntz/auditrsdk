/**
 * `Auditr` client. The single public entry point of the SDK.
 *
 * ```ts
 * import { Auditr } from '@auditrxyz/sdk';
 *
 * const auditr = new Auditr({ signer: myX402Signer });
 *
 * const created = await auditr.audits.web3({
 *   scanType: 'site',
 *   target: 'https://example.com',
 *   tosAccepted: true,
 * });
 *
 * const report = await auditr.audits.waitForCompletion(created.auditId);
 * console.log(report.grade, report.findings.length);
 * ```
 */

import { DEFAULT_BASE_URL, DEFAULT_FACILITATOR_URL } from './constants.js';
import { ValidationError, TimeoutError, SignerError, HttpError, PaymentRequiredError } from './errors.js';
import {
  auditReportSchema,
  createAuditResponseSchema,
  createMonitoringResponseSchema,
} from './schema/index.js';
import type {
  AuditrClientOptions,
  AuditTier,
  CreateAuditRequest,
  CreateAuditResponse,
  AuditReport,
  AuditStatus,
  WaitForCompletionOptions,
  PaymentSigner,
  PaymentRequired,
  MonitoringTier,
  CreateMonitoringRequest,
  CreateMonitoringResponse,
  FacilitatorAdminInfo,
  FacilitatorKey,
  FacilitatorRenewRequest,
  FacilitatorRenewResponse,
  FacilitatorSignupRequest,
  FacilitatorSupportedKind,
  PaidFacilitatorTier,
} from './types.js';
import {
  assertOk,
  buildUserAgent,
  parsePaymentSettlement,
  readBodyTruncated,
} from './http.js';

type ParsedSettlement = ReturnType<typeof parsePaymentSettlement>;

const TERMINAL_STATUSES: ReadonlySet<AuditStatus> = new Set([
  'completed',
  'failed',
]);

export class Auditr {
  private readonly baseUrl: string;
  private readonly signer: PaymentSigner;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly defaultPollIntervalMs: number;
  private readonly userAgent: string;

  /** Audit operations. See `audits.quick`, `audits.standard`, `audits.web3`. */
  public readonly audits: AuditsApi;

  /** Monitoring operations. See `monitoring.basic`, `monitoring.pro`, `monitoring.enterprise`. */
  public readonly monitoring: MonitoringApi;

  /**
   * Facilitator-API operations. Provision and renew Bearer tokens for
   * the Auditr-hosted x402 facilitator at
   * `https://facilitator.auditr.xyz`.
   */
  public readonly facilitator: FacilitatorApi;

  constructor(options: AuditrClientOptions) {
    if (!options || !options.signer) {
      throw new ValidationError(
        'Auditr requires a `signer` option implementing the PaymentSigner interface',
        null,
      );
    }
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.signer = options.signer;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') {
      throw new ValidationError(
        'No global `fetch` is available; pass `fetch` in options (e.g. node-fetch or undici).',
        null,
      );
    }
    this.defaultPollIntervalMs = options.pollIntervalMs ?? 5_000;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 600_000;
    this.userAgent = buildUserAgent(options.userAgent);

    this.audits = new AuditsApi(this);
    this.monitoring = new MonitoringApi(this);
    this.facilitator = new FacilitatorApi(this);
  }

  /** @internal */
  async freePost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': this.userAgent,
      },
      body: JSON.stringify(body),
      signal,
    });
    const raw = await readBodyTruncated(response);
    if (!response.ok) {
      throw new HttpError(response.status, raw, response.headers);
    }
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      throw new ValidationError('Response body is not valid JSON', e);
    }
  }

  /** @internal */
  async paidPost<T>(path: string, body: unknown): Promise<{ response: T; settlement?: ReturnType<typeof parsePaymentSettlement> }> {
    const url = `${this.baseUrl}${path}`;
    const baseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': this.userAgent,
    };

    // Step 1: unsigned request to elicit the 402 challenge.
    const initial = await this.fetchImpl(url, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(body),
    });

    let challenge: PaymentRequired;
    try {
      const initialBody = await readBodyTruncated(initial);
      assertOk(initial, initialBody);
      // Endpoint settled without payment; unusual but valid for a
      // promotional or pre paid resource.
      return { response: JSON.parse(initialBody) as T };
    } catch (err) {
      if (!(err instanceof PaymentRequiredError)) {
        throw err;
      }
      challenge = err.challenge;
    }

    // Step 2: signer produces the PAYMENT-SIGNATURE for one accept.
    // We pick the first network in the accepts list; sophisticated
    // signers can inspect `challenge.accepts` to choose differently
    // by overriding `sign`. The validation that the list is non
    // empty stays outside the catch so the resulting ValidationError
    // is not masked as a SignerError.
    const accept = challenge.accepts[0];
    if (!accept) {
      throw new ValidationError('PAYMENT-REQUIRED.accepts is empty', null);
    }
    let signature: string;
    try {
      signature = await this.signer.sign(challenge, accept);
    } catch (err) {
      throw new SignerError('Signer failed to produce PAYMENT-SIGNATURE', err);
    }
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new SignerError('Signer returned an empty PAYMENT-SIGNATURE', null);
    }

    // Step 3: retry with the signed header.
    const retry = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'payment-signature': signature,
      },
      body: JSON.stringify(body),
    });

    const retryBody = await readBodyTruncated(retry);
    assertOk(retry, retryBody);

    const settlement = parsePaymentSettlement(
      retry.headers.get('payment-response'),
    );

    let parsed: T;
    try {
      parsed = JSON.parse(retryBody) as T;
    } catch (e) {
      throw new ValidationError('Settled response body is not valid JSON', e);
    }
    return { response: parsed, settlement };
  }

  /** @internal */
  async freeGet<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': this.userAgent,
      },
      signal,
    });
    const body = await readBodyTruncated(response);
    if (!response.ok) {
      throw new HttpError(response.status, body, response.headers);
    }
    try {
      return JSON.parse(body) as T;
    } catch (e) {
      throw new ValidationError('Response body is not valid JSON', e);
    }
  }

  /**
   * @internal
   * Fetch an absolute URL (not a path under `baseUrl`) and return
   * parsed JSON. Used by FacilitatorApi.supported and .adminInfo,
   * which hit the facilitator host directly rather than auditr-api.
   */
  async externalGetJson(absoluteUrl: string, headers: Record<string, string> = {}): Promise<unknown> {
    const response = await this.fetchImpl(absoluteUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': this.userAgent,
        ...headers,
      },
    });
    const body = await readBodyTruncated(response);
    if (!response.ok) {
      throw new HttpError(response.status, body, response.headers);
    }
    try {
      return JSON.parse(body) as unknown;
    } catch (e) {
      throw new ValidationError('External response body is not valid JSON', e);
    }
  }

  /** @internal */
  get config(): {
    defaultPollIntervalMs: number;
    defaultTimeoutMs: number;
  } {
    return {
      defaultPollIntervalMs: this.defaultPollIntervalMs,
      defaultTimeoutMs: this.defaultTimeoutMs,
    };
  }
}

class AuditsApi {
  constructor(private readonly parent: Auditr) {}

  /** Create + pay for a quick site scan. $1 USDC. */
  quick(request: CreateAuditRequest): Promise<CreateAuditResponse> {
    return this.create('quick', request);
  }

  /** Create + pay for a standard site scan. $10 USDC. */
  standard(request: CreateAuditRequest): Promise<CreateAuditResponse> {
    return this.create('standard', request);
  }

  /** Create + pay for a project audit (site + contract + token + wallets). $25 USDC. */
  web3(request: CreateAuditRequest): Promise<CreateAuditResponse> {
    return this.create('web3', request);
  }

  /**
   * Fetch the current state of an audit. The endpoint is unpaid; the
   * audit id is the access token, so possession of the id alone is
   * enough to read the report.
   */
  async get(auditId: string, signal?: AbortSignal): Promise<AuditReport> {
    if (!auditId) {
      throw new ValidationError('auditId is required', null);
    }
    const raw = await this.parent.freeGet<unknown>(
      `/api/x402/audits/${encodeURIComponent(auditId)}`,
      signal,
    );
    return parseAuditReport(raw);
  }

  /**
   * Poll `get` until the audit reaches a terminal status
   * (`completed` or `failed`). Resolves with the final report;
   * rejects with `TimeoutError` if `timeoutMs` elapses.
   */
  async waitForCompletion(
    auditId: string,
    options: WaitForCompletionOptions = {},
  ): Promise<AuditReport> {
    const pollIntervalMs = options.pollIntervalMs ?? this.parent.config.defaultPollIntervalMs;
    const timeoutMs = options.timeoutMs ?? this.parent.config.defaultTimeoutMs;
    const start = Date.now();
    // Poll until terminal status or timeout. Bounded by timeoutMs
    // below; the explicit `for (;;)` is the conventional way to
    // satisfy strict lints that reject `while (true)`.
    for (;;) {
      const report = await this.get(auditId, options.signal);
      if (options.onStatus) {
        options.onStatus(report.status);
      }
      if (TERMINAL_STATUSES.has(report.status)) {
        return report;
      }
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        throw new TimeoutError(elapsed);
      }
      await sleep(pollIntervalMs, options.signal);
    }
  }

  private async create(
    tier: AuditTier,
    request: CreateAuditRequest,
  ): Promise<CreateAuditResponse> {
    const body = {
      scan_type: request.scanType,
      target: request.target,
      chain: request.chain,
      language: request.language,
      tos_accepted: request.tosAccepted ?? true,
      referral_code: request.referralCode,
      user_wallet: request.userWallet,
    };
    const { response, settlement } = await this.parent.paidPost<unknown>(
      `/api/x402/audits/${tier}`,
      body,
    );
    const parsed = parseCreateAuditResponse(response, tier);
    if (settlement) {
      parsed.settlement = settlement;
    }
    return parsed;
  }
}

class MonitoringApi {
  constructor(private readonly parent: Auditr) {}

  /** Create + pay for a basic monitoring subscription. $10 USDC per month. */
  basic(request: CreateMonitoringRequest): Promise<CreateMonitoringResponse> {
    return this.create('basic', request);
  }

  /** Create + pay for a pro monitoring subscription. $25 USDC per month. */
  pro(request: CreateMonitoringRequest): Promise<CreateMonitoringResponse> {
    return this.create('pro', request);
  }

  /** Create + pay for an enterprise monitoring subscription. $50 USDC per month. */
  enterprise(request: CreateMonitoringRequest): Promise<CreateMonitoringResponse> {
    return this.create('enterprise', request);
  }

  private async create(
    tier: MonitoringTier,
    request: CreateMonitoringRequest,
  ): Promise<CreateMonitoringResponse> {
    if (!request.userWallet || !request.contractAddress || !request.chain) {
      throw new ValidationError(
        'monitoring requires userWallet, contractAddress, and chain',
        null,
      );
    }
    const body = {
      user_wallet: request.userWallet,
      contract_address: request.contractAddress,
      chain: request.chain,
      target_kind: request.targetKind ?? 'contract',
      notify_email: request.notifyEmail,
      webhook_url: request.webhookUrl,
      telegram_chat_id: request.telegramChatId,
    };
    const { response, settlement } = await this.parent.paidPost<unknown>(
      `/api/x402/monitoring/${tier}`,
      body,
    );
    return parseCreateMonitoringResponse(response, settlement);
  }
}

function parseCreateMonitoringResponse(
  raw: unknown,
  settlement: ParsedSettlement,
): CreateMonitoringResponse {
  const result = createMonitoringResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Create monitoring response failed schema validation', result.error);
  }
  const sub = result.data.subscription;
  return {
    subscription: {
      id: sub.id,
      userWallet: sub.user_wallet,
      targetAddress: sub.target_address,
      targetKind: sub.target_kind,
      chain: sub.chain as CreateMonitoringResponse['subscription']['chain'],
      tier: sub.tier,
      intervalMinutes: sub.interval_minutes,
      delivery: sub.delivery,
      active: sub.active,
      paidThroughTs: sub.paid_through_ts ?? undefined,
      nextRunAt: sub.next_run_at ?? undefined,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at,
      notifyEmail: sub.notify_email ?? undefined,
      webhookUrl: sub.webhook_url ?? undefined,
    },
    statusUrl: result.data.status_url,
    settlement,
  };
}

function parseCreateAuditResponse(
  raw: unknown,
  expectedTier: AuditTier,
): CreateAuditResponse {
  const result = createAuditResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Create audit response failed schema validation', result.error);
  }
  const data = result.data;
  return {
    auditId: data.audit_id,
    tier: data.tier ?? expectedTier,
    status: data.status,
    priceUsd: data.price_usd,
    statusUrl: data.status_url,
  };
}

function parseAuditReport(raw: unknown): AuditReport {
  const result = auditReportSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Audit report response failed schema validation', result.error);
  }
  const data = result.data;
  const audit = data.audit;
  return {
    auditId: audit.id,
    status: audit.status,
    grade: audit.score ?? undefined,
    projectName: audit.project_name ?? undefined,
    createdAt: audit.created_at,
    completedAt: audit.completed_at ?? undefined,
    summary: audit.summary
      ? {
          managementSummary: audit.summary.management_summary,
          protocolOverview: audit.summary.protocol_overview,
          methodology: audit.summary.methodology,
          threatModel: audit.summary.threat_model,
          architectureReview: audit.summary.architecture_review,
          functionalityAnalysis: audit.summary.functionality_analysis,
          securityAssessment: audit.summary.security_assessment,
          recommendations: audit.summary.recommendations,
          gradeRationale: audit.summary.grade_rationale,
        }
      : undefined,
    severityCounts: audit.severity_counts ?? undefined,
    findings: data.findings.map((f) => ({
      severity: f.severity,
      title: f.title,
      category: f.category ?? undefined,
      description: f.description ?? undefined,
      recommendation: f.recommendation ?? undefined,
      file: f.file ?? undefined,
      lineStart: f.line_start ?? undefined,
      lineEnd: f.line_end ?? undefined,
      references: f.references ?? undefined,
    })),
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    function cleanup(): void {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
    }
    function onAbort(): void {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Operations for the Auditr-hosted x402 facilitator at
 * `https://facilitator.auditr.xyz`. Bot/agent fleets that want to
 * run x402 (verify + settle) without operating their own facilitator
 * provision a Bearer token here and point any x402 SDK
 * (Coinbase AgentKit, x402-py, x402-ts) at our URL.
 */
class FacilitatorApi {
  constructor(private readonly parent: Auditr) {}

  /**
   * Mint a free trial key. 100 settlements per month, no expiry, no
   * payment required. IP-rate-limited on the server side; one or two
   * trial keys per IP per day in normal operation.
   *
   * ```ts
   * const key = await auditr.facilitator.trial({
   *   label: 'my bot',
   *   ownerContact: 'me@example.com',
   * });
   * // Send `key.token` as `Authorization: Bearer ...` to
   * // `${key.facilitatorUrl}/verify` and `/settle`.
   * ```
   */
  async trial(request: FacilitatorSignupRequest): Promise<FacilitatorKey> {
    this.assertSignupRequest(request);
    const raw = await this.parent.freePost<unknown>(
      '/api/facilitator/trial',
      {
        label: request.label,
        owner_contact: request.ownerContact,
        networks_csv: request.networksCsv ?? '*',
      },
    );
    return parseFacilitatorKey(raw);
  }

  /**
   * Pay for a basic facilitator subscription. $10 USDC for 30 days.
   * The SDK's configured `PaymentSigner` produces the EIP-3009 auth
   * exactly the same way it does for audit payments.
   *
   * ```ts
   * const key = await auditr.facilitator.signup('basic', {
   *   label: 'Acme bot fleet',
   *   ownerContact: 'ops@acme.io',
   * });
   * ```
   *
   * After lapse, the key silently falls back to the trial quota
   * until renewed. Call `adminInfo` with the returned token to read
   * remaining quota and `paidThroughAt`.
   */
  signup(
    tier: PaidFacilitatorTier,
    request: FacilitatorSignupRequest,
  ): Promise<FacilitatorKey> {
    this.assertSignupRequest(request);
    return this.createSubscription(tier, {
      label: request.label,
      owner_contact: request.ownerContact,
      networks_csv: request.networksCsv ?? '*',
    });
  }

  /**
   * Pay for another 30 days at the chosen tier. Paying a higher
   * tier than the key's current stored tier upgrades it in the
   * same call (e.g. `renew('pro', keyId)` on a `basic` key
   * upgrades to pro AND extends paid_through by 30 days).
   */
  async renew(
    tier: PaidFacilitatorTier,
    request: FacilitatorRenewRequest,
  ): Promise<FacilitatorRenewResponse> {
    if (!request || !request.keyId) {
      throw new ValidationError('renew requires { keyId }', null);
    }
    const { response } = await this.parent.paidPost<unknown>(
      `/api/x402/facilitator/renew/${tier}`,
      { key_id: request.keyId },
    );
    return parseRenewResponse(response);
  }

  /**
   * List the (scheme, network) pairs the facilitator currently
   * verifies and settles. No auth required; useful for discovery.
   */
  async supported(): Promise<FacilitatorSupportedKind[]> {
    const parsed = (await this.parent.externalGetJson(
      `${DEFAULT_FACILITATOR_URL}/supported`,
    )) as { kinds?: unknown };
    if (!parsed || !Array.isArray(parsed.kinds)) {
      throw new ValidationError('/supported response missing `kinds` array', null);
    }
    return parsed.kinds as FacilitatorSupportedKind[];
  }

  /**
   * Auth'd read of the facilitator's `/admin/info` for a given key.
   * Returns the caller's tier, remaining quota, `paidThroughAt`,
   * and other operator-facing state. Send the same Bearer token you
   * use for /verify and /settle.
   */
  async adminInfo(token: string): Promise<FacilitatorAdminInfo> {
    if (!token) {
      throw new ValidationError('adminInfo requires a Bearer token', null);
    }
    const parsed = await this.parent.externalGetJson(
      `${DEFAULT_FACILITATOR_URL}/admin/info`,
      { authorization: `Bearer ${token}` },
    );
    return normalizeAdminInfo(parsed);
  }

  private assertSignupRequest(request: FacilitatorSignupRequest): void {
    if (!request || typeof request !== 'object') {
      throw new ValidationError('signup/trial requires a request object', null);
    }
    if (!request.label || typeof request.label !== 'string') {
      throw new ValidationError('signup/trial requires `label`', null);
    }
    if (!request.ownerContact || typeof request.ownerContact !== 'string') {
      throw new ValidationError('signup/trial requires `ownerContact`', null);
    }
  }

  private async createSubscription(
    tier: PaidFacilitatorTier,
    body: Record<string, unknown>,
  ): Promise<FacilitatorKey> {
    const { response } = await this.parent.paidPost<unknown>(
      `/api/x402/facilitator/signup/${tier}`,
      body,
    );
    return parseFacilitatorKey(response);
  }
}

function parseFacilitatorKey(raw: unknown): FacilitatorKey {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Facilitator key response is not an object', null);
  }
  const obj = raw as Record<string, unknown>;
  const keyId = obj.key_id;
  const tier = obj.tier;
  const monthlySettleQuota = obj.monthly_settle_quota;
  const paidThroughAt = (obj.paid_through_at ?? null) as string | null;
  const token = obj.token;
  const facilitatorUrl = (obj.facilitator_url ?? DEFAULT_FACILITATOR_URL) as string;
  const integrationDocs = (obj.integration_docs ?? '') as string;
  if (typeof keyId !== 'string' || typeof token !== 'string' || typeof tier !== 'string') {
    throw new ValidationError('Facilitator key response missing required fields', null);
  }
  if (typeof monthlySettleQuota !== 'number') {
    throw new ValidationError('Facilitator key response.monthly_settle_quota is not a number', null);
  }
  return {
    keyId,
    tier: tier as FacilitatorKey['tier'],
    monthlySettleQuota,
    paidThroughAt,
    token,
    facilitatorUrl,
    integrationDocs,
  };
}

function parseRenewResponse(raw: unknown): FacilitatorRenewResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Renew response is not an object', null);
  }
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.key_id !== 'string' ||
    typeof obj.tier !== 'string' ||
    typeof obj.paid_through_at !== 'string'
  ) {
    throw new ValidationError('Renew response missing required fields', null);
  }
  return {
    keyId: obj.key_id,
    tier: obj.tier as FacilitatorRenewResponse['tier'],
    paidThroughAt: obj.paid_through_at,
  };
}

function normalizeAdminInfo(raw: unknown): FacilitatorAdminInfo {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('/admin/info response is not an object', null);
  }
  const obj = raw as Record<string, unknown>;
  const auth = obj.auth as Record<string, unknown> | undefined;
  const fee = obj.fee_policy as Record<string, unknown> | undefined;
  if (!auth || !fee) {
    throw new ValidationError('/admin/info response missing auth or fee_policy', null);
  }
  return {
    ok: true,
    service: 'auditr_facilitator',
    networkMode: obj.network_mode === 'testnet' ? 'testnet' : 'mainnet',
    chains: Array.isArray(obj.chains) ? (obj.chains as string[]) : [],
    feePolicy: {
      evmPct: Number(fee.evm_pct ?? 0),
      evmFloorUsd: Number(fee.evm_floor_usd ?? 0),
      svmPct: Number(fee.svm_pct ?? 0),
      svmFloorUsd: Number(fee.svm_floor_usd ?? 0),
      extractionWired: Boolean(fee.extraction_wired ?? false),
    },
    auth: {
      keyId: String(auth.key_id ?? ''),
      label: String(auth.label ?? ''),
      tier: (auth.tier ?? 'trial') as FacilitatorAdminInfo['auth']['tier'],
      effectiveTier: (auth.effective_tier ?? 'trial') as FacilitatorAdminInfo['auth']['effectiveTier'],
      paidThroughAt: (auth.paid_through_at ?? null) as string | null,
      monthlySettleQuota: Number(auth.monthly_settle_quota ?? 0),
      monthlySettleUsed: Number(auth.monthly_settle_used ?? 0),
      monthlyPeriodStart: String(auth.monthly_period_start ?? ''),
    },
  };
}
