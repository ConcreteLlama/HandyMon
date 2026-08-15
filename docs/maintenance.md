# Maintenance Rules

When making changes to this codebase, update the relevant documentation. `CLAUDE.md` is always loaded into context; the `docs/` files are loaded when that domain is relevant.

## What to Update and When

| Change | Update |
|--------|--------|
| Add or remove a feature | `docs/features.md` — add/remove the feature's section |
| Add or remove an API route | `docs/features.md` — update the feature's route table |
| Add or change a hardcoded path | `docs/windows-dependencies.md` — update the tool's entry |
| Add a new external tool dependency | `docs/windows-dependencies.md` — add a new row and detail section |
| Change a key type or Zod schema | `docs/data-models.md` |
| Change how the app starts or deploys | `docs/startup.md` |
| Change an npm script or dev workflow | `docs/development.md` |
| Change the overall architecture or data flow | `docs/architecture.md` |
| Add or remove a module in `src/utils/` | `docs/utilities.md` |
| Change a key fact (port, task name, auth state) | `CLAUDE.md` — the Key Facts section |

## Spirit of the Rules

The goal is that a future Claude (or developer) can read `CLAUDE.md` and the relevant `docs/` file and have an accurate picture of the code without needing to grep for things. If you make a change that would surprise someone reading the existing docs, update the docs.

Docs don't need to be exhaustive — they should capture things that aren't obvious from reading the code: the *why* behind patterns, the non-obvious constraints (e.g. why audio switching has a delay, why fan detection uses two sources), and the system-specific setup (paths, service names, external tools).

Don't document things that are self-evident from well-named code. Do document things that would make someone say "wait, why does it do that?" if they didn't know.
