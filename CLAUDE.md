# CLAUDE.md

Full-stack CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20) over an existing SQL Server database, plus a Node Claude Code hook in `tools/token-report/`. UI text is Traditional Chinese. This file is an index; the details live in `docs/claude/`.

## Reference docs (read before the matching work)

| File | Read when |
|---|---|
| `docs/claude/workspace.md` | Running or smoke-testing the apps, querying the DB, finding specs, tool quirks |
| `docs/claude/backend.md` | Adding/changing API code, backend tests or DB schema (new tables/columns) |
| `docs/claude/frontend.md` | Adding/changing UI or Angular tests (lists, forms, in-place editing, pinned toolbar, custom pages, specs) |
| `docs/claude/features.md` | Changing an existing feature or one FK-related to it: per-table decisions, live-data facts, deferred work |
| `tools/token-report/README.md` | Changing or installing the token-usage SessionEnd hook |
| `spec/code-gen.convention.md` | Scaffolding a new feature with `/crud` (plus the three above) |

## Commands

```sh
cd src && dotnet run --project CMS.API      # http://localhost:5000, Swagger at /swagger
cd src && dotnet test
cd src/CMS.NG && npm start                  # http://localhost:4200
cd src/CMS.NG && npm run test:ci            # headless Karma, single run
cd src/CMS.NG && npx ng build               # production build (checks budgets)
cd tools/token-report && node --test        # token-usage hook tests
```

## Conventions

- Backend per table: `Models/{Table}.cs` + `{Table}Request.cs` + `{Table}Query.cs` → `Repositories/I{Table}Repository` + impl (Dapper, async) → DI in `Program.cs` → `Controllers/{Table}sController` at `api/{kebab-plural}`; lookups at `api/lookups/{kebab-plural}`. JSON is camelCase.
- Frontend per table: `src/app/features/{kebab-plural}/` with list/detail/form folders, `{table}.model.ts`, `{table}.service.ts`. No `.component` suffix. Signals, `inject()`, `@if`/`@for`. Lazy routes in `app.routes.ts`; sidebar in `navGroups` (`app.ts`). Shared UI in `core/components/`.
- 409, business-rule 400 and auth 401 responses carry `{ message }` (Traditional Chinese); the frontend toasts it. Login failures use one generic 401 message whatever the reason.
- Tests are always written: backend via `CmsApiFactory` with in-memory fakes (no Moq, no DB); frontend Jasmine specs next to each file; `tools/` scripts via `node --test`.
- When `/crud` disagrees with this repo (`core/models` paths, Moq, `RowAuditWriter`/`RowAuditBadgeComponent`), follow this repo. After building a feature, add notes to `docs/claude/features.md` and a row below.

## Features

| Feature | Menu | Key facts |
|---|---|---|
| AppRole | 系統管理 › 角色 | string PK `RoleId` + `pkid` route key; n-n users |
| AppUser | 系統管理 › 使用者 | string PK `UserId`; `PasswordHash` backend-only; reset-password and regenerate/revoke-agent-token endpoints; n-n roles; delete 409 while AgentTokenUsage rows exist |
| Auth | (API only) | `POST api/auth/login` → profile + 24h HS256 JWT, key from SysConfig appConfig; exact UserId, generic 401 |
| PublishStatus | 系統管理 › 發布狀態 | tinyint non-IDENTITY PK |
| Partner | 課程管理 › 原廠 | smallint IDENTITY; 5 child counts incl. Seminar (no FK) |
| CourseGroup | 課程管理 › 課程群組 | smallint IDENTITY; minimal template |
| Course | 課程管理 › 課程 | FKs + n-n + long texts + CourseRecomm string-key children; QR code; list in-place editing; pinned form toolbar |
| AgentTokenUsage | 系統管理 › Token 用量 | Claude Code SessionEnd hook (`tools/token-report/`) → `POST api/agent-token-usages` with per-user `cms_at_` token; replace-per-session; server-side cost from `AgentModelPrice`; hand-written `database/agent.sql` |
| FeaturedPromoItem | 首頁 › 上稿作業 | custom UI from `spec/custom/`: week grid per training center, 3 slots/day, copy/paste, slot swap |

## Must-know gotchas (details in `workspace.md`)

- An API on :5000 and `npm start` on :4200 are usually already running with old API code: don't kill them; build/test with `--artifacts-path <temp>` and smoke-test a second API copy on :5099.
- Smoke tests write real DB rows: use `ZZ…` keys / 2099 dates and delete them (and side-table rows) afterwards.
- No Python; write source with the Write tool, script small edits with single-quoted `node -e '…'`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `jeffyehs-hotmail/cms-1019`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`; `/to-spec` issues also get `spec`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root (created lazily when terms/decisions get resolved). See `docs/agents/domain.md`.
