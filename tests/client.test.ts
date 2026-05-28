import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  Auditr,
  HttpError,
  SignerError,
  TimeoutError,
  ValidationError,
  buildTrialAuthMessage,
  CANONICAL_MESSAGE_HEADER,
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

describe('facilitator.trial', () => {
  const validTrial = {
    label: 'my bot',
    ownerContact: 'me@example.com',
    walletAddress: '0x' + '11'.repeat(20),
    walletNetwork: 'evm' as const,
    timestamp: '2026-05-28T20:00:00+00:00',
    nonce: '0123456789abcdef0123456789abcdef',
    signature: '0x' + 'aa'.repeat(65),
  };

  it('requires all signature fields', async () => {
    const client = new Auditr({ signer: noopSigner() });
    await expect(
      client.facilitator.trial({} as never),
    ).rejects.toThrow(ValidationError);
    await expect(
      client.facilitator.trial({ ...validTrial, label: '' } as never),
    ).rejects.toThrow(ValidationError);
    await expect(
      client.facilitator.trial({ ...validTrial, walletNetwork: 'tvm' } as never),
    ).rejects.toThrow(ValidationError);
    // Bad nonce shape.
    await expect(
      client.facilitator.trial({ ...validTrial, nonce: 'not-hex' }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns a parsed FacilitatorKey on first mint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key_id: 'abc12345',
          wallet_address: '0x' + '11'.repeat(20),
          wallet_network: 'evm',
          free_settles_per_month: 25,
          paid_balance_atomic_usdc: 0,
          token: 'auditr_pub_abc12345_secretsecretsecretsecretsecretsecretsec',
          already_existed: false,
          facilitator_url: 'https://facilitator.auditr.xyz',
          integration_docs: 'https://auditr.xyz/faq#facilitator-api',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const key = await client.facilitator.trial(validTrial);
    expect(key.keyId).toBe('abc12345');
    expect(key.alreadyExisted).toBe(false);
    expect(key.freeSettlesPerMonth).toBe(25);
    expect(key.token).toContain('auditr_pub_');
    expect(key.walletNetwork).toBe('evm');
    // Body shape: snake_case mapping.
    const sent = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(sent.owner_contact).toBe('me@example.com');
    expect(sent.wallet_address).toBe(validTrial.walletAddress);
    expect(sent.wallet_network).toBe('evm');
    expect(sent.nonce).toBe(validTrial.nonce);
  });

  it('parses already_existed response without a token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key_id: 'abc12345',
          wallet_address: validTrial.walletAddress,
          wallet_network: 'evm',
          free_settles_per_month: 25,
          paid_balance_atomic_usdc: 4_200_000,
          already_existed: true,
          facilitator_url: 'https://facilitator.auditr.xyz',
          integration_docs: 'https://auditr.xyz/faq#facilitator-api',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const key = await client.facilitator.trial(validTrial);
    expect(key.alreadyExisted).toBe(true);
    expect(key.token).toBeUndefined();
    expect(key.paidBalanceAtomicUsdc).toBe(4_200_000);
  });

  it('rejects 400 wallet_signature_invalid as HttpError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: { error: 'wallet_signature_invalid' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    await expect(client.facilitator.trial(validTrial)).rejects.toThrow(HttpError);
  });
});

