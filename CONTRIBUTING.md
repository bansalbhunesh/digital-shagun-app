# Contributing to Digital Shagun App

Thank you for your interest in contributing to the Digital Shagun App! To ensure a high-quality codebase and smooth collaboration, please follow these guidelines.

## Code Standards

- **TypeScript Strict Mode**: Enabled across all packages. Avoid `any` where possible.
- **Prettier**: Code must be formatted using Prettier.
- **Linting**: No lint warnings or errors are allowed in the `main` branch.
- **Testing**: All new features should include basic unit tests in `vitest`.
- **Type Safety**: All PRs must pass `pnpm run typecheck` at the workspace root.

## Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `test:` adding or correcting tests
- `chore:` maintenance, dependency updates, or internal tooling changes
- `refactor:` code changes that neither fix a bug nor add a feature

## Development Process

1.  **Workspaces**: This is a pnpm monorepo. Use specialized commands like `pnpm --filter <package> <command>`.
2.  **Environment**: Copy the relevant `.env.example` files to `.env` in each workspace and fill in the secrets.
3.  **Local Setup**:
    - Run `pnpm install` in the root.
    - Run `pnpm run push` in `lib/db` to sync your local Postgres schema.
    - Start the backend: `pnpm --filter @workspace/api-server run dev`.
    - Start the app: `pnpm --filter @workspace/shagun-app start`.

## PR Process

1.  Create a feature branch from `main`.
2.  Make your changes following the code standards.
3.  Verify your changes:
    - Run `pnpm run typecheck` to ensure no regressions.
    - Ensure the API build passes: `pnpm --filter @workspace/api-server run build`.
4.  Submit a Pull Request with a clear description of the problem and your solution.
