# Security

This is an early MVP. Review source, configuration, artifacts, and proposed migrations before running checks or merging. Verification commands execute code with your OS user's capabilities; environment stripping and temporary checkouts are not a security sandbox. Use isolated, disposable CI runners with no project secrets. Never give a verification job publishing credentials.

Discovery does not install or execute customer dependencies. Online monitoring sends requests to official Stripe source URLs; it does not send customer source. Optional LLM assistance sends previewed affected source only when explicitly requested, to the configured OpenAI provider. Do not store credentials in source/configuration. Credential recognition is heuristic, so review the exact context before supplying its hash. Patches and candidate bundles contain affected source and should be treated as private repository artifacts. Do not upload them publicly.

Edits are constrained by allowed paths, canonical containment, symlink rejection, size limits, revision/file hashes, and recipe equivalence. Config/workflow edits from the LLM are rejected. GitHub publishing creates a bounded tree via API without executing candidate code. Only reviewed default-branch workflows should call the publishing stage. Existing branches are never force-updated and PRs never auto-merge.

To report a vulnerability, use the hosting repository's private vulnerability reporting feature if enabled, or contact its maintainers privately. This unhosted distribution has no public security mailbox; do not invent one or file secrets in a public issue. Include a minimal synthetic reproduction and affected commit.
