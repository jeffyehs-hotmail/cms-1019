# CLAUDE.md

Full-stack CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20) over an existing SQL Server database, plus a Node Claude Code hook in `tools/token-report/`. UI text is Traditional Chinese.

## Reference docs (read before the matching work)

| File | Read when |
|---|---|
| `docs/claude/workspace.md` | Running or smoke-testing the apps, querying the DB, finding specs, tool quirks |
| `docs/claude/backend.md` | Changing API code, backend tests, auth/roles on endpoints, row audit (`RowAuditWriter`), or DB schema |
| `docs/claude/frontend.md` | Changing UI or Angular tests (lists, forms, in-place editing, pinned toolbar, custom pages, shared components, auth/menu) |
| `docs/claude/features.md` | Changing a feature or one FK-related to it: AppRole, AppUser, Auth/login, My Profile, PublishStatus, Partner, CourseGroup, Course, FeaturedPromoItem, AgentTokenUsage, RowAudit history |
| `tools/token-report/README.md` | Changing or installing the token-usage SessionEnd hook |
| `spec/code-gen.convention.md` | Scaffolding a feature with `/crud` (plus backend, frontend, workspace) |

## Commands

```sh
cd src && dotnet run --project CMS.API      # http://localhost:5000, Swagger at /swagger
cd src && dotnet test --artifacts-path <temp>  # row-audit tests need .\SQLEXPRESS, else skipped
cd src/CMS.NG && npm start                  # http://localhost:4200
cd src/CMS.NG && npm run test:ci            # headless Karma, single run
cd src/CMS.NG && npx ng build               # production build (checks budgets)
cd tools/token-report && node --test
```

## Rules

- Every change ships with tests: backend through `CmsApiFactory` with in-memory fakes (only row-audit wiring runs real repositories on the live DB, rolled back), Angular specs next to each file, `tools/` via `node --test`.
- Auth is on by default: every endpoint needs a login JWT and every route sits under the guarded `''` parent. Current-user endpoints take the UserId from the JWT `sub`. Role-restricted actions use `[Authorize(Roles = …)]` (403) plus hidden UI; details in `backend.md`.
- Where `/crud` disagrees with this repo, follow the repo. After building or changing a feature, update its section in `features.md`.
- This file stays an index (~3 KB): new facts go into the matching `docs/claude/*.md` file, each fact in one place. Add a line here only for a rule or gotcha that applies to every kind of work, or a new feature name in the `features.md` pointer.

## Cross-cutting conventions (checklist for every feature)

Row audit (`backend.md` › Row audit, `frontend.md` › row-audit-badge):
- [ ] Every repository Insert / Update / Delete writes one `RowAudit` row through `RowAuditWriter` (`LogInsertAsync` / `LogUpdateAsync` / `LogDeleteAsync`) on the write's own transaction, so a failed change leaves none.
- [ ] Update loads the row before and after (logs the changed column names); Delete loads it before deleting (logs its first string column). `PrimaryKeyValues` = `pkid`; `UserName` = JWT `name`, else `"system"`; never insert `pkid` (IDENTITY).
- [ ] Every detail page and edit form puts `<app-row-audit-badge tableName="…" [pkid]="…" />` in `.page-header .start`: latest change inline, full trail on click (`GET api/rowaudit?tableName=&pkid=`).

Errors (`backend.md` › Unhandled exceptions, `frontend.md` › Forms):
- [ ] No try/catch for unexpected exceptions: `UnhandledExceptionMiddleware` logs them and returns a generic 500 `{ message }`, never stack traces or SQL. Expected cases (validation 400, 401, 403, 409) return their own status with a Traditional Chinese `{ message }`.
- [ ] `authInterceptor` toasts every 5xx and sends 401 to `/login`; each new `error:` callback guards its own toast with `if (!isServerError(err))`, and its spec gets a 500 case.

## Gotchas

- An API on :5000 and `npm start` on :4200 are usually running with old API code: leave them up, build/test into a temp `--artifacts-path`, smoke-test new API code on :5099 (`workspace.md`).
- Smoke tests write real DB rows and need a temporary `ZZ…` login user; follow the hygiene steps in `workspace.md`.
- No Python. Write source with the Write tool; script small edits with single-quoted `node -e '…'`, and anything containing `\n` escapes or apostrophes in a scratchpad script file.

## Agent skills

- Issues: GitHub Issues for `jeffyehs-hotmail/cms-1019` via `gh` (`docs/agents/issue-tracker.md`).
- Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`; `/to-spec` issues also get `spec` (`docs/agents/triage-labels.md`).
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily (`docs/agents/domain.md`).
