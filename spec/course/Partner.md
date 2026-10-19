# Build Spec for Partner
- database schema: `.\database\course.sql` (also duplicated in `.\database\promotion.sql`)

## Summary

`Partner` stores the vendor / technology partners (原廠) that courses, certifications and promotions belong to
(e.g. Microsoft, Cisco, Oracle). Each row carries a short internal name, an `AppKey` used by the public site
(URL / image key), the names shown on the partner menu and on the course-detail page, a display order and an
optional logo filename. 66 rows currently, most in use.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` smallint IDENTITY (C# `short`) |
| Foreign Keys | None |
| Required Fields | `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `DisplayOrder` |
| N-N Relationships | N/A |
| Primary-Foreign Links | `Course`, `Certification`, `PartnerCourseGroup`, `Promotion2.RelatedPartner_pkid` (FK-enforced); `Seminar.Partner_pkid` (no FK constraint) — counts only, link buttons deferred |
| Query Filters | keyword (`Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `ImageFilename`) |
| Default Sort | `DisplayOrder ASC, pkid DESC` |

---

## Localization

### Chinese Table Name

- Partner: 原廠
- Description: 課程／認證所屬的原廠（合作夥伴）

### Chinese Column Names

- pkid: 主代碼
- Name: 名稱
- AppKey: 應用代碼
- NameOnPartnerMenu: 原廠選單名稱
- NameOnCourseDetailPage: 課程頁名稱
- DisplayOrder: 顯示順序
- ImageFilename: 圖檔名稱
- (computed) CourseCount: 課程數
- (computed) CertificationCount: 認證數
- (computed) PartnerCourseGroupCount: 原廠課程群組數
- (computed) Promotion2Count: 推廣項目數
- (computed) SeminarCount: 講座數

---

## Required Fields

Required (NOT NULL):
- `Name` (max 50)
- `AppKey` (varchar 10 — ASCII only)
- `NameOnPartnerMenu` (max 200)
- `NameOnCourseDetailPage` (max 50)
- `DisplayOrder` (int, default 0)

Optional (nullable):
- `ImageFilename` (varchar 50 — ASCII only; blank → NULL)

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

Tables referencing `Partner.pkid`:

| Child | Column | FK enforced | Count field | Header | Future link |
|-------|--------|-------------|-------------|--------|-------------|
| Course | `Partner_pkid` | Yes | `CourseCount` | 對應課程 | `/courses?partnerPkid={pkid}` |
| Certification | `Partner_pkid` | Yes | `CertificationCount` | 對應認證 | `/certifications?partnerPkid={pkid}` |
| PartnerCourseGroup | `Partner_pkid` | Yes | `PartnerCourseGroupCount` | 對應原廠課程群組 | `/partner-course-groups?partnerPkid={pkid}` |
| Promotion2 | `RelatedPartner_pkid` | Yes | `Promotion2Count` | 對應推廣項目 | `/promotions?relatedPartnerPkid={pkid}` |
| Seminar | `Partner_pkid` | **No** (column only) | `SeminarCount` | 對應講座 | `/seminars?partnerPkid={pkid}` |

None of the child features exist yet, so this iteration shows **counts only** (list: 課程 / 認證 columns;
detail: all five in a usage card). Link buttons (`pi pi-list`) are added when those list pages exist.

**Delete guard:** `DELETE` returns `409 { message }` when the sum of all five counts > 0. Seminar is included
even though it has no FK, to avoid orphaned seminar rows. The list disables the delete button for in-use rows.

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `ImageFilename`

No FK, bool or date columns.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | New | `{ pkid, name }[]` ordered by `DisplayOrder, Name` (for future Course / Certification / PartnerCourseGroup / Promotion2 / Seminar dropdowns) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/partners` | List all |
| `POST` | `/api/partners/query` | Filtered query (body: `PartnerQuery`) |
| `GET` | `/api/partners/{id:int}` | Get by pkid |
| `POST` | `/api/partners` | Create → 201; duplicate `AppKey` → `409 { message }` |
| `PUT` | `/api/partners` | Update (pkid from body); `pkid` ≤ 0 → 400; duplicate `AppKey` (other row) → 409 |
| `DELETE` | `/api/partners/{id:int}` | Delete; in use → `409 { message }` |
| `GET` | `/api/lookups/partners` | Lookup |

`AppKey` has no UNIQUE constraint in the DB, but all 66 current values are distinct and it is used as a key by
the public site, so the API enforces uniqueness (case-insensitive under the default collation).

No auth exceptions.

---

## Backend Notes

### Models

```csharp
public class Partner
{
    public short Pkid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AppKey { get; set; } = string.Empty;
    public string NameOnPartnerMenu { get; set; } = string.Empty;
    public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string? ImageFilename { get; set; }
    public int CourseCount { get; set; }
    public int CertificationCount { get; set; }
    public int PartnerCourseGroupCount { get; set; }
    public int Promotion2Count { get; set; }
    public int SeminarCount { get; set; }
}

public class PartnerRequest
{
    public short Pkid { get; set; }   // ignored on POST, required on PUT
    [Required, StringLength(50)]  public string Name { get; set; } = string.Empty;
    [Required, StringLength(10), RegularExpression(@"^[\x20-\x7E]+$")] public string AppKey { get; set; } = string.Empty;
    [Required, StringLength(200)] public string NameOnPartnerMenu { get; set; } = string.Empty;
    [Required, StringLength(50)]  public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    [StringLength(50), RegularExpression(@"^[\x20-\x7E]*$")] public string? ImageFilename { get; set; }
}

public class PartnerQuery { public string? Keyword { get; set; } }

public class PartnerLookup { public short Pkid; public string Name; }
```

### SQL — SELECT

```sql
SELECT p.pkid, p.Name, p.AppKey, p.NameOnPartnerMenu, p.NameOnCourseDetailPage, p.DisplayOrder, p.ImageFilename,
       (SELECT COUNT(*) FROM Course c              WHERE c.Partner_pkid = p.pkid)        AS CourseCount,
       (SELECT COUNT(*) FROM Certification ce      WHERE ce.Partner_pkid = p.pkid)       AS CertificationCount,
       (SELECT COUNT(*) FROM PartnerCourseGroup g  WHERE g.Partner_pkid = p.pkid)        AS PartnerCourseGroupCount,
       (SELECT COUNT(*) FROM Promotion2 pr         WHERE pr.RelatedPartner_pkid = p.pkid) AS Promotion2Count,
       (SELECT COUNT(*) FROM Seminar s             WHERE s.Partner_pkid = p.pkid)        AS SeminarCount
FROM Partner p
ORDER BY p.DisplayOrder ASC, p.pkid DESC
```

### SQL — INSERT

```sql
INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

```sql
UPDATE Partner
SET Name = @Name, AppKey = @AppKey, NameOnPartnerMenu = @NameOnPartnerMenu,
    NameOnCourseDetailPage = @NameOnCourseDetailPage, DisplayOrder = @DisplayOrder, ImageFilename = @ImageFilename
WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM Partner WHERE pkid = @pkid` — controller checks usage counts first (409 if in use).

### Special Column Notes

- `pkid` is `smallint` → C# `short`.
- `AppKey` / `ImageFilename` are `varchar` (non-Unicode) — validated as printable ASCII; passed as `DbType.AnsiString`.
- String inputs are trimmed by the controller; blank `ImageFilename` stored as NULL.
- RowAudit: no `RowAuditWriter` exists in the codebase yet — not logged.

---

## Frontend Notes

### Routes

| Path | Component |
|------|-----------|
| `/partners` | `PartnerList` |
| `/partners/new` | `PartnerForm` |
| `/partners/:id` | `PartnerDetail` |
| `/partners/:id/edit` | `PartnerForm` |

### Model

```ts
export interface Partner {
  pkid: number; name: string; appKey: string;
  nameOnPartnerMenu: string; nameOnCourseDetailPage: string;
  displayOrder: number; imageFilename: string | null;
  courseCount: number; certificationCount: number; partnerCourseGroupCount: number;
  promotion2Count: number; seminarCount: number;
}
export interface PartnerRequest { pkid?: number; name: string; appKey: string; nameOnPartnerMenu: string; nameOnCourseDetailPage: string; displayOrder: number; imageFilename: string | null; }
export interface PartnerQuery { keyword?: string | null; }
```

### List

- Columns: 主代碼, 名稱, 應用代碼, 原廠選單名稱, 顯示順序, 圖檔名稱, 對應課程, 對應認證, 操作.
- All sortable; default `displayOrder` ASC (ties broken by pkid DESC from the API), 20 rows.
- Filter drawer: keyword input.
- Delete disabled (tooltip 使用中無法刪除) when any count > 0.

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${item.pkid}</b>「${item.name}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `partner-list-filters` | Last query filter values |
| `partner-list-sort` | `{ field, order }` |
| `partner-list-page` | `{ first, rows }` |

### Form

| Field | Control | Notes |
|-------|---------|-------|
| 名稱 | `pInputText` | Required, max 50 |
| 應用代碼 | `pInputText` | Required, max 10, ASCII; duplicate → 409 toast |
| 原廠選單名稱 | `pInputText` | Required, max 200 |
| 課程頁名稱 | `pInputText` | Required, max 50 |
| 顯示順序 | `p-inputNumber` (no grouping) | Required, default 0 |
| 圖檔名稱 | `pInputText` | Optional, max 50, ASCII |

### Detail

Fields as read-only `.view-value`; usage card showing all five counts.

### Sidebar

New group **課程管理 Course** → `原廠 Partner` (`pi pi-building`) → `/partners`.

### Sub-panels

N/A

---

## Tests

### Backend (`CMS.API.Tests`)

- `FakePartnerRepository` (in-memory, seeded with a few partners, one in use), registered in `CmsApiFactory`.
- `PartnersControllerTests`: get all ordered by DisplayOrder; query by keyword; get by id found / 404;
  create 201 + Location; duplicate AppKey 409; missing name / non-ASCII AppKey → 400; update 200 / 404 / pkid 0 → 400 /
  duplicate AppKey 409; delete 204 / 404 / in use → 409; lookup endpoint.
- `FakeLookupRepository` — add `GetPartnersAsync()`.

### Frontend

- `partner.service.spec.ts` — URL/verb per method.
- `partner-list.spec.ts` — load, filters + session storage, delete confirm, in-use guard.
- `partner-detail.spec.ts` — renders fields, 404.
- `partner-form.spec.ts` — required validation, create / update payloads, 409 toast.
- `lookup.service.spec.ts` — add `getPartners()`.

---

## Files to Create / Modify

| Side | File | Action |
|------|------|--------|
| API | `Models/Partner.cs`, `PartnerRequest.cs`, `PartnerQuery.cs`, `PartnerLookup.cs` | Create |
| API | `Repositories/IPartnerRepository.cs`, `PartnerRepository.cs` | Create |
| API | `Repositories/LookupRepository.cs`, `Controllers/LookupsController.cs` | Modify (lookup) |
| API | `Controllers/PartnersController.cs` | Create |
| API | `Program.cs` | Modify (DI) |
| Tests | `FakePartnerRepository.cs`, `PartnersControllerTests.cs` | Create |
| Tests | `CmsApiFactory.cs`, `FakeLookupRepository.cs` | Modify |
| NG | `features/partners/partner.model.ts`, `partner.service.ts` (+spec) | Create |
| NG | `features/partners/partner-{list,detail,form}/*` (+specs) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+spec) | Modify |
| NG | `app.routes.ts`, `app.ts` | Modify |
