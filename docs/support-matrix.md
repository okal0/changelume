# Exact support and limitations

| Area | Supported | Reported or declined |
| --- | --- | --- |
| Language | `.ts` and `.tsx` local lexical bindings | Cross-file data flow, JS, generated files, wrappers, exported client propagation |
| Package evidence | Root npm package.json and package-lock v1/v2/v3; explicit override | Nested Stripe versions, pnpm/yarn customer locks, unverifiable versions |
| Imports | Runtime default `import S from 'stripe'`, including aliases | Named, namespace, type-only, CommonJS and dynamic imports |
| Recipe | `new S.Stripe(...)` / `new S.default(...)` → `new S(...)` for resolved SDK 11/12 | Computed access, non-constructor alias use, missing version, other majors |
| Client inventory | Direct local variable initialized with `new S(...)` or supported alias | Factory wrappers and escapes |
| Method inventory | customers, paymentIntents, charges, checkout.sessions create/retrieve/list/update/del on traced clients | Other methods explicitly marked unsupported; method inventory is not migration coverage |
| Field inventory | Constructor aliases, literal request `apiVersion` | Arbitrary response fields and indirect options objects |
| Versions | SDK resolved version, literal client/request API versions, webhook configuration override | External account and endpoint versions unknown; webhook call locations do not establish endpoint versions |
| Upstream | Official changelog Markdown release headings and fixed historical recipe | All other changes unclassified |
| Patching | Tracked regular files, allowed paths, hashes, size limits, no symlinks | Workflow/config edits, credentials recognized by heuristics, dirty trees |
| LLM | OpenAI SDK with explicit model/key environment name and strict bounds | General autonomous edits or shell tools |
| PRs | Octokit create, stable duplicate detection, draft on skipped checks | Auto-merge, force-update of existing branches, account changes |

For Stripe 12 the removed constructor is confirmed impact. For Stripe 11 this is possible future impact and a preparatory source cleanup; dependency versions remain unchanged. An unknown API version is possible impact independently of constructor repair. “No detected impact” means within this table's supported analysis only.

The demo does not install Stripe or perform vendor integration tests. Local candidate checkouts do not inherit node_modules. Configure dependency installation explicitly if needed. Symlinked source files are not traversed; hard links, complex monorepos, response data flow, and arbitrary secrets are not comprehensively analyzed. No claim of complete integration discovery is made.
