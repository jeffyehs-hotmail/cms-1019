# CLAUDE.md

Full-stack CMS: .NET 9 Web API (Dapper) + Angular 20 (standalone, PrimeNG 20), over an existing SQL Server database.

## Layout

| Path | What |
|---|---|
| `database/*.sql` | Schema of the existing `CMS` database (source of truth for models) |
| `spec/code-gen.convention.md` | **Coding conventions — follow for every new feature** |
| `spec/feature-spec.template.md`, `spec/sample*.spec.md` | Feature spec template and examples |
| `spec/ui-sample-*.png` | UI style reference only (not actual content) |
| `src/CMS.sln`, `src/global.json` | Solution; `global.json` pins the .NET 9 SDK (machine default is 10) |
| `src/CMS.API` | Web API |
| `src/CMS.API.Tests` | xUnit tests |
| `src/CMS.NG` | Angular app |

## Commands

```sh
# Backend (http://localhost:5000, Swagger at /swagger)
cd src && dotnet run --project CMS.API
cd src && dotnet test

# Frontend (http://localhost:4200)
cd src/CMS.NG && npm start
cd src/CMS.NG && npm run test:ci     # headless Karma, single run (npm test = watch)
cd src/CMS.NG && npx ng build        # production build (checks budgets)
```

Database: `Server=.\SQLEXPRESS;Database=CMS;Trusted_Connection=True;...` (in `CMS.API/appsettings.json`, key `ConnectionStrings:CMS`). Query directly with `sqlcmd -S .\SQLEXPRESS -E -C -d CMS -Q "..."`.

## Backend (`src/CMS.API`)

- `Program.cs`: Swagger (Swashbuckle 7.2.0, always on), CORS policy allowing any loopback origin, Dapper `DateOnly`/`TimeOnly` type handlers, DI registrations. Ends with `public partial class Program {}` for `WebApplicationFactory`.
- `Data/` — `IDbConnectionFactory` (`OpenAsync()`), type handlers.
- `Models/` — `{Table}.cs` (response), `{Table}Request.cs` (write DTO, DataAnnotations validation), `{Table}Query.cs` (filter DTO), lookup models.
- `Repositories/` — `I{Table}Repository` + `{Table}Repository`, Dapper only, all async. Multi-statement writes use a transaction.
- `Controllers/` — route `api/{kebab-plural}` (e.g. `api/app-roles`); lookups under `api/lookups/{kebab-plural}`.
- JSON is camelCase.

**New feature checklist:** model/request/query → repository interface + impl → register in `Program.cs` → controller → tests.

## Backend tests (`src/CMS.API.Tests`)

- Endpoint tests via `CmsApiFactory` (`WebApplicationFactory<Program>`) that swaps the repository for an in-memory fake (`Fake{Table}Repository`). No database required.
- For a new table: add a fake repository, register it in `CmsApiFactory.ConfigureWebHost`, add `{Table}sControllerTests`.

## Frontend (`src/CMS.NG`)

- Angular 20 file naming without the `.component` suffix: `app-role-list.ts` / class `AppRoleList`. Signals, `inject()`, `@if`/`@for` control flow.
- Features live in `src/app/features/{kebab-plural}/` with `{table}-list/`, `{table}-detail/`, `{table}-form/`, `{table}.model.ts`, `{table}.service.ts`.
- Shared: `core/services/lookup.service.ts`, `core/models/lookup.model.ts`, `core/utils/session-state.ts` (`readSession`/`writeSession`).
- Routes (lazy `loadComponent`) in `app.routes.ts`: `/{plural}`, `/{plural}/new`, `/{plural}/:id`, `/{plural}/:id/edit`. Route params arrive as component `input()`s (`withComponentInputBinding`).
- Sidebar menu: `navGroups` in `app.ts`.
- API base URL: `src/environments/environment*.ts`, import as `@env/environment` (tsconfig `paths`). **No dev proxy.**
- Theme: Aura preset with emerald primary + zh-TW translations in `app/theme.ts`. `MessageService`/`ConfirmationService` are provided app-wide; `<p-toast>`/`<p-confirmDialog>` live in `app.html`.
- Shared page CSS classes in `src/styles.scss`: `.page-header` (`.title`, `.subtitle`, `.actions`), `.page-card`, `.field` (`.required`, `.error`), `.view-value`, `.chips-wrap`.
- UI text is Traditional Chinese.
- Tests: Jasmine specs next to each file; services tested with `HttpTestingController`, components with `jasmine.createSpyObj` service mocks, `provideRouter([])`, `provideNoopAnimations()`.

## Gotchas

- Installing PrimeNG requires explicit `@angular/animations` and `@angular/cdk` (^20) or npm fails with ERESOLVE.
- Initial-bundle budget in `angular.json` raised to 1MB warn / 2MB error (PrimeNG theme pushes it to ~650kB).
- PrimeNG `p-table` resets `first` to 0 on user sort; persist paging via `(firstChange)`/`(rowsChange)`, not `(onPage)`.
- Git Bash `curl -d` with Chinese text gets mis-encoded — use ASCII payloads when smoke-testing the API from the shell.

## Features

### AppRole (`database/auth.sql`) — 系統管理 Admin › 角色 AppRole
- Table PK is `RoleId` (nvarchar), but `pkid` (int identity) is used for routes and PUT body. **`RoleId` is immutable on update** (referenced by `AppUserRole`); disabled in the edit form.
- n-n users via `AppUserRole` (keyed by `UserId`/`RoleId` strings): `AppRoleRequest.UserIds: List<string>`, delete-then-reinsert on update; `UserCount` subquery in list; `Users` populated only on GET by id.
- Duplicate `RoleId` on create → 409 with `{ message }`, shown as a toast.
- Filters: `keyword` (LIKE on RoleId, RoleName, Description), `permissionLevelFrom`/`To`. Default sort `RoleId ASC`.
- `Description` is optional (nullable in DB). `PermissionLevel` defaults to 100.
- Delete removes `AppUserRole` rows first (in a transaction).
- Lookup: `GET /api/lookups/app-users` (ordered by `UserName`).
