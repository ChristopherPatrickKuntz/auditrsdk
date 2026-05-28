/**
 * Top up an existing facilitator key by paying $10 USDC via x402.
 *
 * Drops the buyer's wallet through your own EIP-3009 signer
 * (typically Coinbase Agent Kit or a viem adapter; see
 * examples/manual-eip3009.ts). The SDK drives the 402 challenge and
 * retry; you keep the returned balance + tx hash.
 *
 *   npx tsx examples/facilitator-topup.ts
 */

import { Auditr, FACILITATOR_PRICING, type PaymentSigner } from '../src/index.js';

// Replace with a real signer (see examples/coinbase-agent-kit.ts or
// examples/manual-eip3009.ts).
const yourSigner: PaymentSigner = {
  async sign() {
    throw new Error('Plug in a real PaymentSigner for the example to run.');
  },
};

async function main(): Promise<void> {
  const auditr = new Auditr({ signer: yourSigner });

  console.log(
    `Top-up amount: $${FACILITATOR_PRICING.topUpUsd} USDC (= ${FACILITATOR_PRICING.topUpAtomicUsdc} atomic USDC)`,
  );

  const existingKeyId = process.env.AUDITR_FAC_KEY_ID ?? 'replace-with-your-keyId';
  const result = await auditr.facilitator.topup({ keyId: existingKeyId });

  console.log('\nTop-up result:');
  console.log('  keyId:                  ', result.keyId);
  console.log('  txHash:                 ', result.txHash);
  console.log('  credited (first credit):', result.credited);
  console.log(`  paidBalanceUsd:          $${result.paidBalanceUsd.toFixed(6)}`);
  console.log('  paidBalanceAtomicUsdc:  ', result.paidBalanceAtomicUsdc);

  // A retry of a successful top-up returns credited=false but does
  // NOT double-credit the balance. The settlement tx hash on the
  // first call is the idempotency key.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
