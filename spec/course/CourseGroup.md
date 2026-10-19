# Build Spec for CourseGroup
- database schema: `.\database\course.sql` (also referenced from `.\database\promotion.sql`)

## Summary

`CourseGroup` is a simple code table that groups courses into families (e.g. a product line or exam track).
Each row is just an auto-numbered `pkid` and a `Description`. It is referenced by `Course.CourseGroup_pkid`
(nullable) and by `PartnerCourseGroup.CourseGroup_pkid`, which maps groups to partners for the public partner menu.
215 rows currently, most in use.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` smallint IDENTITY (C# `short`) |
| Foreign Keys | None |
| Required Fields | `Description` |
| N-N Relationships | N/A (`PartnerCourseGroup` is a full entity with its own pkid / DisplayOrder / Description — treated as a child table, not a junction) |
| Primary-Foreign Links | `Course.CourseGroup_pkid`, `PartnerCourseGroup.CourseGroup_pkid` (both FK-enforced) — counts only, link buttons deferred |
| Query Filters | keyword (`Description`) |
| Default Sort | `pkid DESC` (no DisplayOrder column) |

---

## Localization

### Chinese Table Name

- CourseGroup: 課程群組
- Description: 將課程歸類的群組（系列）

### Chinese Column Names

- pkid: 主代碼
- Description: 群組名稱
- (computed) CourseCount: 課程數
- (computed) PartnerCourseGroupCount: 原廠課程群組數

---

## Required Fields

Required (NOT NULL):
- `Description` (nvarchar 100)

Optional (nullable):
- none

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

Tables referencing `CourseGroup.pkid` (checked `sys.columns` for `%CourseGroup_pkid%` — `Promotion2.RelatedPartnerCourseGroup_pkid`
matches the pattern but points at `PartnerCourseGroup`, not here):

| Child | Column | FK enforced | Count field | Header | Future link |
|-------|--------|-------------|-------------|--------|-------------|
| Course | `CourseGroup_pkid` (nullable) | Yes | `CourseCount` | 對應課程 | `/courses?courseGroupPkid={pkid}` |
| PartnerCourseGroup | `CourseGroup_pkid` | Yes | `PartnerCourseGroupCount` | 對應原廠課程群組 | `/partner-course-groups?courseGroupPkid={pkid}` |

Neither child feature exists yet, so this iteration shows **counts only** (list + detail). Link buttons
(`pi pi-list`) are added when those list pages exist.

**Delete guard:** `DELETE` returns `409 { message }` when either count > 0. The list disables the delete button
for in-use rows.

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Description`

No FK, bool or date columns.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/course-groups` | New | `{ pkid, description }[]` ordered by `Description` (for future Course / PartnerCourseGroup dropdowns) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/course-groups` | List all |
| `POST` | `/api/course-groups/query` | Filtered query (body: `CourseGroupQuery`) |
| `GET` | `/api/course-groups/{id:int}` | Get by pkid |
| `POST` | `/api/course-groups` | Create → 201 |
| `PUT` | `/api/course-groups` | Update (pkid from body); `pkid` ≤ 0 → 400 |
| `DELETE` | `/api/course-groups/{id:int}` | Delete; in use → `409 { message }` |
| `GET` | `/api/lookups/course-groups` | Lookup |

`Description` is **not** enforced unique: the current data already has 2 duplicated descriptions, so a uniqueness
rule would block editing those rows.

No auth exceptions.

---

## Backend Notes

### Models

```csharp
public class CourseGroup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
    public int CourseCount { get; set; }
    public int PartnerCourseGroupCount { get; set; }
}

public class CourseGroupRequest
{
    public short Pkid { get; set; }   // ignored on POST, required on PUT
    [Required, StringLength(100)] public string Description { get; set; } = string.Empty;
}

public class CourseGroupQuery { public string? Keyword { get; set; } }

public class CourseGroupLookup { public short Pkid; public string Description; }
```

### SQL — SELECT

```sql
SELECT g.pkid, g.Description,
       (SELECT COUNT(*) FROM Course c              WHERE c.CourseGroup_pkid = g.pkid)  AS CourseCount,
       (SELECT COUNT(*) FROM PartnerCourseGroup pg WHERE pg.CourseGroup_pkid = g.pkid) AS PartnerCourseGroupCount
FROM CourseGroup g
ORDER BY g.pkid DESC
```

