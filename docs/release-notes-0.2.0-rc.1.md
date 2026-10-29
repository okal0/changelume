# 0.2.0-rc.1 candidate

Adds an evidence-bound review queue and acknowledgements separate from accepted migrations; doctor diagnostics; named Stripe imports; five legacy request-option rename rules; closed-PR protection; an installable standalone archive with checksums and complete examples; and a six-repository controlled beta harness.

Request-option coverage is deliberately limited to inline `customers.create(params, options)` on unescaped const local clients, SDK 10/11/12. Ambiguous spreads, collisions, computed properties, variable options, and unrelated clients are declined. Constructor cleanup still supports SDK 11/12 and distinguishes ESM from CommonJS applicability. Client factories and cross-file flows require manual review; they are not advertised as supported.

Upgraded YAML to 2.8.3 after the dependency review identified a nested-collection stack-overflow advisory in 2.8.1. This patch is included in the bundled CLI and Action.

Compatibility: Node 24, npm customer lockfiles, TypeScript source, existing YAML configuration and schema-1 baselines. New human review state is a separate `changelume.review.json`; commit it independently. Existing branches are never force-updated. Closed unmerged migration PRs now require explicit human inspection rather than being reported as successful publication.

Candidate gates: strict checking, meaningful regression tests, real historical SDK parsing/runtime tests, controlled synthetic beta, clean-prefix archive installation, bundled Action workflow, and cross-platform CI. Human usability feedback remains future work by the user's choice of controlled fixtures for this iteration. No packages or public release are automatically published.
