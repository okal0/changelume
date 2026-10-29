# Real Stripe SDK fixture

Run from the Changelume root: `node scripts/integration.mjs`. Node 24, npm, Git, a built `dist/cli.cjs`, and network access to the npm registry are required. `npm ci --ignore-scripts` is explicitly configured verification; discovery does not install dependencies. A nonstandard Node installation may supply `CHANGELUME_NPM_CLI` pointing to npm's JS entry point.

This fixture uses actual `stripe@11.18.0` and `stripe@12.0.0` with a complete committed npm lockfile. Its root package has `type: module`; TypeScript 5.9.3 uses NodeNext resolution and module output. The original `new Payments.Stripe(...)` **type-checks** with Stripe 12's historical declarations but fails at runtime in native ESM. The direct constructor works after migration. Stripe 11 ESM still has both constructor aliases. Both versions' CommonJS builds retain the aliases; this is checked separately and is not claimed to fail.

Synthetic test keys instantiate clients only. No vendor API operation is called. Before/after checks use the actual npm-resolved ESM builds. The runner asserts dry-run source preservation, migrated source type checking and runtime behavior, unrelated Date behavior, and zero proposed edits after acceptance. It leaves a JSON result and local reports under `.demo/integration-*` for inspection.

Source evidence: [v12 changelog](https://github.com/stripe/stripe-node/blob/v12.0.0/CHANGELOG.md), [CommonJS entry point](https://github.com/stripe/stripe-node/blob/v12.0.0/src/stripe.cjs.node.ts), and installed package artifacts. These distinctions refine the original broad alias-removal claim.
