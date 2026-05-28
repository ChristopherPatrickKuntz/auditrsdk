/**
 * Pay for a basic facilitator subscription with USDC via x402.
 *
 * Drops the buyer's wallet through your own EIP-3009 signer (here,
 * a stub that would otherwise be the Coinbase Agent Kit or a viem
 * adapter). The SDK handles the 402 challenge and retry; you keep
 * the returned token and feed it to any x402-aware client.
 *
 *   npx tsx examples/facilitator-signup.ts
 */

import { Auditr, FACILITATOR_TIERS, type PaymentSigner } from '../src/index.js';

// Replace with a real signer (see examples/coinbase-agent-kit.ts or
// examples/manual-eip3009.ts in this directory).
const yourSigner: PaymentSigner = {
  async sign() {
    throw new Error('Plug in a real PaymentSigner for the example to run.');
  },
};

async function main(): Promise<void> {
  const auditr = new Auditr({ signer: yourSigner });

  // Tier catalog (helpful for matching what you intend to pay).
  console.log('Available paid tiers:');
  for (const [name, t] of Object.entries(FACILITATOR_TIERS)) {
    if (name === 'trial') continue;
    console.log(
      `  ${name.padEnd(10)} $${t.priceUsdPerMonth}/mo  ${t.monthlyQuota} settlements`,
    );
  }

  const key = await auditr.facilitator.signup('basic', {
    label: 'Acme bot fleet',
    ownerContact: 'ops@acme.io',
  });

  console.log('\nProvisioned:');
  console.log('  keyId:           ', key.keyId);
  console.log('  tier:            ', key.tier);
  console.log('  paidThroughAt:   ', key.paidThroughAt);
  console.log('  monthlyQuota:    ', key.monthlySettleQuota);
  console.log('  facilitatorUrl:  ', key.facilitatorUrl);
  console.log('  token:            <persist securely; never returned again>');

  // After about 28 days, renew before lapse. Paying a higher tier on
  // renew transparently upgrades the stored tier in the same call:
  //
  //   const updated = await auditr.facilitator.renew('pro', { keyId: key.keyId });
  //   // updated.tier === 'pro'
  //   // updated.paidThroughAt extended by 30 days from the prior boundary
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