### SQL — INSERT

```sql
INSERT INTO CourseGroup (Description) VALUES (@Description);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

```sql
UPDATE CourseGroup SET Description = @Description WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM CourseGroup WHERE pkid = @pkid` — controller checks usage counts first (409 if in use).

### Special Column Notes

- `pkid` is `smallint` → C# `short`; controller range-checks the `int` route id before casting.
- `Description` is trimmed by the controller. Whitespace-only values fail `[Required]` → 400; the form rejects them too (`Validators.pattern(/\S/)`).
- RowAudit: no `RowAuditWriter` exists in the codebase yet — not logged.

---

## Frontend Notes

### Routes

| Path | Component |
|------|-----------|
| `/course-groups` | `CourseGroupList` |
| `/course-groups/new` | `CourseGroupForm` |
| `/course-groups/:id` | `CourseGroupDetail` |
| `/course-groups/:id/edit` | `CourseGroupForm` |

### Model

```ts
export interface CourseGroup {
  pkid: number; description: string;
  courseCount: number; partnerCourseGroupCount: number;
}
export interface CourseGroupRequest { pkid?: number; description: string; }
export interface CourseGroupQuery { keyword?: string | null; }
```

### List

- Columns: 主代碼, 群組名稱, 對應課程, 對應原廠課程群組, 操作.
- All sortable; default `pkid` DESC, 20 rows.
- Filter drawer: keyword input.
- Delete disabled (tooltip 使用中無法刪除) when any count > 0.

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${item.pkid}</b>「${item.description}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-group-list-filters` | Last query filter values |
| `course-group-list-sort` | `{ field, order }` |
| `course-group-list-page` | `{ first, rows }` |

### Form

| Field | Control | Notes |
|-------|---------|-------|
| 主代碼 | read-only text | Edit mode only (IDENTITY) |
| 群組名稱 | `pInputText` | Required, max 100 |

### Detail

Fields as read-only `.view-value`; usage card showing both counts.

### Sidebar

Existing group **課程管理 Course** → `課程群組 CourseGroup` (`pi pi-sitemap`) → `/course-groups`.

### Sub-panels

N/A

---

## Tests

### Backend (`CMS.API.Tests`)

- `FakeCourseGroupRepository` (in-memory, seeded with a few groups, one in use), registered in `CmsApiFactory`.
- `CourseGroupsControllerTests`: get all ordered by pkid DESC; query by keyword; get by id found / 404 / out-of-range id;
  create 201 + Location; missing / too-long description → 400; update 200 / 404 / pkid 0 → 400;
  delete 204 / 404 / in use → 409; lookup endpoint.
- `FakeLookupRepository` — add `GetCourseGroupsAsync()`.

### Frontend

- `course-group.service.spec.ts` — URL/verb per method.
- `course-group-list.spec.ts` — load, filters + session storage, delete confirm, in-use guard.
- `course-group-detail.spec.ts` — renders fields, 404.
- `course-group-form.spec.ts` — required validation, create / update payloads.
- `lookup.service.spec.ts` — add `getCourseGroups()`.

---

## Files to Create / Modify

| Side | File | Action |
|------|------|--------|
| API | `Models/CourseGroup.cs`, `CourseGroupRequest.cs`, `CourseGroupQuery.cs`, `CourseGroupLookup.cs` | Create |
| API | `Repositories/ICourseGroupRepository.cs`, `CourseGroupRepository.cs` | Create |
| API | `Repositories/LookupRepository.cs`, `Controllers/LookupsController.cs` | Modify (lookup) |
| API | `Controllers/CourseGroupsController.cs` | Create |
| API | `Program.cs` | Modify (DI) |
| Tests | `FakeCourseGroupRepository.cs`, `CourseGroupsControllerTests.cs` | Create |
| Tests | `CmsApiFactory.cs`, `FakeLookupRepository.cs` | Modify |
| NG | `features/course-groups/course-group.model.ts`, `course-group.service.ts` (+spec) | Create |
| NG | `features/course-groups/course-group-{list,detail,form}/*` (+specs) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+spec) | Modify |
| NG | `app.routes.ts`, `app.ts` | Modify |
