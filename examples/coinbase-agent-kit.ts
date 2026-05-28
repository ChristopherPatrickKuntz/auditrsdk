/**
 * Adapter pattern for the Coinbase Agent Kit.
 *
 * The Agent Kit exposes a payment helper that handles x402 settlement
 * over EIP-3009. This file shows how to wrap that helper into a
 * `PaymentSigner` the Auditr SDK accepts. The Agent Kit imports are
 * sketched in pseudo form; consult the kit's documentation for the
 * exact module names in your installed version.
 */

import { Auditr, type PaymentSigner, type PaymentAccept, type PaymentRequired } from '@auditrxyz/sdk';

// Pseudo import. Replace with the real Agent Kit module.
// import { AgentPaymentClient } from '@coinbase/agentkit';

interface AgentPaymentClient {
  signX402Authorization(input: {
    accepts: PaymentAccept[];
    resourceUrl: string;
  }): Promise<{ paymentSignature: string }>;
}

class AgentKitSigner implements PaymentSigner {
  constructor(private readonly agent: AgentPaymentClient) {}

  async sign(challenge: PaymentRequired, _accept: PaymentAccept): Promise<string> {
    const { paymentSignature } = await this.agent.signX402Authorization({
      accepts: challenge.accepts,
      resourceUrl: challenge.resource.url,
    });
    return paymentSignature;
  }
}

async function main(agent: AgentPaymentClient): Promise<void> {
  const auditr = new Auditr({ signer: new AgentKitSigner(agent) });

  const audit = await auditr.audits.web3({
    scanType: 'site',
    target: 'https://example.com',
    tosAccepted: true,
  });

  const report = await auditr.audits.waitForCompletion(audit.auditId);
  console.log(report.grade, report.findings.length);
}

export { AgentKitSigner, main };
