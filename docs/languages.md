# Language and multi-project support (0.5.0-rc.1)

Changelume discovers and reviews eight programming languages. Automatic migrations exist only for the documented TypeScript, JavaScript and Python Stripe recipes. Other adapters are inventory and lexical-review capabilities, not automatic migration engines.

| Language key | Dependency inputs | Automatic edits | Release monitoring |
| --- | --- | --- | --- |
| typescript | package.json, package-lock.json | Existing constructor, option and selected setter recipes; selected explicit upgrade | Stripe Node |
| javascript | package.json, package-lock.json | Same syntax/binding engine for ESM .js/.jsx/.mjs; CommonJS require remains manual | Stripe Node |
| python | requirements.txt; literal pyproject.toml declarations | Documented Stripe 5 OAuth spelling corrections; exact requirements pin required | Stripe Python |
| go | go.mod | None; lexical SDK references require review | Stripe Go |
| java | pom.xml, build.gradle, build.gradle.kts | None; qualified com.stripe references require review | Stripe Java |
| csharp | .csproj, packages.lock.json | None; lexical SDK references require review | Stripe .NET |
| php | composer.json, composer.lock | None; lexical SDK references require review | Stripe PHP |
| ruby | Gemfile, Gemfile.lock | None; lexical SDK references require review | Stripe Ruby |

Go module declarations and Java manifest versions do not establish installed versions. Go minimum-version selection/replacements, Maven/Gradle variables and transitive resolution, conditional MSBuild imports, multiple C# project files per directory, central package management, dynamic Gemfiles and Python lockfile formats require manual review. C# conflicting framework lock versions stay unknown. PHP and Ruby locked versions are distinguished from manifest ranges. Python AST analysis requires a trusted Python 3.10+ interpreter outside the Git repository; PATH lookup ignores the project working directory and child environments omit credentials. No Go/Java/.NET/PHP/Ruby toolchain is required for inventory; configured verification requires the relevant tools installed by the user.

## Get started

Use Node 24 and Git. Run `changelume languages --json` for machine-readable capabilities. Run `changelume discover --json` from the repository to list project units. `changelume init --workspace` creates an auto-discovery configuration. `changelume init --language go` creates a single-language configuration; use a recognized key from the table.

`projects: auto` enables combined inventory, plans and reports. It never selects or runs verification commands automatically. Before migrating, replace auto with explicit project entries and configure trusted commands for every unit receiving edits. For example:

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
```

Use `path: .` for a root unit. Include/exclude globs are relative to the unit. Nested discovered or explicitly configured units are excluded from their parent. Hidden paths, traversal, symlinks and overlapping edited files are refused. Generated/dependency directories are skipped. Discovery is bounded to 50 units and 30,000 directory entries. Binary assets are not parsed as manifests. Mixed JS/TS npm projects use the TypeScript adapter, which includes JS source; separate npm projects are discovered independently. Projects without recognized manifests can be listed explicitly.

Each unit has its own dependency inventory and scoped verification. Reports combine affected locations with repository-relative paths; project metadata retains source evidence and release observations per ecosystem. Aggregated release IDs are prefixed with node/python/go/etc., avoiding collisions across SDKs. Unknown SDK impact stays manual.

Migration verifies every edited unit in its own directory, generates one combined patch, and applies it through the existing recoverable transaction. A failed or missing verifier prevents application/publication. Large PR descriptions are shortened with explicit unresolved counts and a pointer to the full analysis report. Source acceptance uses the repository's single changelume.lock.json. Unit-local observation or acceptance files are not created. Put explicit upgrade from/to configuration on the relevant unit; root-wide upgrades and LLM edits are refused for multi-project runs. Only one edited adapter/upgrade may own a file.

## Monitoring evidence

Online scans fetch each language's official Stripe SDK changelog with bounded requests, validated source hashes and per-ecosystem caches/observation history. Repeated unchanged scans do not label the same releases newly observed. Native changelog entries remain unclassified; observing a release never authorizes a patch. Reports retain at most 20 manual release summaries per new ecosystem while retaining observation history. Offline mode uses a validated cache if available and marks freshness unverified; without a cache, no live evidence is claimed. Historical Node/Python recipe evidence remains bundled independently.

Official package identifiers and sources: [Go](https://github.com/stripe/stripe-go), [Java](https://github.com/stripe/stripe-java), [.NET](https://github.com/stripe/stripe-dotnet), [PHP](https://github.com/stripe/stripe-php), [Ruby](https://github.com/stripe/stripe-ruby).

## Controlled evaluation

Run `node scripts/polyglot.mjs` to create a temporary eight-language repository, discover its projects, plan three expected edits, dry-run, verify in each affected directory, apply and check idempotence. Installed-package smoke checks run the same scenario through the standalone installed CLI. Source verification uses Node assertions on expected fixture text. Go/Java/.NET/PHP/Ruby runtimes and SDKs are not executed, and fixture dependency versions are synthetic test data. The separate real Stripe application test remains in CI.

Regression coverage includes missing/failed unit verification, preserving other project source after failure, nested-project exclusion, traversal rejection, honest unresolved versions, correct per-language evidence, and ecosystem cache/observation reuse. This is controlled evaluation with zero independent participants; broad compatibility and additional automatic recipes require their own evidence and behavioral tests.
