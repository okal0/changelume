# GitHub Actions installation

The repository includes a runnable three-job workflow in `.github/workflows/changelume.yml`. It is a scheduled/default-branch workflow with manual dispatch, not a GitHub App. In this project it normally produces no candidate because this project does not depend on Stripe.

To use it in another repository without publishing Changelume:

1. Copy `action.yml` and the complete committed `dist/` directory into `.github/actions/changelume/` in the customer repository. Review and commit that vendored distribution. It needs no consumer build or dependency installation.
2. Copy `.github/workflows/changelume.yml` into the customer's workflows. Replace all three `uses: ./` entries with `uses: ./.github/actions/changelume`.
3. Add and commit `changelume.yml` with explicit verification commands and the correct `pr.base`. Add `.changelume/` to `.gitignore`. The default is a draft PR.
4. Enable Actions and allow GitHub Actions to create pull requests in repository Settings → Actions → General → Workflow permissions. Organization policy may restrict this. The publisher requests `contents: write` and `pull-requests: write`; other jobs use read access only.
5. Run workflow_dispatch from the trusted default branch. Review artifacts and the migration PR.

Alternatively, after hosting this repository yourself, use `owner/changelume@REVIEWED_FULL_COMMIT_SHA`. No external repository or release is assumed to exist. Keep generated bundles and source changes in the same reviewed commit; project CI detects bundle drift.

## Job separation

Analysis runs no customer scripts and receives no LLM key. It records the analyzed commit and immutable artifact digests in job outputs. Download-artifact uses a fixed artifact name from this workflow run; there is no cross-run or pull-request artifact ingestion. Verification uses a separate runner, checks revision and digests, regenerates the deterministic candidate, and runs only configured commands. It receives no LLM key, write token, or project secrets. Checkout credentials are not persisted. Do not add secrets to verification steps or run this workflow on privileged pull-request events.

Publication uses another fresh checkout at the analyzed commit, downloads the original analysis artifact, validates its digest, regenerates the expected patch, and compares exact edits. It takes passed verification and the verified patch digest from the verification job outputs. It does not execute customer commands. A failed or skipped verification prevents automated publication. Artifacts are data, never executable patches. Never edit the workflow to accept arbitrary artifacts, revisions, or verification statuses from untrusted dispatch inputs.

The publishing-stage PR report is regenerated from the bundled historical recipe evidence. Full online observation evidence remains in the original analysis artifact. This keeps publication deterministic without trusting downloaded plan text as instructions or refetching mutable upstream content.

Local `--publish-pr` may create a draft when verification was skipped. The automated example is stricter and requires passed checks. A human still reviews and merges. Existing migration branches are not overwritten, even when a PR is closed; delete or manage obsolete branches manually if you want to restart the same revision.

## GITHUB_TOKEN behavior

Checked against [official GitHub documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) on 2026-10-29: token-triggered push events do not launch downstream workflows. GitHub currently documents that PR opened/synchronize/reopened events produced using GITHUB_TOKEN create workflow runs requiring approval by a user with write access; workflow_dispatch and repository_dispatch also remain exceptions. Other token-triggered events do not start workflows. Repository/enterprise feature availability may differ. Review the PR's workflow banner rather than assuming CI ran automatically. No PAT is required by this setup.

Third-party Action pins were verified with `git ls-remote` against upstream tags: checkout v4.2.2 (`11bd719...`), setup-node v4.4.0 (`49933ea...`), upload-artifact v4.6.2 (`ea165f8...`), download-artifact v4.3.0 (`d3f86a1...`). Update pins through reviewed changes. The Changelume action itself uses the Node 24 runner runtime; use current GitHub-hosted runners or a self-hosted runner that supports `node24` actions.

The analysis job also uses verified actions/cache v4.2.3 (`5a3ec84...`) for disposable observation history and source cache. Each trusted default-branch run saves a new cache generation. Accepted migration state stays in the repository baseline, outside this cache. Deleting/evicting the cache resets what counts as newly observed without accepting any migration. Analysis does not restore source-containing candidate bundles from this cache.

Mocked API tests cover publication and duplicate prevention; local process tests cover Action stage artifact validation. Live private-consumer workflow runs, including draft PR creation, safe retry, duplicate prevention, and failure gates, are linked in [the validation record](validation.md).

## Persistent queue

Cache .changelume/monitor/ alongside observations and sources. Download changelume-candidate for queue.json and report.md; summaries show pending items even without a patch. Commit changelume.review.json for persistent acknowledgements. See [monitoring semantics](preview-0.3.0.md).
