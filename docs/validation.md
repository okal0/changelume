# MVP validation record

Validated locally on Windows with Node 24.22.1 and pnpm 11.25.0 on 2026-10-29.

- Dependency installation completed with the committed pnpm lockfile. Only esbuild's declared build script is allowed by workspace policy.
- `pnpm typecheck`: passed with strict TypeScript checking.
- `pnpm build`: generated standalone CLI and Node 24 Action bundles, including the offline source snapshot.
- `pnpm test`: 24 tests passed across core and bundled-Action suites. Coverage includes import aliases and shadowing, unrelated methods, unknown versions, dynamic usages/wrappers, unsupported versions, expected edits, idempotence, dirty trees, invalid config, baseline preservation, failed/skipped verification, credential/path/symlink/hash rejection, fake OpenAI request/schema/token/retry behavior, bounded fetch retries, current/historical changelog headings, duplicate PR protection, mocked PR creation, Action stage handoff and tampered artifact rejection.
- `pnpm demo`: scan → plan → dry-run → migration → verification completed. The demo asserts dry-run preserves source and checks the final recipe output, including unrelated code preservation. No Stripe account or LLM key is needed.
- Live source-fetch smoke test downloaded the official current Stripe changelog. A discovered anchor-heading format difference was fixed and regression-tested. The resulting report observes 23.0.1, 23.0.0, and other releases, all unclassified outside the fixed recipe. Cached fetched content SHA-256: `8d3f7c7ddeb6563ad7061bc1d80cd33c8487400e8d04a7280d219472e6edcef1`.
- Official v12 snapshot SHA-256: `bb732797b390c6ee3573d4f317df3d778cc1160f2192824fcbf9e4f99d0762f9`.
- Third-party Action tag-to-commit pins were checked directly against upstream Git repositories.

GitHub publishing was validated using mocked Octokit calls. The bundled analysis/verification stages were exercised locally as separate processes. No live GitHub workflow run, external PR, package publication, paid LLM call, or Stripe integration test was performed. CI configuration is supplied for Linux, but this local validation used Windows. Do not interpret recipe fixture assertions as proof of vendor API compatibility.
