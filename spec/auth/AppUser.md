# Build Spec for AppUser
- database schema: `.\database\auth.sql` (also in `.\database\admin.sql`)

## Summary

`AppUser` stores the back-office login accounts. Each user has a login id (`UserId`, the table PK), a display name,
an active flag and a password hash. Roles are assigned n-n through `AppUserRole` (keyed by the `UserId` / `RoleId`
strings, FK-enforced, **no cascade**). 1 row currently (`admin@example.com`, 1 role).

| Item | Detail |
|------|--------|
| Primary Key | Table PK is `UserId` nvarchar(200); `pkid` int IDENTITY is used for routes and the PUT body (same as AppRole). `UserId` is immutable on update |
| Foreign Keys | None |
| Required Fields | `UserId`, `UserName`, `IsActive` (default 1), `PasswordHash` (server-set only) |
| N-N Relationships | `AppUserRole` (UserId ↔ RoleId) → `AppRole` |
| Primary-Foreign Links | `AppUserRole.UserId` (the n-n junction only) |
| Query Filters | keyword (UserId, UserName), tri-state isActive, roleId (dropdown) |
| Default Sort | `UserId ASC` |

---

## Localization

### Chinese Table Name

- AppUser: 使用者
- Description: 後台登入帳號

### Chinese Column Names

- pkid: 主代碼
- UserId: 使用者帳號
- UserName: 使用者名稱
- IsActive: 啟用
- PasswordHash: (not exposed)
- PasswordUpdatedTime: 密碼更新時間
- (computed) RoleCount: 角色數

---

## Required Fields

Required (NOT NULL):
- `UserId` (nvarchar 200), `UserName` (nvarchar 200), `IsActive` (bit, default 1)
- `PasswordHash` (nvarchar 800): **set by the server only**, never in a request or response

Optional (nullable):
- `PasswordUpdatedTime` (datetime): read-only in the UI

---

## Password Handling (backend only)

- `PasswordHash` is in **no** C# response/request model and **no** Angular model. The SELECT never reads it.
- Format: lowercase hex SHA-256 of the UTF-8 password, unsalted (64 chars). This matches the existing row:
  SHA-256 of the current default password (verified in-session).
- Default password: `SysConfig.configValue` where `configKey = 'appConfig'` is a JSON object, and its `defaultPassword` property is used
  (value not recorded here). The repository reads the raw value; `PasswordHasher.ReadDefaultPassword(json)` parses it.
  If the row is missing, the JSON is invalid, or `defaultPassword` is missing or blank, the API returns 500 `{ message: "系統設定 appConfig 缺少 defaultPassword" }`.
- **Create**: `PasswordHash = PasswordHasher.Hash(defaultPassword)` and `PasswordUpdatedTime = NULL` (NULL means the user is still on the default password, as for the existing admin row).
- **Update**: `PasswordHash` / `PasswordUpdatedTime` are not touched.
- **Reset**: `POST /api/app-users/{id}/reset-password` → 204 (404 if missing). Sets the hash back to the default password and
  `PasswordUpdatedTime = NULL`. The detail page has a 重設密碼 button with a confirm dialog. This is an action, not a field.

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

`AppUserRole.UserId` is the only reference (checked `sys.columns` for `%UserId%` / `%AppUser%`). It is the n-n junction
(below), not a child entity, so it gets no link button. Delete removes the user's `AppUserRole` rows first, in the same transaction
(the FK has no cascade), the same way AppRole does.

Inbound link **to** this list: the AppRole detail page's 使用者 count links to `/app-users?roleId={roleId}`.

---

## N-N Relationships

- Junction `AppUserRole (UserId, RoleId)`, PK (UserId, RoleId), both FKs, no cascade.
- Related entity `AppRole`, lookup `GET /api/lookups/app-roles` (**new**): `{ pkid, roleId, roleName }` ordered by `RoleId`.
- List: `RoleCount` subquery. Detail: role chips `roleName (roleId)`.
- Form: `p-multiselect` (`display="chip"`, filter, `[maxSelectedLabels]="9999"`).
- Request: `RoleIds: List<string>`. Unknown role ids → 400 `{ message }` (`CheckRolesAsync`), so the SQL FK error is never relied on.
- Sync: inside the write transaction, `DELETE FROM AppUserRole WHERE UserId = @UserId`, then insert the distinct ids.

---

## Query Filters

