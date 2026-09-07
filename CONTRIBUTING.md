# Contributing

Thanks for your interest. This SDK is small on purpose; contributions
that keep it small are welcomed.

## Ground rules

- Open an issue before starting non trivial work. A short discussion
  saves wasted effort.
- One change per pull request. Mixed concerns are harder to review
  and harder to revert.
- All public symbols ship with TSDoc comments. The README, examples,
  and API reference are derived from those comments.
- New features must include a test. Bug fixes must include a
  regression test.
- The SDK does not depend on a specific wallet, signing library, or
  blockchain client. New runtime dependencies are reviewed on a high
  bar.

## Local development

```bash
git clone https://github.com/ChristopherPatrickKuntz/auditrsdk.git
cd auditrsdk
npm install
npm run typecheck
npm run typecheck:examples
npm run test
npm run lint
```

`npm run build` produces the `dist/` artifact published to npm.

## Tests

Tests live under `tests/` and run with Vitest. Mock the network at
the `fetch` boundary; do not hit `api.auditr.xyz` from tests. The
`tests/fixtures/` directory holds canonical response payloads.

## Style

We use Prettier and ESLint. `npm run format` writes formatting
fixes; `npm run lint` runs the linter with `--max-warnings 0`.

Code style notes that are not enforced by the linter:

- Prefer `interface` over `type` for object shapes.
- Prefer exhaustive `switch` over chained `else if` for enum like
  inputs.
- Return values from public methods are described by an interface.
  Avoid inline anonymous return types.

## Commit messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification. Examples:

- `feat(client): add waitForCompletion onStatus callback`
- `fix(http): handle 402 with empty body`
- `docs(readme): document SignerError handling`

## License

By contributing you agree that your contributions are licensed under
the Apache 2.0 license described in the [LICENSE](LICENSE) file.
