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

The original validation above used mocked publication and the synthetic offline fixture. The following follow-up supersedes those original validation limitations. No package, release, paid LLM request, or vendor account/API operation was performed.

## Roadmap milestones 1–4 follow-up

- Local strict type checking, build, and **45 tests passed**. Added coverage for observation history versus acceptance, retained unresolved releases, cache reuse/expiry/corruption, changed source format, disabled vendors, module-mode applicability, alternate constructor mutations, startup errors, timeouts, excessive output, known environment-secret redaction, rollback after a simulated replacement failure, cleanup failure with report preservation, and actionable Action integrity errors.
- [Linux and Windows CI](https://github.com/okal0/changelume/actions/runs/40940100652) passed on implementation commit `adb8574`. Both jobs ran strict checks, packaged Action tests, bundle reproducibility checking, the offline demo, and the real-SDK integration. A discovered pnpm path-comment difference between Windows and Linux was normalized in the build output.
- `node scripts/integration.mjs` passed locally with actual `stripe@11.18.0` and `stripe@12.0.0`, TypeScript 5.9.3, and a complete npm lockfile. Native ESM reproduced the original constructor failure and validated the migrated constructor. CommonJS aliases remain functional. Historical declarations permit the removed ESM alias, so before-source type checking passes even when runtime fails. No Stripe requests were made. Dry-run preserved source and the accepted second plan proposed zero edits.

### Live private consumer evidence

The user-authorized [private test repository](https://github.com/okal0/changelume-consumer-test) contains a vendored Action and real-SDK consumer fixture. Run links require repository access.

| Scenario | Evidence | Result |
| --- | --- | --- |
| Publication interrupted after branch creation | [First attempt](https://github.com/okal0/changelume-consumer-test/actions/runs/40939023984/attempts/1) | Analysis and verification passed. GitHub rejected PR creation because Actions PR permission was disabled; generated branch remained |
| Safe retry with intact generated branch | [Second attempt](https://github.com/okal0/changelume-consumer-test/actions/runs/40939023984/attempts/2) | After enabling Actions PR creation in the test repository, retry succeeded and created [draft PR #1](https://github.com/okal0/changelume-consumer-test/pull/1) |
| Duplicate prevention | [Repeat run](https://github.com/okal0/changelume-consumer-test/actions/runs/40940131161) | Succeeded with exactly the same PR and head commit `8ca4b3ec8acc72496b0e0f193019e274c8a6da00`; no duplicate or branch overwrite |
| Base branch moved after workflow revision capture | [Stale-base run](https://github.com/okal0/changelume-consumer-test/actions/runs/40940342864) | Analysis and verification passed; publication rejected the changed base and created no PR for the stale candidate |
| Deliberate verification failure | [Failure-gate run](https://github.com/okal0/changelume-consumer-test/actions/runs/40940741407) | npm installation and type checking passed; fixture verifier exited 9; publication was skipped. Downloaded report retained `Intentional verification failure for publication-gate validation` |
| Restored passing consumer with persistent observations | [Final consumer run](https://github.com/okal0/changelume-consumer-test/actions/runs/40940935328) | All three jobs passed and created [draft PR #2](https://github.com/okal0/changelume-consumer-test/pull/2) for the new analyzed revision. Downloaded analysis report showed zero newly observed releases after cache restoration |

PR #1 was checked through the GitHub API: its only changed paths are `src/index.ts` (one constructor expression) and `changelume.lock.json`. Nothing was merged. Verification runs on a separate runner with no project secrets or write token, stripped child environment, and non-persisted checkout credentials; the real-SDK verifier asserts publishing/LLM credentials are absent. Publication does not run customer scripts.

PR #2 was also checked through the API and contains the same two permitted paths only. It corresponds to a different analyzed revision, not a duplicate of PR #1. The deliberately failing fixture was restored before the final successful run. Latest implementation/test follow-up CI: [45-test cross-platform run](https://github.com/okal0/changelume/actions/runs/40941135354).

### Remaining limits

Coverage remains the one documented constructor cleanup. Real-SDK tests establish the selected ESM/CommonJS behaviors; they do not establish overall Stripe API compatibility. Observation history is disposable and resets if local state or Actions cache is removed. Output redaction is heuristic. Rollback handles caught replacement errors, while a hard process termination may require using the preserved recovery manifest. Additional vendors, general LLM edits, package publication, and milestone 5 are outside this work.

## 0.2.0-rc.1 product iteration

The prior coverage limits are expanded by five explicit legacy request-option rename rules and inventory-only tracing of simple exported clients/factories. All other unsupported flows still require manual review. See the updated support matrix and private beta guide.

- Strict checking, build, and 57 regression tests passed locally. New coverage includes all five option spellings, ambiguity refusal, acknowledgement/evidence invalidation, closed-unmerged PR refusal, cross-file client/factory discovery, and constructor mutation in another source file.
- Six separate controlled Git repositories passed the beta harness: affected ESM alias, unaffected CommonJS direct constructor, legacy options, mutated constructor, ambiguous options, and named import. Expected edits matched in all six. Dry-run preserved source, application matched manually specified expected source, verification passed on affected cases, and second plans proposed zero edits. These are synthetic evaluations with zero independent participants, as requested by the user.
- The installable npm tarball was installed into a clean local prefix and the same scenarios passed through the installed standalone executable. No development dependencies or source workspace imports are required by the installed CLI. Candidate archives include complete offline and real-SDK examples, documentation, license notices, and SHA-256 checksums.
- Real installed Stripe 11.18.0/12.0.0 tests passed for constructor runtime behavior and legacy/new request-option parsing. No vendor API operations were called.
- The dependency audit identified the YAML 2.8.1 stack-overflow advisory; YAML was upgraded to 2.8.3. A subsequent pnpm audit reported zero known vulnerabilities at evaluation time. This is a point-in-time advisory check, not a security guarantee.
- [Live beta consumer run](https://github.com/okal0/changelume-consumer-test/actions/runs/40943958765) passed analysis, real-SDK installation/type checking/verification, and publication. [Draft PR #3](https://github.com/okal0/changelume-consumer-test/pull/3) contains only `src/index.ts`, `src/options.ts`, and the accepted baseline. Its earlier [failed fixture run](https://github.com/okal0/changelume-consumer-test/actions/runs/40943672730) preserved a constructor-configuration compiler error and correctly skipped publication; the fixture was corrected before the successful run.

Human usability feedback and public/package release remain explicit gates. No release or package was published. Closed test PRs are not automatically reopened and no test PR was merged.

## 0.3.0-rc.1 controlled evaluation

- Strict type checking and build passed; 66 tests passed, including adjacent setters, unsafe relocation refusal, persistent monitoring timestamps, Python candidate verification and draft publication with an injected client, and open-PR reuse across revisions.
- Twelve controlled benchmark cases report zero incorrect edits, missed affected cases or unnecessary located warnings under the case-level definitions in preview-0.3.0.md. No independent participants.
- Live Python analysis, real stripe==5.0.0 installation, verification and publication passed in [consumer run](https://github.com/okal0/changelume-consumer-test/actions/runs/41076062412), creating [draft PR #4](https://github.com/okal0/changelume-consumer-test/pull/4). No vendor requests and no merge. The preceding failed run caught an incorrect OAuth namespace in the initial implementation; verification blocked publication before the correction.
- Python online release monitoring remains outside this preview; its evidence is the fixed historical v5 changelog. TypeScript recurring monitoring continues to fetch current releases.

- Installed 0.3.0-rc.1 archive passed the six-case beta and twelve-case benchmark. Real Node SDK integration passed constructor, legacy-option and all three new configuration-option checks against 11.18.0/12.0.0.
