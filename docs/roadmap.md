# MVP next steps

Prioritize proving the existing migration in a real consumer repository before expanding coverage.

Milestones 1–4 have been implemented and exercised. See [validation evidence](validation.md) for live private-consumer runs, cross-platform CI, real-SDK results, and explicit limitations. Milestone 5 remains future work; no package or release has been published.

## 1. Validate the GitHub Action end to end

Use a separate private test repository containing a reproducible affected TypeScript application and a complete npm lockfile. Vendor the reviewed Action distribution and configure explicit installation, type checking, and tests in the unprivileged verification job. Run workflow_dispatch on its default branch.

Acceptance: analysis artifacts bind to the analyzed commit; verification receives no project secrets or write token; publication creates a draft PR containing only expected source/baseline edits. Repeat the run to confirm duplicate prevention. Exercise verification failure, base-branch movement, and retry after PR creation failure. Preserve workflow-run links as validation evidence. Creating this test repository is a separate, explicitly authorized task.

## 2. Add a real installed-SDK integration fixture

Keep the fast offline fixture. Add a separate integration fixture with a complete package-lock.json and actual Stripe SDK dependencies. Demonstrate the obsolete constructor behavior and corrected behavior against supported SDK versions using test keys without network requests. Run type checking where the historical package typings permit the selected source pattern; report any typing/runtime distinction explicitly.

Acceptance: migration behavior is verified against the real SDK, unrelated behavior is preserved, and a second migration produces no source edits. Document exactly which historical versions and module settings were tested.

## 3. Make monitoring useful across repeated runs

Separate disposable last-observed source state from accepted migration state. Retain unclassified changes for review without labeling every historical release newly observed on every scan. Never advance accepted baselines merely by scanning. Add cache, stale-source, disabled-vendor, and changed-format regression tests.

Acceptance: a second unchanged scan reports no newly observed releases; a new release appears once as newly observed while its unresolved classification stays visible; migration acceptance remains a separate operation.

## 4. Harden consumer operation and diagnostics

Add Linux CI coverage for the packaged Action and Windows CLI coverage. Exercise oversized verification output, command startup errors, timeouts, environment-secret redaction, mutation through alternate bindings, and interrupted publication. Improve actionable Action error messages while suppressing secrets. Review local multi-file application recovery and preserve actionable reports if temporary-checkout cleanup fails.

Acceptance: documented setup works from a fresh consumer checkout; failed commands leave bounded useful diagnostics; failures cannot turn into passed checks or overwrite human edits.

## 5. Prepare an early release

After the preceding gates pass, update the support matrix and validation record with live evidence, provide a minimal consumer example, and document a reviewed commit pin for remote Action installation. Add a reproducible distribution check to CI and review dependency/security updates. Package publication and release creation require their own explicit request.

Defer additional vendors, broad LLM-generated migrations, and new migration recipes until the existing vertical slice passes these gates. Select the next Stripe recipe only after researching an official change with a deterministic transformation and realistic before/after fixtures.
