# CLAUDE.md

CMS: .NET 9 API (Dapper) + Angular 20 / PrimeNG 20 over an existing SQL Server DB; UI text is Traditional Chinese. Index only: read the matching doc first.

| Doc | Read before |
|---|---|
| `docs/claude/workspace.md` | running apps, QA stack (:4600/:5600), DB queries, repo map, tool quirks |
| `docs/claude/backend.md` | API code or backend tests |
| `docs/claude/frontend.md` | UI, print layouts, Angular specs |
| `docs/claude/features.md` | touching a feature or an FK-related one (index + per-table facts) |
| `spec/code-gen.convention.md` | `/crud` scaffolding (repo conventions win) |
| `docs/designs/{feature}.md` | building a planned feature |
| `TODOS.md` | adding scope |

Commands (from `src/`): `dotnet run --project CMS.API` (:5000) · `dotnet test` · in `CMS.NG`: `npm start` (:4200) · `npm run test:ci` · `npx ng build`.

## Rules

- Always write tests: backend via `CmsApiFactory` fakes (no Moq, no DB); a Jasmine spec next to each file.
- After building a feature, add its section and index row to `docs/claude/features.md`.

## Gotchas

- :5000/:4200 usually run old code: don't kill them; build/test with `--artifacts-path <temp>`, smoke-test on :5099.
- Smoke tests hit the real DB: `ZZ…` keys / 2099 dates, then delete them and their side-table rows.
- No Python: write source with the Write tool, small scripted edits with single-quoted `node -e '…'`.

## Skill routing

Use a listed skill when the request matches: ideas /office-hours · scope /plan-ceo-review · architecture /plan-eng-review · design /plan-design-review, /design-consultation · full review /autoplan · bugs /investigate · QA /qa, /qa-only · diff review /review · polish /design-review · ship /ship · save/resume /context-save, /context-restore · spec /spec.
