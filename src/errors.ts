/**
 * Typed error hierarchy. Every async method on the client may throw a
 * subclass of `AuditrError`; callers should `instanceof` against the
 * specific subclass to discriminate.
 */

import type { PaymentRequired } from './types.js';

export class AuditrError extends Error {
  override name = 'AuditrError';
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/**
 * The first response from a paid route. Carries the decoded
 * PAYMENT-REQUIRED challenge so the caller's signer can produce the
 * authorization. Callers using `Auditr.audits.<tier>()` will not see
 * this error in normal flow; the SDK handles the 402 -> sign -> retry
 * dance internally. It is surfaced when the caller invokes
 * `client.http.raw()` for advanced use.
 */
export class PaymentRequiredError extends AuditrError {
  override name = 'PaymentRequiredError';
  constructor(
    public readonly challenge: PaymentRequired,
    public readonly resourceUrl: string,
  ) {
    super(`Payment required for ${resourceUrl}`);
  }
}

/**
 * The signer rejected or failed to produce an authorization. The
 * `cause` field carries the underlying error from the signer.
 */
export class SignerError extends AuditrError {
  override name = 'SignerError';
  constructor(message: string, cause: unknown) {
    super(message, cause);
  }
}

/**
 * An HTTP request returned a status code the SDK does not handle.
 * Status code, response body (truncated), and headers are preserved
 * for diagnosis.
 */
export class HttpError extends AuditrError {
  override name = 'HttpError';
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly headers: Headers,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
  }
}

/**
 * Thrown by `waitForCompletion` when `timeoutMs` elapses before the
 * audit reaches a terminal status.
 */
export class TimeoutError extends AuditrError {
  override name = 'TimeoutError';
  constructor(public readonly elapsedMs: number) {
    super(`Audit polling timed out after ${elapsedMs}ms`);
  }
}

/**
 * The API returned a response that did not match the expected schema.
 * The `cause` carries the underlying ZodError so callers can inspect
 * the failing path.
 */
export class ValidationError extends AuditrError {
  override name = 'ValidationError';
  constructor(message: string, cause: unknown) {
    super(message, cause);
  }
}
