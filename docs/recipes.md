# Adding a recipe

Start with official documentation and SDK history. Store reproducible source evidence with its URL, content hash, affected and target versions, and a stable change ID. Distinguish release observation from classification. Never infer all release changes from one matched example.

Add semantic discovery and narrow edits under the vendor/language modules. Each recipe declares a stable ID, a minimum SDK version, exact source and destination identifiers, a language-specific recognition guard, and a direct official source. Version assertions must never override a conflicting lockfile resolution. State preconditions explicitly, decline ambiguous forms, preserve unrelated bytes, and demonstrate idempotence. Add before/after fixtures and tests for comments/strings, scope or alias uncertainty, version conflicts, unsupported usages, and already-migrated code. Keep SDK, request, and webhook versions separate.

The Go, Java, C#, PHP and Ruby Stripe recipes live in `packages/core/src/languages/recipes.ts`. They are bounded lexical recipes, not compiler-aware analyzers. Add only a syntax shape with an explicit SDK import or client construction guard. A project must configure a trusted native compiler/test command for verification; the controlled polyglot text assertions do not replace real SDK integration tests.

Plans must connect findings to locations and sources, carry verification commands, and retain manual steps. Update the support matrix and security review. Test deterministic behavior without network/keys and fake provider output against the same safety boundary. Do not turn a heuristic into a confirmed finding. Regenerate committed bundles with `pnpm build`.