- **keyword**: LIKE on `UserId`, `UserName`
- **isActive**: tri-state (null = 全部)
- **roleId**: `EXISTS (SELECT 1 FROM AppUserRole ur WHERE ur.UserId = u.UserId AND ur.RoleId = @RoleId)`, dropdown from
  `lookups/app-roles`. It is also accepted as query param `?roleId=`, which replaces the saved filters.
- No date-range filter on `PasswordUpdatedTime`: it is NULL for every row today, so the filter has little use.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/app-roles` | New | `{ pkid, roleId, roleName }[]` ordered by `RoleId` |
| `GET /api/lookups/app-users` | Exists | Unchanged (used by the AppRole form) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/app-users` | List all |
| `POST` | `/api/app-users/query` | Filtered query (body: `AppUserQuery`) |
| `GET` | `/api/app-users/{id:int}` | Get by pkid (includes `Roles`) |
| `POST` | `/api/app-users` | Create → 201. Duplicate `UserId` → 409. Unknown role → 400. Missing default password → 500 |
| `PUT` | `/api/app-users` | Update (pkid from body). `pkid` ≤ 0 → 400; unknown role → 400; 404 |
| `DELETE` | `/api/app-users/{id:int}` | Delete (removes AppUserRole rows) → 204 / 404 |
| `POST` | `/api/app-users/{id:int}/reset-password` | No body. 204 / 404 / 500 (missing default password) |

No auth exceptions (there is no auth in the API yet).

---

## Backend Notes

### Models

```csharp
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = "";
    public string UserName { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime? PasswordUpdatedTime { get; set; }
    public int RoleCount { get; set; }
    public List<AppRoleLookup> Roles { get; set; } = [];   // GET by id only
}

public class AppUserRequest          // no PasswordHash / PasswordUpdatedTime
{
    public int Pkid { get; set; }    // ignored on POST, required on PUT
    [Required, StringLength(200)] public string UserId { get; set; } = "";   // ignored on PUT
    [Required, StringLength(200)] public string UserName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public List<string> RoleIds { get; set; } = [];
}

public class AppUserQuery { string? Keyword; bool? IsActive; string? RoleId; }
public class AppRoleLookup { int Pkid; string RoleId; string RoleName; }
```

`Security/PasswordHasher.cs` (static): `Hash(string)` → lowercase hex SHA-256 (UTF-8); `ReadDefaultPassword(string? json)` → `string?`.

### SQL — SELECT

```sql
SELECT u.pkid, u.UserId, u.UserName, u.IsActive, u.PasswordUpdatedTime,
       (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount
FROM AppUser u
ORDER BY u.UserId ASC
```

Roles on GET by id (same connection):
`SELECT r.pkid, r.RoleId, r.RoleName FROM AppUserRole ur JOIN AppRole r ON r.RoleId = ur.RoleId WHERE ur.UserId = @UserId ORDER BY r.RoleId`

### SQL — INSERT

```sql
INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
VALUES (@UserId, @UserName, @IsActive, @PasswordHash, NULL);
SELECT CAST(SCOPE_IDENTITY() AS int);
```

### SQL — UPDATE

```sql
UPDATE AppUser SET UserName = @UserName, IsActive = @IsActive WHERE pkid = @Pkid
```

### SQL — Reset password

```sql
UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordUpdatedTime = NULL WHERE pkid = @pkid
```

### SQL — DELETE

The transaction deletes the user's `AppUserRole` rows, then the `AppUser` row.

### Special Column Notes

- `UserId` / `UserName` are trimmed by the controller. `UserId` may be an e-mail, but no format is enforced (it is nvarchar, so no ASCII rule).
- `IsActive` defaults to `true` (DB default 1).
- `PasswordUpdatedTime` (datetime): no writer exists yet, so the timezone is unknown. It is displayed as returned (no `'Z'` appended).
- RowAudit: no `RowAuditWriter` exists in the codebase yet, so no audit logging.

---

## Frontend Notes

### Routes

| Path | Component |
|------|-----------|
| `/app-users` | `AppUserList` |
| `/app-users/new` | `AppUserForm` |
| `/app-users/:id` | `AppUserDetail` |
| `/app-users/:id/edit` | `AppUserForm` |

### Model