describe('facilitator.topup', () => {
  it('requires keyId', async () => {
    const client = new Auditr({ signer: noopSigner() });
    await expect(
      client.facilitator.topup({} as never),
    ).rejects.toThrow(ValidationError);
  });

  it('drives the x402 flow and parses topup response', async () => {
    const challengeBody = JSON.stringify({
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '10000000',
          payTo: '0xB03E5421f8588ea7C616f3E164461137E2a132E0',
          maxTimeoutSeconds: 300,
          extra: { name: 'USD Coin', version: '2' },
        },
      ],
    });
    const successBody = JSON.stringify({
      key_id: 'abc12345',
      tx_hash: '0xdeadbeef',
      credited: true,
      paid_balance_atomic_usdc: 10_000_000,
      paid_balance_usd: 10.0,
      facilitator_url: 'https://facilitator.auditr.xyz',
      integration_docs: 'https://auditr.xyz/faq#facilitator-api',
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(challengeBody, {
          status: 402,
          headers: {
            'content-type': 'application/json',
            'payment-required': Buffer.from(challengeBody).toString('base64'),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(successBody, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const r = await client.facilitator.topup({ keyId: 'abc12345' });
    expect(r.credited).toBe(true);
    expect(r.paidBalanceUsd).toBe(10);
    expect(r.txHash).toBe('0xdeadbeef');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // Body must use snake_case key_id.
    const sent = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(sent.key_id).toBe('abc12345');
  });

  it('parses an already-credited replay (credited=false)', async () => {
    const challengeBody = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact', network: 'eip155:8453',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: '10000000', payTo: '0xB', maxTimeoutSeconds: 300, extra: {},
      }],
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(challengeBody, {
        status: 402, headers: {
          'content-type': 'application/json',
          'payment-required': Buffer.from(challengeBody).toString('base64'),
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        key_id: 'abc12345', tx_hash: '0xdeadbeef', credited: false,
        paid_balance_atomic_usdc: 10_000_000, paid_balance_usd: 10,
        facilitator_url: 'https://facilitator.auditr.xyz',
        integration_docs: '',
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const r = await client.facilitator.topup({ keyId: 'abc12345' });
    expect(r.credited).toBe(false);
  });
});

describe('paidPost: 2xx without a 402 (free / promo branch)', () => {
  it('returns the parsed body when the endpoint settles without payment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audit_id: 'free-audit-id',
          tier: 'quick',
          status: 'created',
          price_usd: 0,
          status_url: '/api/x402/audits/free-audit-id',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const result = await client.audits.quick({
      scanType: 'site',
      target: 'https://example.com',
      tosAccepted: true,
    });
    expect(result.auditId).toBe('free-audit-id');
    expect(result.tier).toBe('quick');
    // Only one call (no signer round trip).
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('wraps a malformed 2xx body as ValidationError, not SyntaxError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not json at all', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    await expect(
      client.audits.quick({
        scanType: 'site',
        target: 'https://example.com',
        tosAccepted: true,
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('facilitator.supported', () => {
  it('returns the kinds array from the facilitator host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          kinds: [
            { scheme: 'exact', network: 'eip155:8453', x402Version: 2 },
            {
              scheme: 'exact',
              network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
              x402Version: 2,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const kinds = await client.facilitator.supported();
    expect(kinds).toHaveLength(2);
    expect(kinds[0]!.network).toBe('eip155:8453');
    // Must hit the facilitator host, not the auditr-api host.
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe('https://facilitator.auditr.xyz/supported');
    // No auth required for discovery.
    const headers = call[1].headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('throws ValidationError if /supported has no kinds array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    await expect(client.facilitator.supported()).rejects.toThrow(ValidationError);
  });
});

describe('facilitator.adminInfo', () => {
  it('parses the auth + billing + chains payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          service: 'auditr_facilitator',
          network_mode: 'mainnet',
          chains: ['evm:base -> 0xABC', 'svm:solana -> XYZ'],
          billing: {
            free_quota_per_month: 25,
            topup_amount_usd: 10,
            topup_amount_atomic_usdc: 10_000_000,
            gas_buffer_atomic_usdc: 500,
            gas_breaker_atomic_usdc: 100_000,
          },
          auth: {
            key_id: 'abc12345',
            label: 'my bot',
            is_internal: false,
            wallet_address: '0x' + '11'.repeat(20),
            wallet_network: 'evm',
            paid_balance_atomic_usdc: 4_200_000,
            free_settles_used: 7,
            free_settles_remaining: 18,
            free_period_start: '2026-05-01T00:00:00+00:00',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Auditr({ signer: noopSigner(), fetch: fetchImpl });
    const info = await client.facilitator.adminInfo('auditr_pub_abc12345_secret');
    expect(info.networkMode).toBe('mainnet');
    expect(info.chains).toHaveLength(2);
    expect(info.billing.freeQuotaPerMonth).toBe(25);
    expect(info.billing.topupAmountUsd).toBe(10);
    expect(info.billing.gasBufferAtomicUsdc).toBe(500);
    expect(info.auth.isInternal).toBe(false);
    expect(info.auth.walletNetwork).toBe('evm');
    expect(info.auth.paidBalanceAtomicUsdc).toBe(4_200_000);
    expect(info.auth.freeSettlesUsed).toBe(7);
    expect(info.auth.freeSettlesRemaining).toBe(18);
    // Must send the Bearer to the facilitator host.
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe('https://facilitator.auditr.xyz/admin/info');
    const headers = call[1].headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer auditr_pub_abc12345_secret');
  });

  it('requires a token', async () => {
    const client = new Auditr({ signer: noopSigner() });
    await expect(client.facilitator.adminInfo('')).rejects.toThrow(ValidationError);
  });
});

describe('buildTrialAuthMessage (byte-exact mirror of server canonical_message)', () => {
  // Golden bytes derived from the live Python server's
  // `auditr_facilitator.identity.canonical_message()` for the same
  // inputs. Locking this byte-for-byte means an SDK change that
  // shifts a single space will fail this test BEFORE it ever causes
  // a `wallet_signature_invalid` rejection in production.
  const GOLDEN =
    'Auditr Facilitator Trial Authorization\n' +
    'Wallet:    0xabcdEF1234567890ABCDEF1234567890ABCDEF12\n' +
    'Network:   evm\n' +
    'Timestamp: 2026-05-28T20:00:00+00:00\n' +
    'Nonce:     0123456789abcdef0123456789abcdef\n';

  it('matches the server canonical_message byte for byte', () => {
    const out = buildTrialAuthMessage({
      walletAddress: '0xabcdEF1234567890ABCDEF1234567890ABCDEF12',
      walletNetwork: 'evm',
      timestamp: '2026-05-28T20:00:00+00:00',
      nonce: '0123456789abcdef0123456789abcdef',
    });
    expect(out).toBe(GOLDEN);
    expect(out.length).toBe(189);
  });

  it('ends with a trailing newline', () => {
    const out = buildTrialAuthMessage({
      walletAddress: '0x' + '11'.repeat(20),
      walletNetwork: 'evm',
      timestamp: '2026-05-28T00:00:00+00:00',
      nonce: 'ab'.repeat(16),
    });
    expect(out.endsWith('\n')).toBe(true);
  });

  it('starts with the canonical header constant', () => {
    const out = buildTrialAuthMessage({
      walletAddress: 'GjkSomethingBase58',
      walletNetwork: 'svm',
      timestamp: '2026-05-28T00:00:00+00:00',
      nonce: 'ab'.repeat(16),
    });
    expect(out.startsWith(CANONICAL_MESSAGE_HEADER + '\n')).toBe(true);
  });

  it('preserves the column-12 label alignment', () => {
    const out = buildTrialAuthMessage({
      walletAddress: 'X',
      walletNetwork: 'evm',
      timestamp: 'T',
      nonce: 'N'.padEnd(32, 'N'),
    });
    const lines = out.split('\n');
    // Wallet:, Network:, Timestamp:, Nonce: all start at col 0, value at col 11.
    // (header line, then 4 labeled lines, then trailing empty after split)
    expect(lines[1]?.startsWith('Wallet:    ')).toBe(true);
    expect(lines[2]?.startsWith('Network:   ')).toBe(true);
    expect(lines[3]?.startsWith('Timestamp: ')).toBe(true);
    expect(lines[4]?.startsWith('Nonce:     ')).toBe(true);
    // Value column for all four lines is 11.
    for (const i of [1, 2, 3, 4]) {
      const colon = lines[i]?.indexOf(':') ?? -1;
      const valStart = colon + 1;
      let i2 = valStart;
      while (lines[i]![i2] === ' ') i2++;
      expect(i2).toBe(11);
    }
  });
});
