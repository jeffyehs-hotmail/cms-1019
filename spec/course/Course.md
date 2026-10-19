# Build Spec for Course
- database schema: `.\database\course.sql`

## Summary

`Course` (課程) is the main training-course table. Each course belongs to a partner (原廠), can optionally
belong to a course group, and has a publish status. It also stores the dates it is listed and delisted,
the hours, price and learning credit, and the long descriptive texts (objective, outline, prerequisites, and so on).
There are 1,084 rows now.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` int IDENTITY |
| Foreign Keys | `Partner_pkid` → `Partner` (smallint), `CourseGroup_pkid` → `CourseGroup` (smallint, **nullable**), `PublishStatus_pkid` → `PublishStatus` (tinyint) |
| Required Fields | `Title`, `CourseId`, `ProdCourseId`, `FriendlyUrl`, `DisplayOrder`, `Partner_pkid`, `PublishStatus_pkid`, `ScheduleOn`, `ScheduleOff`, `Hour`, `ListPrice`, `LearningCredit`, `CanRepeat` |
| N-N Relationships | `CourseInCertification` (↔ `Certification`), `CourseJobCategories` (↔ `JobCategory`). Both cascade on delete |
| Primary-Foreign Links | `CourseFAQ`, `CourseRelatedLink`, `HotCourse` (FKs with no cascade, so they block delete; counts only). `CourseRecomm` (linked by the `CourseId` string, no FK) |
| Query Filters | keyword, partner, course group, publish status, ScheduleOn range, ScheduleOff range, CanRepeat |
| Default Sort | `DisplayOrder ASC, pkid DESC` |

---

## Localization

### Chinese Table Name

- Course: 課程
- Description: 訓練課程主資料

### Chinese Column Names

Labels supplied by the user are marked ★.

- pkid: 主代碼 ★
- Title: 課程名稱 ★
- OfficialTitle: 官方課程名稱
- CourseId: 簡介代碼 ★
- ProdCourseId: 科目代碼 ★
- FriendlyUrl: 友善網址
- DisplayOrder: 顯示順序 ★
- Partner_pkid: 原廠 ★
- CourseGroup_pkid: 課程群組 ★
- PublishStatus_pkid: 上架狀態 ★
- ScheduleOn: 上架日期 ★
- ScheduleOff: 下架日期 ★
- Hour: 時數 ★
- ListPrice: 定價 ★
- LearningCredit: 點數 ★
- Material: 教材
- Objective: 課程目標
- Target: 適合對象
- Prerequisites: 預備知識
- Outline: 課程大綱
- TowardCertOrExam: 相關認證／考試
- Note: 備註
- OtherInfo: 其他資訊
- CanRepeat: 允許重聽 ★
- (N-N) CertificationPkids: 相關認證
- (N-N) JobCategoryPkids: 職務類別
- (computed) CourseFaqCount: 課程問答數
- (computed) CourseRelatedLinkCount: 相關連結數
- (computed) HotCourseCount: 熱門課程數

---

## Required Fields

Required (NOT NULL):
- `Title` nvarchar(200)
- `CourseId` varchar(50). ASCII only, **unique** (enforced by the API)
- `ProdCourseId` varchar(50). ASCII only, not unique (1,000 distinct values across 1,084 rows)
- `FriendlyUrl` nvarchar(100). Not unique (125 values are repeated in the data)
- `DisplayOrder` int, default 0
- `Partner_pkid`, `PublishStatus_pkid`
- `ScheduleOn`, `ScheduleOff` date. The API rejects `ScheduleOff < ScheduleOn` with 400. One existing row breaks this rule and has to be fixed when it is next edited.
- `Hour` smallint ≥ 0 (DB default 0)
- `ListPrice` decimal(9,0) ≥ 0 (DB default 0)
- `LearningCredit` decimal(9,1) ≥ 0 (DB default 0)
- `CanRepeat` bit (DB default 0)

Optional (nullable):
- `OfficialTitle` nvarchar(300), `CourseGroup_pkid`
- `Material` nvarchar(500), `Target` nvarchar(500)
- `Objective`, `Prerequisites`, `Note`, `OtherInfo` nvarchar(4000)
- `Outline`, `TowardCertOrExam` nvarchar(max)

Optional strings that are left blank are stored as NULL. All strings are trimmed by the controller.

---

## Foreign Keys

- **Partner_pkid** → `Partner.pkid` (smallint). Aliased as `PartnerPkid`. Label `Partner.Name` (list column 原廠, `PartnerName`). Lookup `GET /api/lookups/partners` (exists, ordered by `DisplayOrder, Name`).
- **CourseGroup_pkid** → `CourseGroup.pkid` (smallint, **nullable**). Aliased as `CourseGroupPkid`. Label `CourseGroup.Description` (`CourseGroupDescription`, LEFT JOIN). Lookup `GET /api/lookups/course-groups` (exists, ordered by `Description`, 215 items, so use filter + virtual scroll). The dropdown is clearable (`[showClear]`), so the value can be null.
- **PublishStatus_pkid** → `PublishStatus.pkid` (tinyint). Aliased as `PublishStatusPkid`. Label `PublishStatus.Description` (`PublishStatusDescription`). Lookup `GET /api/lookups/publish-statuses` (exists, ordered by `pkid`).

The list and detail pages get the labels from the API through JOINs in the SELECT, so the list doesn't need lookups to show them. The lookups only fill the filter drawer and the form dropdowns.

The API checks every FK value before INSERT/UPDATE. An unknown partner, course group or publish status → 400 `{ message }`, rather than a SQL FK error.

---

## Foreign-Primary Links

On the detail page, the FK labels link to the parent's detail page:
- 原廠 → `/partners/{partnerPkid}`
- 課程群組 → `/course-groups/{courseGroupPkid}` (only when not null)
- 上架狀態 → `/publish-statuses/{publishStatusPkid}`

The list shows plain labels, to keep the table compact.

---

## Primary-Foreign Links

Tables referencing `Course`:

| Child | Column | FK | On delete | Count field | Handling |
|-------|--------|----|-----------|-------------|----------|
| CourseFAQ | `Course_pkid` | Yes | no action | `CourseFaqCount` | Blocks delete |
| CourseRelatedLink | `Course_pkid` | Yes | no action | `CourseRelatedLinkCount` | Blocks delete |
| HotCourse | `Course_pkid` | Yes | no action | `HotCourseCount` | Blocks delete |
| CourseInCertification | `Course_pkid` | Yes | CASCADE | n/a | N-N (see below) |
| CourseJobCategories | `Course_pkid` | Yes | CASCADE | n/a | N-N (see below) |
| CourseRecomm | `CourseId` / `RecommCourseId` (varchar) | **No** | n/a | n/a | Kept in sync by the API (see below) |

None of the child features exist yet, so link buttons are deferred. The detail page shows the three counts in a usage card.

**Delete guard:** `DELETE` → `409 { message }` when `CourseFaqCount + CourseRelatedLinkCount + HotCourseCount > 0`.
The list disables the delete button for those rows (tooltip 使用中無法刪除).

**CourseRecomm** links courses by the `CourseId` string, not by pkid. 766 courses appear in it, and 895 of its rows are already orphans.
Counting it in the delete guard would make most courses impossible to delete. The API handles it this way instead:
- **Delete**: in the same transaction, delete the `CourseRecomm` rows where `CourseId = @CourseId OR RecommCourseId = @CourseId`. The N-N junction rows are removed by the DB cascade.
- **Update with a changed `CourseId`**: in the same transaction, update `CourseRecomm.CourseId` and `CourseRecomm.RecommCourseId` from the old value to the new one, so the recommendations follow the course.

**Incoming links from existing features** (enabled now that Course exists):
- Partner detail, 課程 count → `/courses?partnerPkid={pkid}`
- CourseGroup detail, 課程 count → `/courses?courseGroupPkid={pkid}`
- PublishStatus detail, 課程 count → `/courses?publishStatusPkid={pkid}`

The Course list reads those query params (see Session Storage).

---

## N-N Relationships

### CourseInCertification: Course ↔ Certification
- Junction columns: `Course_pkid` int, `Certification_pkid` int. 113 rows. Certification has 39 rows.
- Request field: `CertificationPkids: List<int>`. Response: `Certifications: List<CertificationLookup>`, filled only by GET by id.
- Lookup: **new** `GET /api/lookups/certifications` → `{ pkid, title, partnerName }`. `Title` is **nchar(100)**, so the query uses `RTRIM(ce.Title)`. It is ordered by `Partner.DisplayOrder, Partner.Name, Title`. The label is `partnerName ‧ title`.
- Form: `p-multiselect` with filter, `[maxSelectedLabels]="9999"`, chips wrapped.
- Detail: chip list of labels.

### CourseJobCategories: Course ↔ JobCategory
- Junction columns: `Course_pkid` int, `JobCategory_pkid` smallint. 1,048 rows. JobCategory has 18 rows.
- Request field: `JobCategoryPkids: List<short>`. Response: `JobCategories: List<JobCategoryLookup>`, filled only by GET by id.
- Lookup: **new** `GET /api/lookups/job-categories` → `{ pkid, description }`, ordered by `Description`.
- Form: `p-multiselect`. Detail: chips.

Sync on create/update, in the same transaction as the Course write:
```sql
DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid;
INSERT INTO CourseInCertification (Course_pkid, Certification_pkid) VALUES (@Pkid, @Id);   -- per distinct id
DELETE FROM CourseJobCategories WHERE Course_pkid = @Pkid;
INSERT INTO CourseJobCategories (Course_pkid, JobCategory_pkid) VALUES (@Pkid, @Id);
```
Unknown certification or job-category ids → 400. Duplicate ids are removed before insert.

---

## Query Filters

`CourseQuery`:
- **keyword**: LIKE on `Title`, `OfficialTitle`, `CourseId`, `ProdCourseId`, `FriendlyUrl`. The large text columns are not searched.
- **partnerPkid** `short?`: exact match on `Partner_pkid` (lookup partners, 66 items, filter on).
- **courseGroupPkid** `short?`: exact match on `CourseGroup_pkid` (lookup course-groups, filter + virtual scroll).
- **publishStatusPkid** `byte?`: exact match on `PublishStatus_pkid`.
- **scheduleOnFrom / scheduleOnTo** `DateOnly?`: `ScheduleOn` between the two dates, inclusive.
- **scheduleOffFrom / scheduleOffTo** `DateOnly?`: `ScheduleOff` between the two dates, inclusive.
- **canRepeat** `bool?`: tri-state (all / yes / no).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | Exists | `{ pkid, name }` |
| `GET /api/lookups/course-groups` | Exists | `{ pkid, description }` |
| `GET /api/lookups/publish-statuses` | Exists | `{ pkid, description }` |
| `GET /api/lookups/certifications` | **New** | `{ pkid, title, partnerName }` (RTRIM title) |
| `GET /api/lookups/job-categories` | **New** | `{ pkid, description }` |
| `GET /api/lookups/courses` | **New** | `{ pkid, courseId, title }` ordered by `CourseId`. Course is an FK target, so this is for the future CourseFAQ / CourseRelatedLink / HotCourse dropdowns |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/courses` | List all (list columns only, no long texts) |
| `POST` | `/api/courses/query` | Filtered query (body: `CourseQuery`), list columns only |
| `GET` | `/api/courses/{id:int}` | Full record + `Certifications` + `JobCategories` |
| `POST` | `/api/courses` | Create → 201. Duplicate `CourseId` → 409. Bad FK / N-N id, or `ScheduleOff < ScheduleOn` → 400 |
| `PUT` | `/api/courses` | Update (pkid from body). `pkid ≤ 0` → 400. Duplicate `CourseId` (on another row) → 409. Not found → 404 |
| `DELETE` | `/api/courses/{id:int}` | In use (FAQ / related link / hot course) → 409. Otherwise also deletes the `CourseRecomm` rows |