```ts
export interface AppUser {
  pkid: number; userId: string; userName: string; isActive: boolean;
  passwordUpdatedTime: string | null; roleCount: number; roles: AppRoleLookup[];
}
export interface AppUserRequest { pkid: number; userId: string; userName: string; isActive: boolean; roleIds: string[]; }
export interface AppUserQuery { keyword?: string | null; isActive?: boolean | null; roleId?: string | null; }
```

### List

- Columns: 主代碼, 使用者帳號, 使用者名稱, 啟用 (check/minus icon), 角色數, 密碼更新時間, 操作. All sortable. Default `userId` ASC, 20 rows.
- Drawer: keyword, 啟用 (tri-state select), 角色 (select, lookups loaded the first time the drawer opens).
- `roleId` input (query param) replaces the saved filters and resets paging.

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${u.pkid}</b>「${u.userId} ${u.userName}」？   (+ "，並移除 n 個角色指派" when roleCount > 0)
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `app-user-list-filters` | Last query filter values |
| `app-user-list-sort` | `{ field, order }` |
| `app-user-list-page` | `{ first, rows }` |

### Form

| Field | Control | Notes |
|-------|---------|-------|
| 主代碼 | read-only text | Edit only |
| 使用者帳號 | `pInputText` | Required, max 200, `\S`. Disabled on edit |
| 使用者名稱 | `pInputText` | Required, max 200, `\S` |
| 啟用 | `p-toggleswitch` | Default on |
| 角色 | `p-multiselect` | `lookups/app-roles` |

New-mode hint: 新使用者的密碼為系統預設密碼. No password field.

### Detail

Fields as `.view-value`, plus 密碼更新時間 (`尚未變更（預設密碼）` when null) and role chips. Toolbar: 返回, 重設密碼 (confirm →
`resetPassword` → success toast → reload), 編輯.

### Sidebar

Existing group **系統管理 Admin** → `使用者 AppUser` (`pi pi-user`) → `/app-users`, placed before 角色.

### Sub-panels

N/A

---

## Tests

### Backend (`CMS.API.Tests`)

- `FakeAppUserRepository` (in memory; stores the hash so tests can assert it; configurable `AppConfigValue`), registered in `CmsApiFactory`.
- `AppUsersControllerTests`: get all ordered by UserId; query by keyword / isActive / roleId; get by id found / 404; the response has no
  `passwordHash` property; create 201 stores `sha256(defaultPassword)`; create duplicate → 409; unknown role → 400; missing UserId → 400;
  missing/invalid appConfig → 500; update 200 keeps the hash and ignores UserId / 404 / pkid 0 → 400; delete 204 / 404;
  reset-password 204 restores the hash / 404; `lookups/app-roles`.
- `PasswordHasherTests`: known vector; ReadDefaultPassword valid / invalid / missing / blank.
- `FakeLookupRepository`: add `GetAppRolesAsync()`.

### Frontend

- `app-user.service.spec.ts`: URL and verb for each method, including `resetPassword`.
- `app-user-list.spec.ts`: load, filters + session storage, `roleId` input, drawer lookups, delete confirm.
- `app-user-detail.spec.ts`: renders fields and roles; 404; reset password confirm + call.
- `app-user-form.spec.ts`: required validation, UserId disabled on edit, create / update payloads (no password), 409 toast.
- `lookup.service.spec.ts`: add `getAppRoles()`. `app-role-detail.spec.ts`: user count link.

---

## Files to Create / Modify

| Side | File | Action |
|------|------|--------|
| API | `Models/AppUser.cs`, `AppUserRequest.cs`, `AppUserQuery.cs`, `AppRoleLookup.cs` | Create |
| API | `Security/PasswordHasher.cs` | Create |
| API | `Repositories/IAppUserRepository.cs`, `AppUserRepository.cs` | Create |
| API | `Controllers/AppUsersController.cs` | Create |
| API | `Repositories/LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `FakeAppUserRepository.cs`, `AppUsersControllerTests.cs`, `PasswordHasherTests.cs` | Create |
| Tests | `CmsApiFactory.cs`, `FakeLookupRepository.cs` | Modify |
| NG | `features/app-users/app-user.model.ts`, `app-user.service.ts` (+spec) | Create |
| NG | `features/app-users/app-user-{list,detail,form}/*` (+specs) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+spec) | Modify |
| NG | `features/app-roles/app-role-detail/*` (user count link) | Modify |
| NG | `app.routes.ts`, `app.ts` | Modify |
