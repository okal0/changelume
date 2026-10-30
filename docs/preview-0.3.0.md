# Changelume 0.3.0-rc.1 preview

Private controlled evaluation. Independent maintainer feedback remains a release gate. No npm registry publication is performed.

## Getting started

Use Node 24 and Git. Install the archive with `npm install --global ./changelume-0.3.0-rc.1.tgz` after checking SHA256SUMS. Copy the installed package's examples/offline into a fresh Git repository and commit it. Run `changelume plan --offline`, then `changelume migrate --offline --dry-run`. Inspect .changelume/report.md, migration.patch and queue.json. Apply with `changelume migrate --offline`.

Python: copy examples/python instead. Install Python 3 and put python on PATH, or set pythonCommand in changelume.yml. Select language: python and include src/**/*.py. Analysis parses AST without importing customer modules; configured verification commands execute trusted customer code.

## Exact support boundaries

TypeScript retains the existing constructor and inline customers.create option recipes. Three new migrations move setTimeout(number), setMaxNetworkRetries(number) and setTelemetryEnabled(boolean) into constructor options. Requires one const declaration, a directly imported constructor with exactly one argument, and an immediately following standalone setter with a literal value. Existing options, nonadjacent calls, dynamic values, unknown SDK versions, nested installations and constructor escapes decline edits. SDK majors 10 through 12 are eligible. Evidence: bundled official Stripe Node v11 changelog, removed setters (#1597).

Python supports only the OAuth exception spelling corrections UnsupportedGrantTypError to UnsupportedGrantTypeError and UnsupportedResponseTypError to UnsupportedResponseTypeError under stripe.oauth_error. Requires one exact stripe==4.x.y or 5.x.y requirements.txt pin and top-level import stripe with optional alias. Scopes, module escapes and mutations decline edits. Other package managers, from-imports and current SDK majors are unsupported. Evidence: bundled official Stripe Python v5 changelog (#872).

Language is explicitly selected per run. Both adapters return inventory and edits; candidate creation, verification, baseline acceptance, artifact integrity and publication are shared. No dependency or API-version upgrade is performed. The example Python verifier checks expected source and syntax; the controlled live consumer additionally installs the real SDK.

## Benchmark

Run `node scripts/benchmark.mjs`. Twelve separate Git fixtures cover aliases, three setters, unrelated code, mutation, nested SDK versions, shared clients, factories, unsafe setter relocation, Python correction and Python shadowing. Each checks expected edits, dry-run preservation, exact applied source, verification and idempotence. Results: .changelume/benchmark.json.

The first run reported zero incorrect edits, missed affected scenarios or unnecessary located warnings. These are synthetic case-level measurements with zero independent participants. Incorrect edits includes missing expected edits; missed usages means an affected case produced no located finding. Global release/manual notices are excluded from unnecessary-warning counts. This is not symbol-level recall or evidence of general SDK compatibility. Cross-file cases intentionally require manual review.

Windows and Linux CI run the benchmark and installed-package smoke checks. Packaging uses npm pack without publication and emits SHA256SUMS. Set CHANGELUME_NPM_CLI to npm/bin/npm-cli.js if necessary.

## Recurring monitoring

The scheduled workflow retains .changelume/monitor/, source cache and observations through Actions cache. Download changelume-candidate for queue.json and report.md even when no migration is available. Queue items include stable identity, evidence, affected location, acknowledgement, firstSeen and lastSeen. Cache eviction resets first-seen history; committed changelume.review.json preserves human acknowledgements. Changed evidence invalidates acknowledgement. Acknowledging never accepts a migration.

The job summary reports new releases, pending items and proposed files. Existing revision PRs are reused. An open PR for the same recipe/base also prevents duplicates after unrelated base commits; its contents are preserved for human review. Closed unmerged revision PRs require human resolution. No hosted dashboard or notification service is included.

Python release monitoring uses fixed historical evidence in this preview; online recurring release discovery currently applies to TypeScript. Machine-readable controlled results are in benchmark-results-0.3.0.json.
