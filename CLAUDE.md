# CLAUDE.md

CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20) over an existing SQL Server DB. UI text is Traditional Chinese. This file is an index; read the matching doc before the work.

| Doc | Read before |
|---|---|
| `docs/claude/workspace.md` | running/smoke-testing apps, DB queries, repo map, tool quirks |
| `docs/claude/backend.md` | API code or backend tests |
| `docs/claude/frontend.md` | UI, print layouts or Angular specs |
| `docs/claude/features.md` | changing a feature or an FK-related one (feature index + per-table facts) |
| `spec/code-gen.convention.md` | scaffolding with `/crud` (this repo wins on conflicts: no `core/models`, Moq, `RowAuditWriter`) |
| `docs/designs/{feature}.md` | building a planned feature (Recommended Approach + accepted blocks are the spec; ledgers are history) |
| `TODOS.md` | adding scope (deferred work lives here) |

```sh
cd src && dotnet run --project CMS.API      # :5000, Swagger /swagger
cd src && dotnet test
cd src/CMS.NG && npm start                  # :4200
cd src/CMS.NG && npm run test:ci            # headless Karma
cd src/CMS.NG && npx ng build               # prod build, budgets
```

## Rules

- Per table: backend `Models` → `Repositories` → `Controllers` at `api/{kebab-plural}`; frontend `src/app/features/{kebab-plural}/`, no `.component` suffix, signals + `inject()`.
- 409 / business 400 / 401 return `{ message }` in Traditional Chinese; the UI toasts it.
- Always write tests: backend via `CmsApiFactory` fakes (no Moq, no DB); Jasmine spec next to each file.
- After building a feature: add its section and index row to `docs/claude/features.md`.

## Gotchas

- APIs on :5000 and :4200 are usually running with old code: don't kill them. Build/test with `--artifacts-path <temp>`; smoke-test a second API on :5099.
- Smoke tests hit the real DB: use `ZZ…` keys / 2099 dates, then delete the rows and their side-table rows.
- A separate UI QA stack (Angular :4600 + API :5600) needs a local, never-committed `apiUrl` override: see `workspace.md`.
- No Python. Write source with the Write tool; script small edits with single-quoted `node -e '…'`.

## Skill routing

Use a listed skill when the request matches: ideas → /office-hours · scope → /plan-ceo-review · architecture → /plan-eng-review · design → /plan-design-review or /design-consultation · full review → /autoplan · bugs → /investigate · QA → /qa or /qa-only · diff review → /review · visual polish → /design-review · ship → /ship · save/resume → /context-save, /context-restore · backlog spec → /spec. Answer quick questions directly.
