# Contributing

Use Node 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm demo`. Include the lockfile and regenerated `dist/` in changes. Do not include credentials or real customer source in fixtures. Tests use local repositories, fake LLM responses, and mocked GitHub calls.

Keep modules small, use strict TypeScript and Zod at external boundaries, and document exact support. See [recipe contribution guidance](docs/recipes.md). Contributions are licensed under Apache-2.0. Submit security issues privately using the process in SECURITY.md.
