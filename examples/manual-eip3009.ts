/**
 * Manual `PaymentSigner` using viem. Produces an EIP-3009
 * transferWithAuthorization for USDC against the recipient declared
 * in the x402 challenge, then base64 encodes the result for the
 * PAYMENT-SIGNATURE header.
 *
 * This example targets Base mainnet (eip155:8453). Adapt the chain
 * id and asset address from the accept entry the challenge advertises
 * for production use.
 */

import { Auditr, type PaymentSigner, type PaymentAccept, type PaymentRequired } from '@auditrxyz/sdk';
// import { createWalletClient, http, parseUnits } from 'viem';
// import { privateKeyToAccount } from 'viem/accounts';
// import { base } from 'viem/chains';

type SignTypedDataLike = (params: {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}) => Promise<`0x${string}`>;

interface WalletLike {
  account: { address: `0x${string}` };
  signTypedData: SignTypedDataLike;
}

class Eip3009Signer implements PaymentSigner {
  constructor(private readonly wallet: WalletLike) {}

  async sign(_challenge: PaymentRequired, accept: PaymentAccept): Promise<string> {
    if (accept.scheme !== 'exact') {
      throw new Error(`Unsupported scheme: ${accept.scheme}`);
    }
    if (!accept.asset) {
      throw new Error('PaymentAccept.asset is required for EIP-3009');
    }

    const chainId = parseEip155ChainId(accept.network);
    const verifyingContract = accept.asset as `0x${string}`;

    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = `0x${cryptoRandomHex(64)}` as `0x${string}`;

    const message = {
      from: this.wallet.account.address,
      to: accept.payTo,
      value: parseUsdc(accept.price),
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await this.wallet.signTypedData({
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId,
        verifyingContract,
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message,
    });

    const payload = {
      x402Version: 2,
      scheme: accept.scheme,
      network: accept.network,
      payload: {
        signature,
        authorization: {
          from: message.from,
          to: message.to,
          value: message.value.toString(),
          validAfter: message.validAfter.toString(),
          validBefore: message.validBefore.toString(),
          nonce: message.nonce,
        },
      },
    };

    return base64UrlSafe(JSON.stringify(payload));
  }
}

function parseEip155ChainId(network: string): number {
  if (!network.startsWith('eip155:')) {
    throw new Error(`Not an EVM network: ${network}`);
  }
  return Number(network.slice('eip155:'.length));
}

function parseUsdc(priceString: string): bigint {
  // USDC has six decimals on every supported chain we settle on.
  const cleaned = priceString.replace(/^\$?/, '').trim();
  const [whole, fraction = ''] = cleaned.split('.');
  const padded = (fraction + '000000').slice(0, 6);
  return BigInt(whole + padded);
}

function cryptoRandomHex(chars: number): string {
  const bytes = chars / 2;
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlSafe(input: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(input);
  }
  return Buffer.from(input, 'utf8').toString('base64');
}

async function main(wallet: WalletLike): Promise<void> {
  const auditr = new Auditr({ signer: new Eip3009Signer(wallet) });
  const audit = await auditr.audits.standard({
    scanType: 'site',
    target: 'https://example.com',
    tosAccepted: true,
  });
  const report = await auditr.audits.waitForCompletion(audit.auditId);
  console.log(report.grade, report.findings.length);
}

export { Eip3009Signer, main };
