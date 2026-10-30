# Language and multi-project support (0.5.0-rc.2)

Changelume discovers and reviews eight programming languages. TypeScript, JavaScript and Python have their existing selected recipes. Go, Java, C#, PHP and Ruby now each have one narrowly matched Stripe migration recipe. These five adapters use lexical guards rather than full compiler semantic models, require an explicit asserted SDK version when the manifest cannot establish the selected version, and must pass user-configured checks before application or publication.

| Language key | Dependency inputs | Automatic edits | Release monitoring |
| --- | --- | --- | --- |
| typescript | package.json, package-lock.json | Existing constructor, option and selected setter recipes; selected explicit upgrade | Stripe Node |
| javascript | package.json, package-lock.json | Same syntax/binding engine for ESM .js/.jsx/.mjs; CommonJS require remains manual | Stripe Node |
| python | requirements.txt; literal pyproject.toml declarations | Documented Stripe 5 OAuth spelling corrections; exact requirements pin required | Stripe Python |
| go | go.mod | v75+ correct deprecated `stripe.ErrorCodeInvoicePamentIntentRequiresAction` to `stripe.ErrorCodeInvoicePaymentIntentRequiresAction` for an imported stripe-go package alias | Stripe Go |
| java | pom.xml, build.gradle, build.gradle.kts | v21+ `CashBalance.retrieveCashBalance(...)` to `CashBalance.retrieve(...)` with explicit `com.stripe.model.CashBalance` import | Stripe Java |
| csharp | .csproj, packages.lock.json | v44+ `SubscriptionProrate` to `SubscriptionProrationBehavior` only in a matching `UpcomingInvoiceListLineItemsOptions` initializer | Stripe .NET |
| php | composer.json, composer.lock | v9+ `$client->sources->allTransactions(...)` to `$client->sources->allSourceTransactions(...)` when `$client` is directly constructed as StripeClient | Stripe PHP |
| ruby | Gemfile, Gemfile.lock | v8+ `Stripe::Subscription::delete(...)` to `Stripe::Subscription::cancel(...)` when Stripe is required | Stripe Ruby |

Go module declarations and Java manifest versions do not establish installed versions. Go minimum-version selection/replacements, Maven/Gradle variables and transitive resolution, conditional MSBuild imports, multiple C# project files per directory, central package management, dynamic Gemfiles and Python lockfile formats require manual review. C# conflicting framework lock versions stay unknown. PHP and Ruby locked versions are distinguished from manifest ranges. When selected versions are not established, set per-project `sdkVersion` as an explicit assertion; this does not run or resolve package managers. Python AST analysis requires a trusted Python 3.10+ interpreter outside the Git repository; PATH lookup ignores the project working directory and child environments omit credentials. Native compilers and SDKs are required for meaningful verification of edits.

## Get started

Use Node 24 and Git. Run `changelume languages --json` for machine-readable capabilities. Run `changelume discover --json` from the repository to list project units. `changelume init --workspace` creates an auto-discovery configuration. `changelume init --language go` creates a single-language configuration; use a recognized key from the table.

`projects: auto` enables combined inventory, plans and reports. It never selects or runs verification commands automatically. Before migrating, replace auto with explicit project entries, assert selected versions where needed, and configure trusted commands for every unit receiving edits. For example:

```yaml
projects:
  - path: frontend
    language: javascript
    verification:
      - command: node
        args: [verify.cjs]
  - path: backend
    language: python
    verification:
      - command: python
        args: ['-m', unittest]
  - path: worker
    language: go
    sdkVersion: 82.0.0 # Assert the version actually selected by Go module resolution.
    verification:
      - command: go
        args: [test, ./...]
```

Use `path: .` for a root unit. Include/exclude globs are relative to the unit. Nested discovered or explicitly configured units are excluded from their parent. Hidden paths, traversal, symlinks and overlapping edited files are refused. Generated/dependency directories are skipped. Discovery is bounded to 50 units and 30,000 directory entries. Binary assets are not parsed as manifests. Mixed JS/TS npm projects use the TypeScript adapter, which includes JS source; separate npm projects are discovered independently. Projects without recognized manifests can be listed explicitly.

Each unit has its own dependency inventory and scoped verification. Reports combine affected locations with repository-relative paths; project metadata retains source evidence and release observations per ecosystem. Aggregated release IDs are prefixed with node/python/go/etc., avoiding collisions across SDKs. Unknown SDK impact stays manual.

Migration verifies every edited unit in its own directory, generates one combined patch, and applies it through the existing recoverable transaction. A failed or missing verifier prevents application/publication. Large PR descriptions are shortened with explicit unresolved counts and a pointer to the full analysis report. Source acceptance uses the repository's single changelume.lock.json. Unit-local observation or acceptance files are not created. Put explicit upgrade from/to configuration on the relevant unit; root-wide upgrades and LLM edits are refused for multi-project runs. Only one edited adapter/upgrade may own a file.

## Monitoring evidence

Online scans fetch each language's official Stripe SDK changelog with bounded requests, validated source hashes and per-ecosystem caches/observation history. Repeated unchanged scans do not label the same releases newly observed. Native changelog entries remain unclassified; observing a release never authorizes a patch. Reports retain at most 20 manual release summaries per new ecosystem while retaining observation history. Offline mode uses a validated cache if available and marks freshness unverified; without a cache, no live evidence is claimed. Historical Node/Python recipe evidence remains bundled independently.

Official package identifiers and sources: [Go](https://github.com/stripe/stripe-go), [Java](https://github.com/stripe/stripe-java), [.NET](https://github.com/stripe/stripe-dotnet), [PHP](https://github.com/stripe/stripe-php), [Ruby](https://github.com/stripe/stripe-ruby).

## Controlled evaluation

Run `node scripts/polyglot.mjs` to create a temporary eight-language repository, discover its projects, plan eight expected edits (one per language), dry-run, verify in each affected directory, apply and check idempotence. Installed-package smoke checks run the same scenario through the standalone installed CLI. In this controlled fixture, verifiers use Node assertions over expected output text. Native Go/Java/.NET/PHP/Ruby compilers and SDK packages are not executed, and asserted fixture versions are synthetic. The recipes are workflow-tested but still need real-SDK/compiler integration tests before claiming broader runtime compatibility. The separate real Stripe TypeScript application test remains in CI.

Regression coverage includes all five native recipe guards, pre-cutoff version refusal, comments and string exclusions, missing/failed unit verification, preserving other project source after failure, nested-project exclusion, traversal rejection, honest unresolved versions, correct per-language evidence, and ecosystem cache/observation reuse. This is controlled evaluation with zero independent participants; broad compatibility and additional automatic recipes require their own evidence and behavioral tests.