Not included from `spec/sample1.spec.md`: the copy action, QR code, print to PDF, and the CourseRelatedLink / CourseRecomm sub-panels. They depend on features or utilities that don't exist yet.

No auth exceptions.

---

## Backend Notes

### Models

```csharp
public class Course
{
    public int Pkid { get; set; }
    public string Title { get; set; } = "";
    public string? OfficialTitle { get; set; }
    public string CourseId { get; set; } = "";
    public string ProdCourseId { get; set; } = "";
    public string FriendlyUrl { get; set; } = "";
    public int DisplayOrder { get; set; }
    public short PartnerPkid { get; set; }
    public string PartnerName { get; set; } = "";
    public short? CourseGroupPkid { get; set; }
    public string? CourseGroupDescription { get; set; }
    public byte PublishStatusPkid { get; set; }
    public string PublishStatusDescription { get; set; } = "";
    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }
    public bool CanRepeat { get; set; }
    // Long texts: null in list results, filled by GET by id
    public string? Material, Objective, Target, Prerequisites, Outline, TowardCertOrExam, Note, OtherInfo;
    public int CourseFaqCount, CourseRelatedLinkCount, HotCourseCount;
    // GET by id only
    public List<CertificationLookup> Certifications = [];
    public List<JobCategoryLookup> JobCategories = [];
}

public class CourseRequest
{
    public int Pkid;                                                     // ignored on POST
    [Required, StringLength(200)] Title;  [StringLength(300)] OfficialTitle;
    [Required, StringLength(50), ASCII] CourseId;  [Required, StringLength(50), ASCII] ProdCourseId;
    [Required, StringLength(100)] FriendlyUrl;
    int DisplayOrder;
    [Range(1, short.MaxValue)] short PartnerPkid;  short? CourseGroupPkid;  [Range(1, 255)] byte PublishStatusPkid;
    [Required] DateOnly? ScheduleOn;  [Required] DateOnly? ScheduleOff;
    [Range(0, short.MaxValue)] short Hour;
    [Range(0, 999999999)] decimal ListPrice;  [Range(0, 99999999.9)] decimal LearningCredit;
    [StringLength(500)] Material, Target;  [StringLength(4000)] Objective, Prerequisites, Note, OtherInfo;
    string? Outline, TowardCertOrExam;   // nvarchar(max)
    bool CanRepeat;
    List<int> CertificationPkids = [];  List<short> JobCategoryPkids = [];
}

public class CourseQuery { Keyword; short? PartnerPkid; short? CourseGroupPkid; byte? PublishStatusPkid;
    DateOnly? ScheduleOnFrom, ScheduleOnTo, ScheduleOffFrom, ScheduleOffTo; bool? CanRepeat; }

public class CourseLookup { int Pkid; string CourseId; string Title; }
public class CertificationLookup { int Pkid; string Title; string PartnerName; }
public class JobCategoryLookup { short Pkid; string Description; }
```

