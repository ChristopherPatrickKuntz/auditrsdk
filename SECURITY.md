# Security Policy

## Reporting a vulnerability

Send a report to `info@auditr.xyz`. Include:

- A clear description of the vulnerability.
- Steps to reproduce.
- The affected SDK version.
- The runtime (Node version, browser version, OS).

Reports that include a proof of concept are processed faster. Please
do not open a public GitHub issue for security reports. We will
respond within three business days with an initial assessment.

## Scope

In scope:

- The published `@auditrxyz/sdk` npm package.
- The example code under `examples/`.
- Schema definitions under `src/schema/`.

Out of scope for this repository:

- The Auditr backend at `api.auditr.xyz`. Report backend issues
  via the contact in
  [auditr.xyz/.well-known/security.txt](https://auditr.xyz/.well-known/security.txt).
- Third party wallets, agent kits, and facilitators referenced in
  the examples.

## Disclosure

We follow coordinated disclosure. We will work with you on a
disclosure timeline and credit you in the release notes once a fix
ships, unless you request otherwise.

## Supported versions

We patch the latest published minor release. Older minors receive
fixes only for vulnerabilities rated High or Critical.
