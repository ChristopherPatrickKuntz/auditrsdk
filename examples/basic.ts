/**
 * Minimal end-to-end example. Replace `signer` with a real x402
 * implementation. The Coinbase Agent Kit example in this directory
 * shows one production-grade option.
 */

import { Auditr, type PaymentSigner } from '@auditrxyz/sdk';

const signer: PaymentSigner = {
  async sign(_challenge, _accept) {
    throw new Error(
      'Implement a real signer. See examples/coinbase-agent-kit.ts or examples/manual-eip3009.ts.',
    );
  },
};

const auditr = new Auditr({ signer });

async function main(): Promise<void> {
  const created = await auditr.audits.quick({
    scanType: 'site',
    target: 'https://example.com',
    tosAccepted: true,
  });
  console.log('Created', created.auditId, 'tier', created.tier);

  const report = await auditr.audits.waitForCompletion(created.auditId, {
    onStatus: (s) => console.log('Status', s),
  });
  console.log('Grade', report.grade);
  console.log('Findings', report.findings.length);
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