`ListPrice` and `LearningCredit` must have no more decimal places than their columns allow (0 and 1). The controller checks `decimal.Round(x, n) == x` and returns 400 if not.

### SQL: SELECT

The list (`GetAll` / `Query`) leaves out the 8 long-text columns:
```sql
SELECT c.pkid, c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl, c.DisplayOrder,
       c.Partner_pkid AS PartnerPkid, p.Name AS PartnerName,
       c.CourseGroup_pkid AS CourseGroupPkid, g.Description AS CourseGroupDescription,
       c.PublishStatus_pkid AS PublishStatusPkid, s.Description AS PublishStatusDescription,
       c.ScheduleOn, c.ScheduleOff, c.Hour, c.ListPrice, c.LearningCredit, c.CanRepeat,
       (SELECT COUNT(*) FROM CourseFAQ f WHERE f.Course_pkid = c.pkid) AS CourseFaqCount,
       (SELECT COUNT(*) FROM CourseRelatedLink l WHERE l.Course_pkid = c.pkid) AS CourseRelatedLinkCount,
       (SELECT COUNT(*) FROM HotCourse h WHERE h.Course_pkid = c.pkid) AS HotCourseCount
FROM Course c
JOIN Partner p ON p.pkid = c.Partner_pkid
LEFT JOIN CourseGroup g ON g.pkid = c.CourseGroup_pkid
JOIN PublishStatus s ON s.pkid = c.PublishStatus_pkid
ORDER BY c.DisplayOrder ASC, c.pkid DESC
```
GET by id adds `c.Material, c.Objective, …, c.OtherInfo`. On the same connection it also runs:
```sql
SELECT ce.pkid, RTRIM(ce.Title) AS Title, p.Name AS PartnerName FROM CourseInCertification x
  JOIN Certification ce ON ce.pkid = x.Certification_pkid JOIN Partner p ON p.pkid = ce.Partner_pkid
  WHERE x.Course_pkid = @pkid ORDER BY p.DisplayOrder, p.Name, ce.Title;
SELECT j.pkid, j.Description FROM CourseJobCategories x JOIN JobCategory j ON j.pkid = x.JobCategory_pkid
  WHERE x.Course_pkid = @pkid ORDER BY j.Description;
```

