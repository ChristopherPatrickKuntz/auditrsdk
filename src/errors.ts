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
 * Internal flow control signal carrying the decoded PAYMENT-REQUIRED
 * challenge. The SDK throws this inside `assertOk` when a paid route
 * returns 402, catches it in the same `paidPost` call, and uses
 * `err.challenge` to drive the signer. The high level methods
 * (`audits.<tier>`, `monitoring.<tier>`, `facilitator.signup`) never
 * surface it to user code; you only see it if you reach into the
 * `@internal` `paidPost` / `freeGet` helpers directly.
 *
 * Exported so advanced consumers who do reach into the internals can
 * `instanceof` it for control flow.
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
