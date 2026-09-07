# Examples

Integration templates and adapter sketches. They require your wallet,
signer, and target configuration before use; none is a preconfigured
end-to-end demo. Each file is intentionally minimal and omits production
concerns like retry policy, caching, or persistence.

| File | What it shows | Required setup |
| ---- | ------------- | -------------- |
| [basic.ts](basic.ts) | Audit creation and polling | Replace the throwing signer stub and set your target. |
| [coinbase-agent-kit.ts](coinbase-agent-kit.ts) | Coinbase Agent Kit adapter sketch | Replace the pseudocode payment interface with your installed kit's API, then call the exported `main` function with your client. |
| [manual-eip3009.ts](manual-eip3009.ts) | EIP-3009 signer with a viem-compatible wallet | Create your wallet client, connect it to the adapter, and call the exported `main` function. |
| [monitoring.ts](monitoring.ts) | Monitoring subscription with notification settings | Replace the signer stub, wallet and target addresses, and notification settings. |
| [facilitator-trial.ts](facilitator-trial.ts) | Wallet-authorized facilitator trial | Replace the dummy wallet address and signature. The template uses EVM, which has zero free settlements; use a Solana wallet and signature for the free Solana quota. |
| [facilitator-topup.ts](facilitator-topup.ts) | Prepaid facilitator balance top-up | Replace the signer stub and set `AUDITR_FAC_KEY_ID` to your existing key ID. |

From a repository checkout, install dependencies and build the package
so the examples that import `@auditrxyz/sdk` can resolve its exports:

```bash
npm ci
npm run build
```

After replacing the placeholders in `basic.ts`, run it with `tsx`:

```bash
npx tsx examples/basic.ts
```

Audit, monitoring, and top-up examples make paid API requests when
connected to a working signer. The adapter files export functions and
do not start a request when run on their own. Install any wallet library
you choose separately; wallet libraries are not SDK dependencies.

CI typechecks these files as documentation examples. That check does
not verify a live wallet integration or call the Auditr API.