### SQL: INSERT

```sql
INSERT INTO Course (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
    Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff, Hour, ListPrice,
    LearningCredit, Material, Objective, Target, Prerequisites, Outline, TowardCertOrExam, Note, OtherInfo, CanRepeat)
VALUES (@Title, …, @CanRepeat);
SELECT CAST(SCOPE_IDENTITY() AS int);
```
Followed by the N-N sync. Everything runs in one transaction.

### SQL: UPDATE

The same columns, `WHERE pkid = @Pkid`. In one transaction:
1. Read the old `CourseId` (missing row → return false).
2. UPDATE Course.
3. If `CourseId` changed: `UPDATE CourseRecomm SET CourseId = @New WHERE CourseId = @Old`, and the same for `RecommCourseId`.
4. N-N sync.

### SQL: DELETE

In one transaction: `DELETE FROM CourseRecomm WHERE CourseId = @CourseId OR RecommCourseId = @CourseId`, then
`DELETE FROM Course WHERE pkid = @pkid`. The N-N junction rows cascade. The controller has already checked the guard counts.

### Special Column Notes

- `CourseId`, `ProdCourseId` (and `CourseRecomm.*`) are **varchar**. They are validated as printable ASCII and sent as `DbType.AnsiString`, size 50. All current values are ASCII.
- `CourseId` uniqueness: `CourseIdExistsAsync(courseId, excludePkid)` → 409 on create and update. The data has no duplicates (1,084 distinct values).
- `Certification.Title` is **nchar(100)**, so it is `RTRIM`ed.
- `ScheduleOn` / `ScheduleOff` are `date` → `DateOnly`. The Dapper handler is already registered.
- RowAudit: no `RowAuditWriter` exists yet, so changes are not logged.

