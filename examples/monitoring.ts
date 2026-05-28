/**
 * Subscribe an agent to on chain monitoring. The agent pays once per
 * month per target; alerts route to the configured delivery channels.
 *
 * Pick the tier that matches the agent's polling appetite:
 *
 *   basic       $10/month   1 target, 24 h check, Telegram only
 *   pro         $25/month   5 targets, 1 h check, Telegram + email
 *   enterprise  $50/month   unlimited, 15 min check, all channels
 *
 * For a Discord or Slack webhook destination, register the webhook in
 * the respective platform first and pass the full URL. The API
 * rejects non Discord/Slack hosts.
 */

import { Auditr, type PaymentSigner } from '@auditrxyz/sdk';

const signer: PaymentSigner = {
  async sign(_challenge, _accept) {
    throw new Error('Implement a real signer. See coinbase-agent-kit.ts or manual-eip3009.ts.');
  },
};

const auditr = new Auditr({ signer });

async function main(): Promise<void> {
  const created = await auditr.monitoring.pro({
    userWallet: '0xYourAgentWallet',
    contractAddress: '0xContractToWatch',
    chain: 'base',
    targetKind: 'contract',
    notifyEmail: 'alerts@example.com',
    webhookUrl: 'https://discord.com/api/webhooks/123/abc',
  });

  console.log('subscription', created.subscription.id);
  console.log('cadence', created.subscription.intervalMinutes, 'minutes');
  console.log('delivery', created.subscription.delivery.join(', '));
  console.log('status_url', created.statusUrl);
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
