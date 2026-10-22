# CLAUDE.md

Full-stack CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20) over an existing SQL Server DB, plus a Node Claude Code hook in `tools/token-report/`. UI text is Traditional Chinese.

## Read before the matching work

| File | When |
|---|---|
| `docs/claude/workspace.md` | Running/smoke-testing the apps, DB queries, specs, tool quirks, `/ship` |
| `docs/claude/backend.md` | API code, backend tests, auth/roles, row audit, exceptions, DB schema |
| `docs/claude/frontend.md` | UI or Angular tests: lists, forms, toolbars, custom pages, shared components, auth/menu, error toasts |
| `docs/claude/features.md` | A feature or one FK-related to it: AppRole, AppUser, Auth/login, My Profile, PublishStatus, Partner, CourseGroup, Course, FeaturedPromoItem, AgentTokenUsage, RowAudit history |
| `tools/token-report/README.md` | The token-usage SessionEnd hook |
| `TODOS.md` | Deferred review findings (P1–P4): check before changing auth, row audit or the hook |
| `spec/code-gen.convention.md` | Scaffolding with `/crud` |

## Commands

```sh
cd src && dotnet run --project CMS.API         # :5000, Swagger at /swagger
cd src && dotnet test --artifacts-path <temp>  # row-audit tests need .\SQLEXPRESS
cd src/CMS.NG && npm start                     # :4200
cd src/CMS.NG && npm run test:ci               # headless Karma
cd src/CMS.NG && npx ng build                  # checks budgets
cd tools/token-report && node --test
```

## Rules (every feature)

- Tests with every change: backend via `CmsApiFactory` + in-memory fakes, Angular specs beside each file, `tools/` via `node --test`.
- Auth on by default: endpoints need a login JWT, routes sit under the guarded `''` parent, role limits = `[Authorize(Roles = …)]` + hidden UI. An `adminOnly` menu item still needs the API attribute (hiding protects nothing).
- Row audit: every repository Insert/Update/Delete logs through `RowAuditWriter` on the write's own transaction; every detail page and edit form shows `<app-row-audit-badge>`.
- Errors: never catch unexpected exceptions (`UnhandledExceptionMiddleware` returns a safe 500); expected 400/401/403/409 return a Traditional Chinese `{ message }`. Each `error:` callback guards its toast with `!isServerError(err)` and its spec gets a 500 case.
- Where `/crud` disagrees with the repo, follow the repo. After changing a feature, update `features.md`.
- This file is an index (≤3 KB): new facts go in one `docs/claude/*.md` file, never here.

## Gotchas (`workspace.md`)

- :5000 and :4200 run old code: leave them up, build/test into a temp `--artifacts-path`, smoke-test on :5099 with a temporary `ZZ…` user.
- No Python. Use the Write tool, or a single-quoted `node -e '…'` for small edits.

## Agent skills

Issues: GitHub `jeffyehs-hotmail/cms-1019` via `gh`. Tracker, triage labels and domain docs (`GLOSSARY.md`, `docs/adr/`): `docs/agents/`.