---

## Frontend Notes

### Routes

| Path | Component |
|------|-----------|
| `/courses` | `CourseList` |
| `/courses/new` | `CourseForm` |
| `/courses/:id` | `CourseDetail` |
| `/courses/:id/edit` | `CourseForm` |

### Model (`features/courses/course.model.ts`)

`Course`, `CourseRequest`, `CourseQuery` mirror the C# models in camelCase. Dates are ISO `yyyy-MM-dd` strings.
`CourseLookup`, `CertificationLookup` and `JobCategoryLookup` go in `core/models/lookup.model.ts`.

### List

Columns (user-specified, in this order), followed by 操作:

| Header | Field | Notes |
|--------|-------|-------|
| 主代碼 | `pkid` | |
| 顯示順序 | `displayOrder` | centered |
| 簡介代碼 | `courseId` | |
| 科目代碼 | `prodCourseId` | |
| 課程名稱 | `title` | |
| 原廠 | `partnerName` | JOINed label |
| 課程群組 | `courseGroupDescription` | JOINed label, blank when null |
| 上架狀態 | `publishStatusDescription` | `p-tag` |
| 上架日期 | `scheduleOn` | `yyyy/MM/dd` |
| 下架日期 | `scheduleOff` | `yyyy/MM/dd` |
| 時數 | `hour` | right-aligned |
| 定價 | `listPrice` | `number:'1.0-0'`, right-aligned |
| 點數 | `learningCredit` | `number:'1.1-1'`, right-aligned |
| 允許重聽 | `canRepeat` | check icon |

