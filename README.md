# Changelume

An early, Apache-2.0 MVP that monitors Stripe SDK releases, locates supported TypeScript usages, and prepares reviewable migration patches or GitHub pull requests. It runs locally or in your GitHub Actions runners. There is no service, database, account, or dashboard.

**Coverage is deliberately narrow:** Stripe 11/12 default imports used as `new Stripe.Stripe(...)` or `new Stripe.default(...)` become `new Stripe(...)`. Import aliases are supported. The aliases are removed from the Stripe 12 ESM build; CommonJS retains them and historical typings still accept them. This is the constructor-alias removal documented in the [Stripe v12 SDK changelog](https://github.com/stripe/stripe-node/blob/v12.0.0/CHANGELOG.md). It is not a general Stripe migration engine. No dependency upgrades, API-version changes, webhook changes, or account modifications are automated.

## Install and validate

Use Node.js 24 LTS and pnpm 11.25.0. From this checkout:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

The committed `dist/cli.cjs` and `dist/action.cjs` contain their runtime dependencies and official offline snapshot. They need Node 24, Git, and no build step in a consumer repository. Use `pnpm exec changelume` in this workspace, or run `npm link` in this checkout to expose `changelume` globally. Alternatively, use `node /absolute/path/to/changelume/dist/cli.cjs` directly. Packages have not been published to a registry.

## Offline demonstration

`pnpm demo` creates a new Git repository under `.demo/run-*` and runs **scan → plan → dry-run → migrate → verification**. It checks that dry-run leaves the original source intact. Reports and a zero-context patch remain under that demo's `.changelume/` directory. The example lockfile is a minimal resolved-version inventory fixture, not a complete installable Stripe dependency graph. Its verification asserts the transformation and preservation of unrelated code; it does not contact Stripe or claim integration tests passed.

## Your repository

```sh
changelume init --cwd /path/to/project
# Configure verification and commit changelume.yml first.
changelume scan --cwd /path/to/project --offline
changelume plan --cwd /path/to/project --offline --json
changelume migrate --cwd /path/to/project --offline --dry-run
changelume migrate --cwd /path/to/project --offline
```

All commands accept `--cwd`, `--config`, `--json`, and `--offline`. A Git commit is required for analysis. Scans and plans write reports/cache only, never source or the accepted baseline. Migrations reject dirty working trees (disposable `.changelume/` output is excluded; tracking this directory is rejected). Add `.changelume/` to your `.gitignore`.

Normal migration applies the exact reviewed candidate locally after configured checks. Failed verification leaves the patch/report and leaves source unchanged. With no commands, verification is explicitly skipped. `--publish-pr --repository owner/repo` publishes instead of applying locally; it requires `GITHUB_TOKEN`. Skipped checks force a draft PR. The automated workflow requires passed checks. No PR is auto-merged. Existing migration PRs are reused, never overwritten, including human changes.

`changelume.lock.json` records acceptance of this recipe only when its migration patch is applied/merged. Merely observing releases does not accept their changes. Accepted recipes are rechecked for regressions rather than silently suppressed.

## Example configuration

```yaml
vendors:
  stripe:
    enabled: true
    # sdkVersion: '12.0.0' # Explicit override; reported as such
    # requestApiVersion: '2022-11-15'
    # webhookVersion: '2022-11-15'
include: ['src/**/*.ts', 'src/**/*.tsx']
exclude: ['**/node_modules/**', '**/*.d.ts']
verification:
  - command: node
    args: ['scripts/verify-migration.cjs']
    timeoutMs: 120000
sources:
  timeoutMs: 10000
  retries: 2
pr:
  base: main
  draft: true
```

Verification commands execute customer code. A temporary checkout and stripped environment are **not a sandbox**. Configure only trusted commands; use ephemeral isolated runners. No dependencies or customer scripts are executed during discovery. For verification requiring dependencies, explicitly configure an install command and subsequent tests. Use a native executable (`node`) for portable Windows verification; shell and `.cmd` commands are not implicitly interpreted.

## Optional OpenAI assistance

Deterministic operation requires no LLM or credentials. To enable assistance, configure `llm.enabled: true`, `llm.provider: openai`, `llm.model` with your chosen model, and `llm.apiKeyEnv: OPENAI_API_KEY`. Optional limits: `maxRequests` (default 1), `retries` (0), `maxInputTokens` (4000), `maxOutputTokens` (2000), `timeoutMs` (30000). The key is read only from the environment and the SDK uses its default OpenAI endpoint.

```sh
changelume plan --offline --inspect-llm-context
changelume migrate --offline --dry-run --llm --context-hash HASH_FROM_PREVIEW
```

The preview contains selected affected source files, allowed paths, revision, and evidence; inspect it before authorizing transmission. Files with recognized credential literals are rejected; use environment references and inspect for other sensitive content. Input token budgeting uses UTF-8 bytes plus an overhead allowance as a conservative bound. Output must satisfy a strict schema, canonical path/hash/size checks, and match the deterministic recipe. This MVP uses LLM assistance as a constrained corroboration path, not as a general code-repair agent. It has no shell tools. Live provider calls are opt-in and were not used in automated tests.

See [GitHub Actions setup](docs/github-actions.md), [capabilities](docs/support-matrix.md), [architecture](docs/architecture.md), [recipe contributions](docs/recipes.md), and [security](SECURITY.md).

For real installed-SDK validation, run `node scripts/integration.mjs` after building. This separate test requires npm registry access for explicit dependency installation. It verifies Stripe 11.18.0 and 12.0.0 in native ESM and checks the CommonJS compatibility distinction; no Stripe API requests are made. See the [fixture documentation](fixtures/integration/README.md).

Repeated scans track observed releases in disposable `.changelume/observations/` files, separately for online and offline sources. Unclassified changes remain in reports after observation. Clearing these files resets observation history without accepting any migration. The example Action workflow preserves this history with a trusted default-branch Actions cache.
