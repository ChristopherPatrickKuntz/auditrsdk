/**
 * Mint a wallet-bound trial key for the Auditr-hosted x402 facilitator
 * and use it from the official x402 SDK.
 *
 * Trial keys give 25 free Solana-only settles per month, no expiry,
 * bound to a wallet you control. The wallet signature is verified
 * server-side so no one can claim your address to burn your free
 * quota.
 *
 * This example uses viem to sign the canonical message with a fresh
 * EVM wallet; swap in `@solana/web3.js` Keypair for a Solana wallet.
 *
 *   npx tsx examples/facilitator-trial.ts
 */

import {
  Auditr,
  buildTrialAuthMessage,
  type PaymentSigner,
} from '../src/index.js';

// The trial endpoint does not invoke the PaymentSigner; this stub is
// just so the Auditr constructor doesn't reject.
const stubSigner: PaymentSigner = {
  async sign() {
    throw new Error('trial does not invoke the x402 signer');
  },
};

async function main(): Promise<void> {
  // Replace this stanza with your own wallet's address + signing.
  // For EVM, use viem:
  //
  //   import { privateKeyToAccount } from 'viem/accounts';
  //   const account = privateKeyToAccount(process.env.PRIVATE_KEY!);
  //
  // For Solana, use @solana/web3.js Keypair.
  const walletAddress = '0x0000000000000000000000000000000000000000';
  const walletNetwork = 'evm' as const;
  const timestamp = new Date().toISOString();
  const nonce = crypto.getRandomValues(new Uint8Array(16)).reduce(
    (acc, b) => acc + b.toString(16).padStart(2, '0'),
    '',
  );

  // Build the canonical message the server verifies against. The
  // helper is a byte-exact mirror of the server's canonical_message
  // (column-12 label alignment, trailing newline). Don't hand-roll
  // this string; one wrong space and the server rejects with
  // wallet_signature_invalid.
  const message = buildTrialAuthMessage({
    walletAddress,
    walletNetwork,
    timestamp,
    nonce,
  });

  // Sign `message` with your wallet. Pseudocode:
  //   const signature = await account.signMessage({ message });
  // For this skeleton:
  const signature = '0x' + '00'.repeat(65);

  console.log('Canonical message (verify byte-for-byte):');
  console.log(message);

  const auditr = new Auditr({ signer: stubSigner });

  const key = await auditr.facilitator.trial({
    label: 'demo bot',
    ownerContact: 'demo@example.com',
    walletAddress,
    walletNetwork,
    timestamp,
    nonce,
    signature,
    // networksCsv: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  });

  console.log('\nMinted facilitator key:');
  console.log('  keyId:                 ', key.keyId);
  console.log('  walletAddress:         ', key.walletAddress);
  console.log('  walletNetwork:         ', key.walletNetwork);
  console.log('  freeSettlesPerMonth:   ', key.freeSettlesPerMonth);
  console.log('  paidBalanceAtomicUsdc: ', key.paidBalanceAtomicUsdc);
  console.log('  alreadyExisted:        ', key.alreadyExisted);
  console.log('  token:                  <store securely; only returned once>');

  // Wire the token into any x402 SDK's facilitator config:
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

  // Check balance + free quota:
  if (key.token) {
    const info = await auditr.facilitator.adminInfo(key.token);
    console.log(
      '\nCurrent usage:',
      info.auth.freeSettlesUsed,
      '/',
      info.billing.freeQuotaPerMonth,
      'free settles used in period',
      info.auth.freePeriodStart,
    );
    console.log(
      'Prepaid balance: $',
      (info.auth.paidBalanceAtomicUsdc / 1e6).toFixed(6),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