- All columns are sortable. Default `displayOrder` ASC (the API breaks ties with pkid DESC). 20 rows per page.
- Filter drawer: keyword; 原廠 / 課程群組 / 上架狀態 `p-select` (`appendTo="body"`, `[showClear]`, filter on partner and course group, virtual scroll on course group); 上架日期 起/迄 and 下架日期 起/迄 `p-datepicker`; 允許重聽 tri-state `p-select` (全部/是/否). The drawer loads lookups with `forkJoin` the first time it opens.
- Delete is disabled when `courseFaqCount + courseRelatedLinkCount + hotCourseCount > 0`.

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${item.pkid}</b>「${item.courseId} ${item.title}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-list-filters` | Last query filter values |
| `course-list-sort` | `{ field, order }` |
| `course-list-page` | `{ first, rows }` |

The incoming query params `partnerPkid`, `courseGroupPkid` and `publishStatusPkid` **replace** the saved filters: the other filters are cleared and the page goes back to 0. The result is saved to session.

### Date Handling

- `toIsoDate(d)` uses local date components, never `toISOString()`. `parseIsoDate('yyyy-MM-dd')` → local `Date`. New file `core/utils/date.util.ts` (+ spec).

### Form

Layout: a sticky toolbar (取消 / 儲存) and three cards.

**基本資料**
| Field | Control | Notes |
|-------|---------|-------|
| 主代碼 | read-only text | edit only |
| 簡介代碼 | `pInputText` | Required, max 50, ASCII. Duplicate → 409 toast |
| 科目代碼 | `pInputText` | Required, max 50, ASCII |
| 課程名稱 | `pInputText` | Required, max 200 |
| 官方課程名稱 | `pInputText` | max 300 |
| 友善網址 | `pInputText` | Required, max 100 |
| 原廠 | `p-select` filter | Required |
| 課程群組 | `p-select` filter + virtual scroll, clearable | Optional |
| 上架狀態 | `p-select` | Required |
| 顯示順序 | `p-inputNumber` (no grouping) | Required, default 0 |

**上架與價格**
| Field | Control | Notes |
|-------|---------|-------|
| 上架日期 | `p-datepicker` `yy/mm/dd` | Required. New form defaults to today |
| 下架日期 | `p-datepicker` | Required, must be ≥ 上架日期 (form-level validator). New form defaults to Dec 31 of next year (the most common pattern in the data) |
| 時數 | `p-inputNumber` 0–32767 | Required, default 0 |
| 定價 | `p-inputNumber` 0 decimals, grouping | Required, default 0 |
| 點數 | `p-inputNumber` 1 decimal | Required, default 0 |
| 允許重聽 | `p-toggleswitch` | default false |
| 相關認證 | `p-multiselect` filter, chips | N-N |
| 職務類別 | `p-multiselect` chips | N-N |

**課程內容**: `textarea pTextarea` with `autoResize` for 教材 (500), 適合對象 (500), 課程目標 (4000), 預備知識 (4000), 課程大綱 (max), 相關認證／考試 (max), 備註 (4000), 其他資訊 (4000).

Lookups (partners, course groups, publish statuses, certifications, job categories, and the course in edit mode) load with one `forkJoin`.
After saving, the app goes to the detail page.

### Detail

Same three cards as read-only `.view-value`. The FK labels are links (see Foreign-Primary Links). The N-N items show as chips. The long texts keep their line breaks (`white-space: pre-wrap`). A usage card shows 課程問答 / 相關連結 / 熱門課程 counts.
The toolbar has 返回 / 編輯 / 刪除. 刪除 is disabled when the course is in use.

### Sidebar

Existing group **課程管理 Course** → `課程 Course` (`pi pi-book`) → `/courses`.

### Sub-panels

N/A (deferred until the CourseRelatedLink / CourseRecomm features exist).

---

## Tests

### Backend (`CMS.API.Tests`)
- `FakeCourseRepository` (in memory, seeded with a few courses, one of them in use), registered in `CmsApiFactory`. The FK and N-N validation goes through repository methods (`ForeignKeysExistAsync`…), so the fake implements them too.
- `CoursesControllerTests`: get all in default order; query by keyword / partner / canRepeat / date range; get by id found / 404; create 201 + Location; duplicate CourseId → 409; missing title / non-ASCII CourseId / ScheduleOff < ScheduleOn / unknown partner → 400; update 200 / 404 / pkid 0 → 400 / duplicate CourseId → 409; delete 204 / 404 / in use → 409; the three new lookup endpoints.
- `FakeLookupRepository`: add `GetCertificationsAsync`, `GetJobCategoriesAsync`, `GetCoursesAsync`.

### Frontend
- `course.service.spec.ts`: URL and verb for each method.
- `course-list.spec.ts`: loads, filters + session storage, query param override, delete confirm, in-use guard.
- `course-detail.spec.ts`: renders fields + chips, 404.
- `course-form.spec.ts`: required validation, date-range validator, create / update payloads (ISO dates, N-N ids), 409 toast.
- `date.util.spec.ts`; `lookup.service.spec.ts` adds the three new methods.
- Partner / CourseGroup / PublishStatus detail specs: course-count link.

---

## Files to Create / Modify

| Side | File | Action |
|------|------|--------|
| API | `Models/Course.cs`, `CourseRequest.cs`, `CourseQuery.cs`, `CourseLookup.cs`, `CertificationLookup.cs`, `JobCategoryLookup.cs` | Create |
| API | `Repositories/ICourseRepository.cs`, `CourseRepository.cs` | Create |
| API | `Controllers/CoursesController.cs` | Create |
| API | `Repositories/LookupRepository.cs`, `Controllers/LookupsController.cs` | Modify (3 lookups) |
| API | `Program.cs` | Modify (DI) |
| Tests | `FakeCourseRepository.cs`, `CoursesControllerTests.cs` | Create |
| Tests | `CmsApiFactory.cs`, `FakeLookupRepository.cs` | Modify |
| NG | `features/courses/course.model.ts`, `course.service.ts` (+spec) | Create |
| NG | `features/courses/course-{list,detail,form}/*` (+specs) | Create |
| NG | `core/utils/date.util.ts` (+spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+spec) | Modify |
| NG | `features/{partners,course-groups,publish-statuses}/*-detail` (+specs) | Modify (course-count link) |
| NG | `app.routes.ts`, `app.ts` | Modify |
| Docs | `CLAUDE.md` | Modify (Course feature notes) |
