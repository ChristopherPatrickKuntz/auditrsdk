/**
 * Mint a free trial key for the Auditr-hosted x402 facilitator and
 * use it from the official x402 SDK.
 *
 * Trial keys allow 100 settlements per month with no expiry. The
 * endpoint is unpaid; the server side IP rate-limits to prevent
 * spam minting.
 *
 *   npx tsx examples/facilitator-trial.ts
 */

import { Auditr, type PaymentSigner } from '../src/index.js';

// Trial signup needs no payment, so the signer is never invoked.
const stubSigner: PaymentSigner = {
  async sign() {
    throw new Error('trial does not invoke the signer');
  },
};

async function main(): Promise<void> {
  const auditr = new Auditr({ signer: stubSigner });

  const key = await auditr.facilitator.trial({
    label: 'demo bot',
    ownerContact: 'demo@example.com',
    // networksCsv: 'eip155:8453,solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  });

  console.log('Minted facilitator key:');
  console.log('  keyId:              ', key.keyId);
  console.log('  tier:               ', key.tier);
  console.log('  monthlySettleQuota: ', key.monthlySettleQuota);
  console.log('  facilitatorUrl:     ', key.facilitatorUrl);
  console.log('  integrationDocs:    ', key.integrationDocs);
  console.log('  token:               <store securely; only returned once>');

  // The token is what you send to /verify and /settle. Wire it into
  // the x402 SDK's facilitator client like this:
  //
  //   from x402.http import FacilitatorConfig, HTTPFacilitatorClient
  //   from x402.http.facilitator_client_base import CreateHeadersAuthProvider
  //
  //   bearer = {"Authorization": f"Bearer {key.token}"}
  //   auth = CreateHeadersAuthProvider(
  //       lambda: {"verify": bearer, "settle": bearer, "supported": {}}
  //   )
  //   facilitator = HTTPFacilitatorClient(
  //       FacilitatorConfig(url=key.facilitator_url, auth_provider=auth)
  //   )

  // Check usage at any time:
  const info = await auditr.facilitator.adminInfo(key.token);
  console.log(
    '\nCurrent quota: ',
    info.auth.monthlySettleUsed,
    '/',
    info.auth.monthlySettleQuota,
    'in period',
    info.auth.monthlyPeriodStart,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
