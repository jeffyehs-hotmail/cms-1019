# Build Spec for PublishStatus
- database schema: `.\database\admin.sql`

## Summary

`PublishStatus` is a small code table defining the publishing states used by `Course` and `Promotion2`
(currently 1 草稿 / 2 上架中 / 3 已下架). Each row carries a description plus three flags that tell the
front-end site how to treat content in that state. **The PK `pkid` is a `tinyint` that is NOT an IDENTITY**
— the user enters it on create, and it is immutable afterwards.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` tinyint, **not** IDENTITY — user-supplied on create (1–255), immutable on update |
| Foreign Keys | None |
| Required Fields | `pkid`, `Description`, `IsDraft`, `IsPublished`, `IsDiscontinued` |
| N-N Relationships | N/A |
| Primary-Foreign Links | `Course.PublishStatus_pkid`, `Promotion2.PublishStatus_pkid` (usage counts shown; link buttons deferred until those features exist) |
| Query Filters | keyword (`Description`), `IsDraft`, `IsPublished`, `IsDiscontinued` (tri-state) |
| Default Sort | `pkid ASC` |

---

## Localization

### Chinese Table Name

- PublishStatus: 發布狀態
- Description: 課程／推廣項目的發布狀態代碼

### Chinese Column Names

- pkid: 主代碼
- Description: 狀態名稱
- IsDraft: 草稿
- IsPublished: 已發布
- IsDiscontinued: 已停用
- (computed) CourseCount: 課程數
- (computed) Promotion2Count: 推廣項目數

---

## Required Fields

Required (NOT NULL):
- `pkid` (user-supplied, 1–255; tinyint 0 is technically valid but reserved as "unset" — require ≥ 1)
- `Description` (max 50)
- `IsDraft`, `IsPublished`, `IsDiscontinued` (bit — checkbox, default `false`)

Optional (nullable): none.

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

Tables with a FK to `PublishStatus.pkid`:

- **Course** (`PublishStatus_pkid`, FK_Course_PublishStatus)
  - Column header: 對應課程 — shows `CourseCount`
  - Future button: 查看課程 (`pi pi-list`) → `/courses?publishStatusPkid={pkid}`
- **Promotion2** (`PublishStatus_pkid`, FK_Promotion2_PublishStatus)
  - Column header: 對應推廣項目 — shows `Promotion2Count`
  - Future button: 查看推廣項目 (`pi pi-list`) → `/promotions?publishStatusPkid={pkid}`

The Course / Promotion2 features do not exist yet, so this iteration shows **counts only** (list + detail);
link buttons are added when those list pages exist.

**Delete guard:** both FKs are enforced, so a status in use cannot be deleted. `DELETE` returns
`409 { message }` when `CourseCount + Promotion2Count > 0`; the list disables the delete button for in-use rows.

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Description`
- **IsDraft**: bool? — exact match
- **IsPublished**: bool? — exact match
- **IsDiscontinued**: bool? — exact match

Bool filters are tri-state in the drawer: `p-select` with 全部 (null) / 是 (true) / 否 (false).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/publish-statuses` | New | `{ pkid, description }[]` ordered by `pkid ASC` (for future Course / Promotion2 dropdowns) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/publish-statuses` | List all |
| `POST` | `/api/publish-statuses/query` | Filtered query (body: `PublishStatusQuery`) |
| `GET` | `/api/publish-statuses/{id:int}` | Get by pkid |
| `POST` | `/api/publish-statuses` | Create — **pkid from body**; duplicate pkid → `409 { message }` |
| `PUT` | `/api/publish-statuses` | Update (pkid from body; pkid itself is never changed) |
| `DELETE` | `/api/publish-statuses/{id:int}` | Delete; in use by Course/Promotion2 → `409 { message }` |
| `GET` | `/api/lookups/publish-statuses` | Lookup |

No auth exceptions.

---

## Backend Notes

### Models

```csharp
public class PublishStatus
{
    public byte Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
    public int CourseCount { get; set; }      // subquery
    public int Promotion2Count { get; set; }  // subquery
}

public class PublishStatusRequest
{
    [Range(1, 255)] public byte Pkid { get; set; }
    [Required, StringLength(50)] public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}

public class PublishStatusQuery
{
    public string? Keyword { get; set; }
    public bool? IsDraft { get; set; }
    public bool? IsPublished { get; set; }
    public bool? IsDiscontinued { get; set; }
}

public class PublishStatusLookup { public byte Pkid; public string Description; }
```

### SQL — SELECT

```sql
SELECT s.pkid, s.Description, s.IsDraft, s.IsPublished, s.IsDiscontinued,
       (SELECT COUNT(*) FROM Course c     WHERE c.PublishStatus_pkid = s.pkid) AS CourseCount,
       (SELECT COUNT(*) FROM Promotion2 p WHERE p.PublishStatus_pkid = s.pkid) AS Promotion2Count
FROM PublishStatus s
ORDER BY s.pkid ASC
```

