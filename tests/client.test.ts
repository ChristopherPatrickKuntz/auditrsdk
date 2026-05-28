import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  Auditr,
  HttpError,
  SignerError,
  TimeoutError,
  ValidationError,
  type PaymentSigner,
} from '../src/index.js';

const SAMPLE_REPORT_PATH = resolve(__dirname, 'fixtures/sample-report.json');

function noopSigner(): PaymentSigner {
  return { sign: vi.fn().mockResolvedValue('base64.payment-signature') };
}

describe('Auditr constructor', () => {
  it('rejects construction without a signer', () => {
    expect(() => new Auditr({} as never)).toThrow(ValidationError);
  });

  it('builds with the default base URL', () => {
    const client = new Auditr({ signer: noopSigner() });
    expect(client).toBeInstanceOf(Auditr);
  });

  it('strips trailing slashes from baseUrl', () => {
    const client = new Auditr({
      signer: noopSigner(),
      baseUrl: 'https://api.example.com////',
    });
    // Cast to any to inspect a private; this is a unit test only.
    expect((client as unknown as { baseUrl: string }).baseUrl).toBe('https://api.example.com');
  });
});

describe('audits.get', () => {
  it('parses a well-formed report', async () => {
    const report = JSON.parse(await readFile(SAMPLE_REPORT_PATH, 'utf8')) as unknown;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const result = await client.audits.get('3dd88ae3-868f-406c-a868-9c0cc1be23f0');
    expect(result.grade).toBe('A');
    expect(result.findings).toHaveLength(1);
    expect(result.severityCounts?.low).toBe(1);
  });

  it('throws ValidationError on bad shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ not: 'a report' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    await expect(client.audits.get('any')).rejects.toThrow(ValidationError);
  });

  it('throws HttpError on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    await expect(client.audits.get('missing')).rejects.toThrow(HttpError);
  });
});

describe('audits.waitForCompletion', () => {
  it('returns immediately when status is completed', async () => {
    const report = JSON.parse(await readFile(SAMPLE_REPORT_PATH, 'utf8')) as unknown;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(report), { status: 200 }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const onStatus = vi.fn();
    const result = await client.audits.waitForCompletion('id', { onStatus });
    expect(result.status).toBe('completed');
    expect(onStatus).toHaveBeenCalledWith('completed');
  });

  it('rejects with TimeoutError when status never settles', async () => {
    const pending = {
      audit: {
        id: 'p',
        status: 'analyzing',
        created_at: '2026-05-28T01:00:00.000Z',
      },
      findings: [],
    };
    // Fresh Response per call: body is a one shot stream and cannot
    // be read twice.
    const fetchImpl = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(pending), { status: 200 })),
      );
    const client = new Auditr({
      signer: noopSigner(),
      fetch: fetchImpl,
      pollIntervalMs: 5,
      defaultTimeoutMs: 25,
    });
    await expect(client.audits.waitForCompletion('p')).rejects.toThrow(TimeoutError);
  });
});

describe('paid POST flow', () => {
  it('signs and retries on 402', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'https://api.example.com/api/x402/audits/web3' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          payTo: '0x0000000000000000000000000000000000000000',
          amount: '25000000',
        },
      ],
    };
    const challengeHeader = Buffer.from(JSON.stringify(challenge)).toString('base64');
    const settled = {
      audit_id: 'created',
      tier: 'web3',
      status: 'analyzing',
      price_usd: 25,
      status_url: '/api/x402/audits/created',
    };

    const fetchImpl = vi
      .fn<Parameters<typeof fetch>, Promise<Response>>()
      .mockResolvedValueOnce(
        new Response('payment required', {
          status: 402,
          headers: { 'payment-required': challengeHeader },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(settled), {
          status: 201,
          headers: { 'payment-response': 'eyJ0cmFuc2FjdGlvbiI6IjB4ZGVhZGJlZWYifQ==' },
        }),
      );

    const signer = noopSigner();
    const client = new Auditr({
      signer,
      fetch: fetchImpl,
      baseUrl: 'https://api.example.com',
    });

    const result = await client.audits.web3({
      scanType: 'site',
      target: 'https://example.com',
      tosAccepted: true,
    });

    expect(signer.sign).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.auditId).toBe('created');
    expect(result.tier).toBe('web3');
  });

  it('creates a monitoring subscription end to end', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'https://api.example.com/api/x402/monitoring/pro' },
      accepts: [
        { scheme: 'exact', network: 'eip155:8453', payTo: '0x0', amount: '25000000' },
      ],
    };
    const settled = {
      subscription: {
        id: 'sub-1',
        user_wallet: '0xcafe',
        target_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        target_kind: 'contract',
        chain: 'ethereum',
        tier: 'pro',
        interval_minutes: 60,
        delivery: ['telegram', 'email'],
        active: false,
        paid_through_ts: null,
        next_run_at: null,
        created_at: '2026-05-28T01:00:00.000Z',
        updated_at: '2026-05-28T01:00:00.000Z',
        notify_email: null,
        webhook_url: null,
      },
      status_url: '/api/monitoring/subscriptions?wallet=0xcafe',
    };
    const fetchImpl = vi
      .fn<Parameters<typeof fetch>, Promise<Response>>()
      .mockResolvedValueOnce(
        new Response('payment required', {
          status: 402,
          headers: {
            'payment-required': Buffer.from(JSON.stringify(challenge)).toString('base64'),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(settled), { status: 201 }),
      );
    const client = new Auditr({
      signer: noopSigner(),
      fetch: fetchImpl,
      baseUrl: 'https://api.example.com',
    });
    const result = await client.monitoring.pro({
      userWallet: '0xcafe',
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chain: 'ethereum',
    });
    expect(result.subscription.tier).toBe('pro');
    expect(result.subscription.targetKind).toBe('contract');
    expect(result.statusUrl).toContain('wallet=0xcafe');
  });

  it('rejects monitoring without required fields', async () => {
    const client = new Auditr({ signer: noopSigner() });
    await expect(
      client.monitoring.basic({
        userWallet: '',
        contractAddress: '0x0',
        chain: 'ethereum',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('wraps signer failures in SignerError', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'https://api.example.com/api/x402/audits/quick' },
      accepts: [{ scheme: 'exact', network: 'eip155:8453', payTo: '0x0', amount: '1000000' }],
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response('', {
        status: 402,
        headers: { 'payment-required': Buffer.from(JSON.stringify(challenge)).toString('base64') },
      }),
    );
    const signer: PaymentSigner = {
      sign: vi.fn().mockRejectedValue(new Error('wallet locked')),
    };
    const client = new Auditr({ signer, fetch: fetchImpl, baseUrl: 'https://api.example.com' });
    await expect(
      client.audits.quick({ scanType: 'site', target: 'https://example.com', tosAccepted: true }),
    ).rejects.toThrow(SignerError);
  });
});
