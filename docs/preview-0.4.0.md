# Changelume 0.4.0-rc.1: application repair preview

This remains a controlled private evaluation with zero independent participants. Public publication and independent maintainer feedback remain release gates.

## Reproduce the application repair

Use Node 24, Git and npm. Install workspace dependencies and build. Run `node scripts/application.mjs`. Set CHANGELUME_NPM_CLI to npm/bin/npm-cli.js when npm is not installed beside Node.

The runner creates a complete temporary TypeScript application with real stripe@11.18.0 and stripe@12.0.0 installations. Customer creation, successful payment and card-decline handling run through the SDK's request and error parsing with a custom HTTP transport returning controlled JSON responses. No Stripe account, credentials or vendor requests are used. It first checks the old SDK, reproduces the obsolete constructor failure with SDK 12 and unchanged source, then performs the Changelume upgrade. Verification installs the target from its lockfile and checks four mocked requests, customer ID, amount, successful payment and decline handling. Dry-run preserves source and manifests; accepted second plans have zero edits. Results are written to .changelume/application-result.json.

## Explicit upgrades

Add `upgrade: {from: '11.18.0', to: '12.0.0'}` to changelume.yml. This first supported upgrade requires an exact source manifest pin and matching npm v3 lockfile, unchanged SDK dependency requirements, complete dependency entries, and no workspaces or nested Stripe installations. It replaces only the Stripe package record and root dependency declarations; unrelated dependencies remain unchanged. The target metadata and integrity come from the committed real-SDK integration lockfile. Unsupported transitions fail with a manual-planning message.

Plan reports include the target and unresolved API changes. Migration updates source, package.json, package-lock.json and the acceptance baseline in the existing recoverable transaction. Configure installation and behavioral verification; CLI upgrade application refuses skipped or failed verification. Action publication still requires passed verification. SDK upgrades have a separate PR identity from source-only cleanup. This does not establish general Stripe API compatibility and does not upgrade the account or webhook API version. Python dependency upgrades remain unsupported.

## Application structure

Selected relative named imports of exported const clients and simple exported functions returning a new Stripe client can now authorize inline customers.create request-option repairs. Bindings are traced by declaration identity. Mutated or escaped clients and factories decline linked edits. Re-exports, arbitrary wrappers and dynamic resolution remain unsupported. Discovery still reports the broader flow for manual review.

Python can repair the two Stripe 5 OAuth exception spelling errors inside ordinary functions. Shadowed arguments/imports/assignments, exception bindings, pattern bindings, root escapes and attribute mutations cause conservative refusal. Selected-file ambiguity can still decline the whole Python project. Use Python 3.10+; the current recipe does not imply general Python or Stripe support.

## Monitoring proposals

Run `changelume proposal --offline --json`, or scan normally. .changelume/proposal.json records current and target versions, newer observed releases, available supported transition, affected locations, repair recipes, source hashes, unresolved review items and verification outcome. It suggests the supported route for installed 11.18.0; other observed releases stay manual. Verification state is preserved for unchanged proposals. CLI and Action publication record the PR URL. `changelume proposal --offline --refresh-pr` refreshes open/closed/merged state, draft flag and head SHA using GITHUB_TOKEN. Remote PR status is refreshed explicitly. The scheduled analysis artifact contains the proposal alongside queue.json and report.md; cache history remains disposable.

## Stronger evaluation and honest limits

`node scripts/evaluation.mjs` evaluates eight additional controlled projects, including two aliases, shared clients, factories, mutations, unrelated code, ordinary Python functions and shadowing. It matches individual repairs against explicit file/line/symbol references and independently expected edited-content hashes. Results include missed references, unexpected repairs and incorrect edits. False-warning measurement currently covers only the unrelated-object control; other warnings are unscored. These cases were authored as an additional development suite, not an independent blind holdout.

Machine-readable results are published beside this document. The application report separately measures a real behavioral failure and repair. Zero errors in these cases does not establish population-level accuracy. Broader API changes, additional upgrade pairs, more package managers, independent repositories and maintainer feedback remain open coverage limits.
