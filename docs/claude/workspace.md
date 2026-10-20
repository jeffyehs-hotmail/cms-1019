# Workspace: repo map, running, database, environment

Read this before running or smoke-testing the apps, querying the DB, or looking for specs.

## Repo map

| Path | What |
|---|---|
| `database/*.sql` | Schema of the existing `CMS` database (source of truth for models) |
| `spec/feature-spec.template.md`, `spec/sample*.spec.md` | Spec template and examples. `sample1.spec.md` is aspirational (mentions ClassSection, `spec/dapper.md`, `AuditHelper`, copy/QR/PDF, none of which exist): use it for format only |
| `spec/{sub-system}/{Table}.md` | Per-feature specs written by `/crud` (re-running `/crud` reuses an existing spec) |
| `spec/custom/{Table}/` | User-written specs + UI screenshots for custom (non-template) pages. The screenshots are the actual layout to build |
| `spec/ui-sample-*.png` | UI style reference only |
| `spec/code-gen.convention.md` | Scaffolding conventions used by `/crud` |
| `src/CMS.sln`, `src/global.json` | Solution; `global.json` pins the .NET 9 SDK (machine default is 10) |
| `src/CMS.API`, `src/CMS.API.Tests`, `src/CMS.NG` | Web API, xUnit tests, Angular app |
| `docs/claude/*.md` | These reference docs; `CLAUDE.md` is only the index |

## Running

Commands are in `CLAUDE.md`.

- The Angular app calls `http://localhost:5000` directly (`src/environments/environment*.ts`, no dev proxy).
- The user often leaves `dotnet run` (API on :5000) and `npm start` (:4200) running between sessions, usually with old API code. Don't kill them. `npm start` hot-reloads frontend changes; the API does not.

## Database

- Connection: `Server=.\SQLEXPRESS;Database=CMS;Trusted_Connection=True` (`CMS.API/appsettings.json`, `ConnectionStrings:CMS`).
- Query: `sqlcmd -S '.\SQLEXPRESS' -E -C -d CMS -Q "..."`. In Git Bash the server name must be quoted.
- Chinese prints garbled in sqlcmd output, so query non-text columns (ids, counts, dates) when verifying.
- Live data has quirks (duplicate `CourseGroup.Description`, one Course with `ScheduleOff < ScheduleOn`, 895 orphan `CourseRecomm` rows). Check the data before adding a uniqueness or ordering rule; per-table findings are in `features.md`.

## Building and testing while the API is running

- A running `dotnet run` locks `CMS.API/bin` (MSB3027). Build and test into a temp folder: `dotnet test --artifacts-path <temp>`.
- Smoke-test new API code with a second copy on another port: `dotnet run --project CMS.API --artifacts-path <temp> --urls http://localhost:5099`.
- Every Claude Code session end on this machine runs the token-report hook (user `~/.claude/settings.json`) against :5000. Reports wait in `~/.claude/token-report/outbox/` until :5000 accepts them; to send them sooner, point `~/.claude/token-report.json` at the :5099 copy, run `node tools/token-report/report.js --backfill`, then point it back. An empty outbox means :5000 is accepting reports, so a backfill can go straight there.
- `curl -d` mis-encodes Chinese on this machine, so send ASCII payloads.

## Smoke-test hygiene

Smoke tests write real rows into the live `CMS` database.

- Use ASCII `ZZ…`/`zz…` keys for string-keyed tables and far-future dates (e.g. 2099) for date-keyed ones (FeaturedPromoItem: training center 54).
- Login (`POST api/auth/login`): real passwords are unknown, so insert temporary `ZZ…` `AppUser` rows with `PasswordHash` = lowercase hex SHA-256 of a test password (`node -e` + `crypto`) plus `AppUserRole` rows (`Admin` for the full menu), then delete both. **Every other endpoint needs this token** (except agent-token ingest, which takes a `cms_at_` token): `T=$(curl -s -H 'Content-Type: application/json' -d '{"userId":"ZZadmin","password":"…"}' $B/auth/login | jq -r .accessToken)`, then `-H "Authorization: Bearer $T"`. Without it the API returns 401 `{ message: "請先登入" }`.
- Browser checks against :4200 need a login too; the `ZZ` user works there, as long as :5000 runs the auth code.
- Delete the rows afterwards and verify with sqlcmd, including side tables (`CourseRecomm`, `AppUserRole`, `CourseInCertification`, `CourseJobCategories`) and temporary values (FeaturedPromoItem `Slot = 0`).

## Tooling quirks

- No real Python: `python` is the Microsoft Store stub. Use the Edit/Write tools or `node`; `jq` is available.
- Write C#/TS source with the Write tool. Long bash heredocs break (a multi-file heredoc batch fails with `unexpected EOF`), and in `node -e "…"` bash eats backticks and `${…}`. A single-quoted `node -e '…'` with `\x27` for apostrophes is safe for small scripted edits.
- Claude's browser tools are not always available in a session; when they aren't, say the UI was verified by specs and build only.
