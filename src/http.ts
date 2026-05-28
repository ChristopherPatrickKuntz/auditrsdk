/**
 * Internal HTTP helpers. Not part of the public surface.
 */

import { HttpError, PaymentRequiredError, ValidationError } from './errors.js';
import type { PaymentRequired, PaymentSettlement } from './types.js';

const SDK_VERSION = '0.1.0';

export function buildUserAgent(custom?: string): string {
  const own = `auditrxyz-sdk-js/${SDK_VERSION}`;
  return custom ? `${custom} ${own}` : own;
}

/**
 * base64 decode that works in both Node and browsers without
 * pulling in a polyfill.
 */
export function b64decodeUtf8(value: string): string {
  if (typeof globalThis.atob === 'function') {
    return decodeURIComponent(
      Array.from(globalThis.atob(value))
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  }
  return Buffer.from(value, 'base64').toString('utf8');
}

export function parsePaymentRequired(headerValue: string): PaymentRequired {
  let json: unknown;
  try {
    const decoded = b64decodeUtf8(headerValue);
    json = JSON.parse(decoded);
  } catch (e) {
    throw new ValidationError('PAYMENT-REQUIRED header is not valid base64 JSON', e);
  }
  if (!json || typeof json !== 'object') {
    throw new ValidationError('PAYMENT-REQUIRED payload is not an object', null);
  }
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.accepts)) {
    throw new ValidationError('PAYMENT-REQUIRED.accepts is not an array', null);
  }
  return obj as unknown as PaymentRequired;
}

export function parsePaymentSettlement(headerValue: string | null): PaymentSettlement | undefined {
  if (!headerValue) {
    return undefined;
  }
  try {
    const decoded = b64decodeUtf8(headerValue);
    const json = JSON.parse(decoded) as Record<string, unknown>;
    return json as PaymentSettlement;
  } catch {
    return undefined;
  }
}

export async function readBodyTruncated(response: Response, maxChars = 4096): Promise<string> {
  try {
    const text = await response.text();
    return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
  } catch {
    return '';
  }
}

export function assertOk(response: Response, body: string): void {
  if (response.ok) {
    return;
  }
  if (response.status === 402) {
    const headerValue = response.headers.get('payment-required');
    if (!headerValue) {
      throw new HttpError(402, body, response.headers, '402 returned without PAYMENT-REQUIRED header');
    }
    const challenge = parsePaymentRequired(headerValue);
    throw new PaymentRequiredError(challenge, response.url);
  }
  throw new HttpError(response.status, body, response.headers);
}
