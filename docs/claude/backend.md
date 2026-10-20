# Backend patterns and tests

Read this before adding or changing an API feature (`src/CMS.API`, `src/CMS.API.Tests`).

## Structure

- `Program.cs`: Swagger (Swashbuckle 7.2.0, always on), CORS for any loopback origin, Dapper `DateOnly`/`TimeOnly` type handlers, DI registrations. Ends with `public partial class Program {}` for `WebApplicationFactory`.
- `Data/`: `IDbConnectionFactory` (`OpenAsync()`), type handlers. `Security/`: `PasswordHasher`, `AccessTokenIssuer` (login JWT).
- `Models/`: `{Table}.cs` (response), `{Table}Request.cs` (write DTO, DataAnnotations), `{Table}Query.cs` (filter DTO), `{Table}Lookup.cs`.
- `Repositories/`: `I{Table}Repository` + `{Table}Repository`. Dapper only, all async. Multi-statement writes run in a transaction.
- `Controllers/`: route `api/{kebab-plural}`; lookups in `LookupsController`/`LookupRepository` under `api/lookups/{kebab-plural}`. Non-table endpoints get their own controller + repository (`AuthController` at `api/auth`, `IAuthRepository`).

**Checklist:** model/request/query → repository interface + impl → register in `Program.cs` → controller → fake + tests.

**Templates to copy:** `Partner` (smallint IDENTITY, child counts, delete guard, lookup); `CourseGroup` (minimal, one column); `Course` (FK columns, n-n, JOINed labels, reference checks, date ranges, query-param filters); `AppRole`/`AppUser` (string table PK + `pkid` route key, string-keyed n-n).

## Keys

- **IDENTITY int**: `SELECT CAST(SCOPE_IDENTITY() AS int)`. **smallint IDENTITY**: C# `short`, `CAST(... AS smallint)`; controller range-checks the `int` route id before casting.
- **Non-IDENTITY PK** (e.g. tinyint code tables): PK in the request with `[Range]`; `ExistsAsync` → 409 on create; no `SCOPE_IDENTITY()`; PK disabled in the edit form.
- **String table PK with a `pkid` identity** (AppRole, AppUser): routes and the PUT body use `pkid`; the string key is immutable on update (it's referenced by FKs) and duplicates → 409.
- **Unique business key without a DB constraint** (e.g. `Partner.AppKey`): `{Key}ExistsAsync(key, excludePkid)` → 409 on create *and* update. Check the live data first (`GROUP BY … HAVING COUNT(*) > 1`); if duplicates exist, don't enforce it (e.g. `CourseGroup.Description`).

## References between tables

- **FK target tables**: `{Child}Count` subqueries in the SELECT; DELETE → 409 `{ message }` while in use (don't rely on the SQL FK error); the list disables delete. Add a lookup endpoint (API + `lookup.service.ts`).
- **Child columns without a DB FK** (e.g. `Seminar.Partner_pkid`): search `sys.columns` for `%{Table}_pkid%`, not just `sys.foreign_keys`, and count them in the delete guard. The LIKE can over-match (`Promotion2.RelatedPartnerCourseGroup_pkid` points at `PartnerCourseGroup`), so check each match.
- **Tables with FK columns**: alias `X_pkid AS XPkid` and JOIN the label (`p.Name AS PartnerName`; LEFT JOIN when nullable). Validate FK and n-n ids before writing (`CheckReferencesAsync` → 400 `{ message }`) instead of letting SQL throw.
- **n-n junctions**: ids in the request (`List<int>` / `List<string>`), label objects in the response, filled only on GET by id via separate queries on the same connection. Delete-then-reinsert distinct ids in the write transaction. Cascading junctions need no delete guard; non-cascading child FKs do (or delete them first, as AppRole/AppUser do with `AppUserRole`).
- **Children linked by a string key without a FK** (e.g. `CourseRecomm.CourseId`): don't guard the delete if that would block most rows. Delete them with the parent and update the key on rename, in the same transaction.

## Columns

- **Large text** (nvarchar(4000)/(max)): leave out of the list SELECT and keyword LIKE; load on GET by id only.
- **`varchar`**: `[RegularExpression(@"^[\x20-\x7E]*$")]` + `Validators.pattern` in the form; send as `DbType.AnsiString` / `DbString { IsAnsi = true }`.
- **`nchar`**: `RTRIM()` in every SELECT.
- **`date`** → `DateOnly`; request uses `DateOnly?` + `[Required]` (missing → 400, not `0001-01-01`); `p.Add(...)` the `.Value`. `DynamicParameters(template)` only sends properties the SQL references, so list properties in the request are harmless.
- **Server-only columns** (e.g. `AppUser.PasswordHash`): leave out of every model and the SELECT. Pass to the repository as a separate argument (`CreateAsync(request, passwordHash)`). Change them only through an action endpoint (`POST api/{plural}/{id}/{action}` → 204), never PUT.
- **`SysConfig`** (`configKey` → `configValue` nvarchar(4000)): `appConfig` is JSON (`defaultPassword`, `symmetricSecurityKey`, `enforcePasswordPolicy`). Read the raw value in the repository, parse with a static helper (unit-testable). Missing setting → 500 `{ message }`, nothing written.

## Validation and errors

- 409 and business-rule 400s always return `{ message }` in Traditional Chinese; the frontend toasts `err.error.message`. DataAnnotations 400s are ProblemDetails (normally prevented by form validators).
- Rules DataAnnotations can't express (date order, decimal scale, FK existence, whitespace-only after trim): a `ValidateAsync` helper in the controller → 400 `{ message }`. Mirror date-order rules as a form-group validator.
- **"Today" on the server**: inject `TimeProvider` (registered as `TimeProvider.System`); tests override it with `WithWebHostBuilder` + `ConfigureTestServices` (a `FixedTimeProvider`, e.g. JWT `iat`/`exp` in `AuthControllerTests`).
- **LIKE keywords** on columns that contain `_`/`%`/`[` (e.g. PromoCode): escape them (`[_]`, `[%]`, `[[]`). Fakes use `Contains`, so check the escaping in a DB smoke test.
- **Reordering within a UNIQUE key** (e.g. FeaturedPromoItem slots): swap in one transaction through a temporary value (slot 0) so the index is never violated.
- **New tables / columns** (no migrations exist): hand-write a re-runnable script in `database/` (`IF OBJECT_ID … IS NULL`, `SET QUOTED_IDENTIFIER ON` at the top) and apply it with `sqlcmd -i`. Never put a filtered index on an existing table: every INSERT/UPDATE from a connection with QUOTED_IDENTIFIER OFF (sqlcmd default, legacy tools) then fails (Msg 1934).
- No `RowAuditWriter` exists yet; the `/crud` skill mentions it, so skip it.

## Tests (`src/CMS.API.Tests`)

- Endpoint tests through `CmsApiFactory` (`WebApplicationFactory<Program>`), which swaps each repository for an in-memory `Fake{Table}Repository`. No database. Fakes, not Moq (not referenced).
- New table: add the fake, register it in `CmsApiFactory.ConfigureWebHost`, add `{Table}sControllerTests`. New lookup: add the method to `FakeLookupRepository` or the interface won't compile.
- Fakes for tables with FKs hold static reference data (`FakeCourseRepository.Partners`, `FakeAppUserRepository.Roles`, …) used by their reference checks and reused by `FakeLookupRepository`.
- To assert server-only columns, the fake exposes them (`FakeAppUserRepository.Find(pkid).PasswordHash`); inputs tests vary are settable (`AppConfigValue`). Each test class has its own factory, so changes don't leak.
