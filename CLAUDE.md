# CLAUDE.md

Full-stack CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20), over an existing SQL Server database. UI text is Traditional Chinese.

## Reference docs (read when relevant)

| File | Read when |
|---|---|
| `docs/claude/backend.md` | Adding/changing API code or backend tests: key types, FK/n-n/delete-guard patterns, column handling, validation, fakes |
| `docs/claude/frontend.md` | Adding/changing UI or Angular tests: list/drawer/form patterns, child-list links, sidebar, spec conventions |
| `docs/claude/features.md` | Changing an existing feature or one FK-related to it: per-table decisions, live-data facts, deferred work |
| `spec/code-gen.convention.md` | Scaffolding a new feature (with the two above) |

## Layout

| Path | What |
|---|---|
| `database/*.sql` | Schema of the existing `CMS` database (source of truth for models) |
| `spec/feature-spec.template.md`, `spec/sample*.spec.md` | Spec template and examples. `sample1.spec.md` is aspirational (mentions ClassSection, `spec/dapper.md`, `AuditHelper`, copy/QR/PDF, none of which exist): use it for format only |
| `spec/{sub-system}/{Table}.md` | Per-feature specs from `/crud` (re-running `/crud` reuses an existing spec) |
| `spec/ui-sample-*.png` | UI style reference only |
| `src/CMS.sln`, `src/global.json` | Solution; `global.json` pins the .NET 9 SDK (machine default is 10) |
| `src/CMS.API`, `src/CMS.API.Tests`, `src/CMS.NG` | Web API, xUnit tests, Angular app |

## Commands

```sh
cd src && dotnet run --project CMS.API      # http://localhost:5000, Swagger at /swagger
cd src && dotnet test
cd src/CMS.NG && npm start                  # http://localhost:4200
cd src/CMS.NG && npm run test:ci            # headless Karma, single run
cd src/CMS.NG && npx ng build               # production build (checks budgets)
```

DB: `Server=.\SQLEXPRESS;Database=CMS;Trusted_Connection=True` (`CMS.API/appsettings.json`, `ConnectionStrings:CMS`). Query: `sqlcmd -S '.\SQLEXPRESS' -E -C -d CMS -Q "..."`.

## Core conventions

- Backend per table: `Models/{Table}.cs` + `{Table}Request.cs` + `{Table}Query.cs` → `Repositories/I{Table}Repository` + impl (Dapper, async, transactions for multi-statement writes) → DI in `Program.cs` → `Controllers/{Table}sController` at `api/{kebab-plural}`, lookups at `api/lookups/{kebab-plural}`. JSON is camelCase.
- 409 and business-rule 400 responses carry `{ message }` (Traditional Chinese), and the frontend toasts it.
- Frontend per table: `src/app/features/{kebab-plural}/` with list/detail/form folders, `{table}.model.ts`, `{table}.service.ts`. No `.component` suffix. Signals, `inject()`, `@if`/`@for`. Lazy routes in `app.routes.ts`; sidebar in `navGroups` (`app.ts`).
- Tests are always written: backend uses in-memory fakes via `CmsApiFactory` (no Moq, no DB); frontend uses Jasmine specs next to each file.
- When `/crud` disagrees with this repo (`core/models` paths, Moq, `RowAuditWriter`/`RowAuditBadgeComponent`), follow this repo.
- After building a feature, add its notes to `docs/claude/features.md` and a row to the index below.

## Features

| Feature | Menu | Key facts |
|---|---|---|
| AppRole | 系統管理 › 角色 | string PK `RoleId` + `pkid` route key; n-n users |
| AppUser | 系統管理 › 使用者 | string PK `UserId`; `PasswordHash` backend-only (SHA-256 of SysConfig default); reset-password endpoint; n-n roles |
| PublishStatus | 系統管理 › 發布狀態 | tinyint non-IDENTITY PK |
| Partner | 課程管理 › 原廠 | smallint IDENTITY; 5 child counts incl. Seminar (no FK) |
| CourseGroup | 課程管理 › 課程群組 | smallint IDENTITY; minimal template |
| Course | 課程管理 › 課程 | FKs + n-n + long texts + CourseRecomm string-key children |

## Environment gotchas

- Git Bash: quote the server name (`sqlcmd -S '.\SQLEXPRESS'`). Chinese prints garbled in sqlcmd output, so query non-text columns. `curl -d` mis-encodes Chinese, so use ASCII payloads.
- A running `dotnet run` locks `CMS.API/bin` (MSB3027). The user often leaves an API on :5000 with old code: don't kill it. Use `dotnet test --artifacts-path <temp>`, and smoke-test with a second copy: `dotnet run --project CMS.API --artifacts-path <temp> --urls http://localhost:5099`.
- Smoke tests write real rows: use ASCII `ZZ…`/`zz…` keys, delete them afterwards, and check side tables (`CourseRecomm`, `AppUserRole`) with sqlcmd.
- No real Python (`python` is the Store stub). Edit with Edit/Write or `node`; `jq` is available.
- Write C#/TS source with the Write tool: long heredocs break, and in `node -e "…"` bash eats backticks and `${…}`. A single-quoted `node -e '…'` with `\x27` for apostrophes is safe.