### SQL — INSERT (no SCOPE_IDENTITY — pkid is supplied)

```sql
INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued);
```

### SQL — UPDATE

```sql
UPDATE PublishStatus
SET Description = @Description, IsDraft = @IsDraft, IsPublished = @IsPublished, IsDiscontinued = @IsDiscontinued
WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM PublishStatus WHERE pkid = @pkid` — controller checks usage counts first (409 if in use).

### Special Column Notes

- `pkid` is `tinyint` → C# `byte`; JSON number. Not IDENTITY.
- Constraint name is `PK_PublishingStatus` (typo in DB, irrelevant to code).
- RowAudit: no `RowAuditWriter` exists in the codebase yet — not logged.

---

## Frontend Notes

### Routes

| Path | Component |
|------|-----------|
| `/publish-statuses` | `PublishStatusList` |
| `/publish-statuses/new` | `PublishStatusForm` |
| `/publish-statuses/:id` | `PublishStatusDetail` |
| `/publish-statuses/:id/edit` | `PublishStatusForm` |

### Model

```ts
export interface PublishStatus {
  pkid: number; description: string;
  isDraft: boolean; isPublished: boolean; isDiscontinued: boolean;
  courseCount: number; promotion2Count: number;
}
export interface PublishStatusRequest { pkid: number; description: string; isDraft: boolean; isPublished: boolean; isDiscontinued: boolean; }
export interface PublishStatusQuery { keyword?: string | null; isDraft?: boolean | null; isPublished?: boolean | null; isDiscontinued?: boolean | null; }
```

### List

- Columns: 主代碼, 狀態名稱, 草稿, 已發布, 已停用 (check / dash icons, centered), 對應課程, 對應推廣項目, 操作.
- All sortable; default `pkid` ASC, 20 rows.
- Filter drawer: keyword input; three tri-state `p-select` (`appendTo="body"`).
- Delete disabled (tooltip 使用中無法刪除) when counts > 0.

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${item.pkid}</b>「${item.description}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `publish-status-list-filters` | Last query filter values |
| `publish-status-list-sort` | `{ field, order }` |
| `publish-status-list-page` | `{ first, rows }` |

### Form

| Field | Control | Notes |
|-------|---------|-------|
| 主代碼 | `p-inputNumber` (1–255, no grouping) | Required; **disabled in edit mode** |
| 狀態名稱 | `pInputText` | Required, max 50 |
| 草稿 / 已發布 / 已停用 | `p-checkbox` (binary) | Default false |

Duplicate pkid → 409 toast with server message.

### Detail

Fields as read-only `.view-value`; flags as 是/否; usage card showing 對應課程 / 對應推廣項目 counts.

### Sidebar

Existing group **系統管理 Admin** → `發布狀態 PublishStatus` (`pi pi-flag`) → `/publish-statuses`.

### Sub-panels

N/A

---

## Tests

### Backend (`CMS.API.Tests`)

- `FakePublishStatusRepository` (in-memory, seeded 1 草稿 / 2 上架中 / 3 已下架, pkid 2 in use), registered in `CmsApiFactory`.
- `PublishStatusesControllerTests`: get all ordered by pkid; query by keyword and by bool flag; get by id found / 404;
  create 201 + Location; duplicate pkid 409; missing description / pkid 0 → 400; update 200 / 404 / pkid 0 → 400;
  delete 204 / 404 / in use → 409; lookup endpoint.

### Frontend

- `publish-status.service.spec.ts` — URL/verb per method.
- `publish-status-list.spec.ts` — load, filters + session storage, delete confirm, in-use guard.
- `publish-status-detail.spec.ts` — renders fields, 404.
- `publish-status-form.spec.ts` — required validation, create / update payloads, pkid disabled in edit, 409 toast.
- `lookup.service.spec.ts` — add `getPublishStatuses()`.

---

## Files to Create / Modify

| Side | File | Action |
|------|------|--------|
| API | `Models/PublishStatus.cs`, `PublishStatusRequest.cs`, `PublishStatusQuery.cs`, `PublishStatusLookup.cs` | Create |
| API | `Repositories/IPublishStatusRepository.cs`, `PublishStatusRepository.cs` | Create |
| API | `Repositories/LookupRepository.cs`, `Controllers/LookupsController.cs` | Modify (lookup) |
| API | `Controllers/PublishStatusesController.cs` | Create |
| API | `Program.cs` | Modify (DI) |
| Tests | `FakePublishStatusRepository.cs`, `PublishStatusesControllerTests.cs` | Create |
| Tests | `CmsApiFactory.cs` | Modify |
| NG | `features/publish-statuses/publish-status.model.ts`, `publish-status.service.ts` (+spec) | Create |
| NG | `features/publish-statuses/publish-status-{list,detail,form}/*` (+specs) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+spec) | Modify |
| NG | `app.routes.ts`, `app.ts` | Modify |
