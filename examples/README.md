# Examples

Standalone runnable snippets. Treat these as documentation: each
file is intentionally minimal and free of production concerns like
retry policy, caching, or persistence.

| File                       | What it shows                                              |
| -------------------------- | ---------------------------------------------------------- |
| `basic.ts`                 | The shortest possible end to end run with a stub signer   |
| `coinbase-agent-kit.ts`    | Adapter that wraps Coinbase Agent Kit as a PaymentSigner  |
| `manual-eip3009.ts`        | Hand built EIP-3009 signer using a viem compatible wallet |

Run with `tsx` or `ts-node`:

```bash
npx tsx examples/basic.ts
```

You will need to substitute a real signer; the stub in `basic.ts`
throws on use. The other two files show realistic adapters.
