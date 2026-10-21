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

## Commands

```sh
cd src && dotnet run --project CMS.API      # http://localhost:5000, Swagger at /swagger
cd src && dotnet test
cd src/CMS.NG && npm start                  # http://localhost:4200
cd src/CMS.NG && npm run test:ci            # headless Karma, single run
cd src/CMS.NG && npx ng build               # production build (checks budgets)
```

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
- `curl -d` mis-encodes Chinese on this machine, so send ASCII payloads.

## Separate UI QA stack (Angular :4600 + API :5600)

To QA branch code end to end without touching the :4200/:5000 servers:

1. `dotnet run --project src/CMS.API --artifacts-path <temp> --urls http://localhost:5600`
2. `npm ci` in a fresh worktree's `src/CMS.NG`, then `npx ng serve --port 4600`.
3. The app calls an absolute `apiUrl`, so point `src/environments/environment.development.ts` at `http://localhost:5600/api`.
   - Then run `git update-index --skip-worktree src/CMS.NG/src/environments/environment.development.ts` so the change can't be committed.
   - Undo it with `--no-skip-worktree` plus a revert before shipping.
   - CORS already allows any loopback origin.
4. **gstack browse (headless Chromium):**
   - Start its daemon with a plain `browse goto …` before running guarded commands. A daemon started under `gstack-qa-deadline run` dies when the guard exits.
   - Pass absolute paths to `screenshot` / `pdf`. Relative paths resolve against the daemon's cwd and land in the worktree root.

## Smoke-test hygiene

Smoke tests write real rows into the live `CMS` database.

- Use ASCII `ZZ…`/`zz…` keys for string-keyed tables and far-future dates (e.g. 2099) for date-keyed ones (FeaturedPromoItem: training center 54).
- Login (`POST api/auth/login`): real passwords are unknown, so insert temporary `ZZ…` `AppUser` rows with `PasswordHash` = lowercase hex SHA-256 of a test password (`node -e` + `crypto`) plus `AppUserRole` rows, then delete both.
- Delete the rows afterwards and verify with sqlcmd, including side tables (`CourseRecomm`, `AppUserRole`, `CourseInCertification`, `CourseJobCategories`) and temporary values (FeaturedPromoItem `Slot = 0`).

## Tooling quirks

- No real Python: `python` is the Microsoft Store stub. Use the Edit/Write tools or `node`; `jq` is available.
- Write C#/TS source with the Write tool. Long bash heredocs break (a multi-file heredoc batch fails with `unexpected EOF`), and in `node -e "…"` bash eats backticks and `${…}`. A single-quoted `node -e '…'` with `\x27` for apostrophes is safe for small scripted edits.
- Claude's browser tools are not always available in a session; when they aren't, say the UI was verified by specs and build only.
