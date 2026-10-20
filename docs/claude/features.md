# Feature notes

Per-feature decisions that aren't obvious from the code. Read the section for a feature before changing it, or one that is FK-related to it. Full specs are in `spec/{sub-system}/{Table}.md`. Add a section here (and a row to the index in CLAUDE.md) when you build a new feature.

## AppRole — 系統管理 Admin › 角色 (`database/auth.sql`)
- Table PK `RoleId` (nvarchar), immutable on update (referenced by `AppUserRole`); `pkid` used for routes/PUT. Duplicate → 409.
- n-n users via `AppUserRole` (string keys): `UserIds: List<string>`, `UserCount` in list, `Users` on GET by id. Delete removes `AppUserRole` rows first.
- Filters: keyword (RoleId, RoleName, Description), `permissionLevelFrom`/`To`. Sort `RoleId ASC`. `Description` optional; `PermissionLevel` defaults to 100.
- Lookup `app-users` (ordered by UserName). Detail page's user count links to `/app-users?roleId=`.

## AppUser — 系統管理 Admin › 使用者 (`database/auth.sql`, `spec/auth/AppUser.md`)
- Table PK `UserId` (nvarchar), immutable on update; `pkid` used for routes/PUT. Duplicate → 409.
- **`PasswordHash` never leaves the backend** (no model has it; the SELECT skips it). Format: lowercase hex SHA-256 of the UTF-8 password, unsalted (`Security/PasswordHasher`), matching existing rows.
- Create hashes `SysConfig['appConfig'].defaultPassword` and sets `PasswordUpdatedTime = NULL`. Update never touches the password. `POST /api/app-users/{id}/reset-password` restores the default hash, time → NULL (detail page 重設密碼). Missing appConfig/defaultPassword → 500 `{ message }`.
- n-n roles via `AppUserRole`: `RoleIds: List<string>`, unknown ids → 400 (`CheckRolesAsync`). Delete removes the user's role rows first.
- Filters: keyword (UserId, UserName), tri-state `isActive`, `roleId` (also `?roleId=`). Sort `UserId ASC`.
- Lookup `app-roles` (`{ pkid, roleId, roleName }`, by RoleId).
- No password field in the form (new mode shows a default-password hint). `PasswordUpdatedTime` is displayed as returned (no `'Z'`); NULL shows 尚未變更（預設密碼）.
- Data: seed user `admin@example.com` (pkid 14, role `Admin`), roles `Admin`/`User`. The default password lives only in `SysConfig` (never copy it into the repo, which is public).

## Auth (login) — no UI yet (`database/admin.sql`)
- `POST /api/auth/login` `{ userId, password }` → 200 `{ userId, userName, accessToken }`. `AuthController` + `IAuthRepository` (own repo; `LoginUser` is the only model holding `PasswordHash`, never returned).
- Checks: UserId **exact** (the DB collation `Chinese_Taiwan_Stroke_CI_AS` is case-insensitive and `=` ignores trailing spaces, so the controller re-compares ordinally), `IsActive = 1`, `PasswordHash` = SHA-256 hex (constant-time, hex case ignored). Any failure → 401 `{ message: "帳號或密碼錯誤" }`, identical for every reason.
- JWT (`Security/AccessTokenIssuer`, `Microsoft.IdentityModel.JsonWebTokens`): HS256 signed with `SysConfig[appConfig].symmetricSecurityKey` (UTF-8 bytes, read per request, must be >= 32 bytes; else 500 `{ message }`). Claims `sub` = UserId, `name` = UserName, `role` (array, one per `AppUserRole.RoleId`, omitted when none), `jti`; `iat`/`nbf` = now (`TimeProvider`), `exp` = +24h. No issuer/audience.
- Deferred: no JwtBearer validation middleware / `[Authorize]` on the other controllers yet, no frontend login page, no refresh token.

## PublishStatus — 系統管理 Admin › 發布狀態 (`database/admin.sql`, `spec/admin/PublishStatus.md`)
- PK `pkid` **tinyint, not IDENTITY** (C# `byte`): entered on create (1–255, duplicate → 409), disabled on edit.
- Referenced by `Course`, `Promotion2`: `CourseCount`/`Promotion2Count`; in use → DELETE 409.
- Filters: keyword (Description), tri-state `isDraft`/`isPublished`/`isDiscontinued`. Sort `pkid ASC`.
- Lookup `publish-statuses` (`{ pkid, description }`, by pkid).
- Data: 1 草稿 / 2 上架中 / 3 已下架, all in use. Course count links to `/courses?publishStatusPkid=`; Promotion2 link deferred.

## Partner — 課程管理 Course › 原廠 (`database/course.sql`, `spec/course/Partner.md`)
- PK `pkid` **smallint IDENTITY** (C# `short`).
- `AppKey` (varchar 10) unique in the API only → 409 on create/update. `AppKey`/`ImageFilename` are varchar (ASCII, AnsiString). Blank `ImageFilename` → NULL.
- Referenced by `Course`, `Certification`, `PartnerCourseGroup`, `Promotion2.RelatedPartner_pkid` (FKs) and `Seminar.Partner_pkid` (**no FK**). All five counts in the SELECT; DELETE → 409 if any > 0. List shows course/certification counts, detail all five.
- Filter: keyword (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, ImageFilename). Sort `DisplayOrder ASC, pkid DESC`.
- Lookup `partners` (`{ pkid, name }`, by DisplayOrder, Name).
- Data: 66 rows, most in use. Course count links to `/courses?partnerPkid=`; Promotion2 will use `relatedPartnerPkid`.

## CourseGroup — 課程管理 Course › 課程群組 (`database/course.sql`, `spec/course/CourseGroup.md`)
- `pkid` (**smallint IDENTITY**) + `Description` nvarchar(100) (label 群組名稱). Description is **not** unique (existing duplicates).
- Referenced by `Course.CourseGroup_pkid` (nullable) and `PartnerCourseGroup.CourseGroup_pkid`: both counts in the SELECT; in use → DELETE 409. (`Promotion2.RelatedPartnerCourseGroup_pkid` points at `PartnerCourseGroup`, not here.)
- Filter: keyword (Description). Sort `pkid DESC`.
- Lookup `course-groups` (`{ pkid, description }`, by Description; 215 items → filter + virtual scroll).
- Course count links to `/courses?courseGroupPkid=`.

## Course — 課程管理 Course › 課程 (`database/course.sql`, `spec/course/Course.md`)
- PK `pkid` int IDENTITY. FKs `Partner_pkid` (smallint), `CourseGroup_pkid` (smallint, **nullable**), `PublishStatus_pkid` (tinyint), JOINed for `PartnerName`, `CourseGroupDescription` (LEFT), `PublishStatusDescription`.
- **List SELECT leaves out the 8 long-text columns** (`Outline`/`TowardCertOrExam` are nvarchar(max)); GET by id fills them plus n-n `Certifications`/`JobCategories`.
- `CourseId` (varchar 50) unique in the API (409); `ProdCourseId`/`FriendlyUrl` may repeat. `CourseId`/`ProdCourseId` ASCII + AnsiString.
- 400s: bad FK/n-n ids (`CheckReferencesAsync`), `ScheduleOff < ScheduleOn` (one existing row breaks this), `ListPrice` with decimals, `LearningCredit` with more than one decimal.
- n-n `CourseInCertification` (`CertificationPkids`), `CourseJobCategories` (`JobCategoryPkids`); DB cascades on delete. `Certification.Title` is nchar → RTRIM.
- Delete guard: `CourseFAQ`, `CourseRelatedLink`, `HotCourse` → 409. `CourseRecomm` is keyed by the **CourseId string** (no FK, 895 orphans): delete removes rows on both sides; a rename updates `CourseId`/`RecommCourseId` in the same transaction.
- Filters: keyword (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl), partner / course group / publish status, ScheduleOn/Off ranges (inclusive), tri-state canRepeat. Sort `DisplayOrder ASC, pkid DESC`. Accepts `?partnerPkid=` / `?courseGroupPkid=` / `?publishStatusPkid=`.
- New form defaults: ScheduleOn = today, ScheduleOff = Dec 31 of next year.
- Lookups: `certifications` (`{ pkid, title, partnerName }`), `job-categories`, `courses` (`{ pkid, courseId, title }`).
- Detail page 基本資料 shows a QR code (`<app-qr-code>`) of the public page `https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId}` (`COURSE_SITE_URL` in `course-detail.ts`; CourseId is URL-encoded), titled with the CourseId and downloadable as `{CourseId}.png`.
- **List page in-place editing** (`course-inline-edit.ts`): double-click any cell except 主代碼 / 原廠 / 課程群組; saved on blur (Enter commits, Escape cancels). Because list rows omit the long texts and n-n arrays and PUT replaces everything, a save does `getById` → `toCourseRequest(full, patch)` → `update`. Client validation mirrors the form/API (required, ASCII codes, non-negative numbers, 定價 integer, 點數 one decimal, valid dates, 上架日期 ≤ 下架日期) and keeps the cell open with an inline `.cell-error`; API 400/409 reverts the row and toasts `message`. 上架狀態 edits load the lookups on first use.
- Not built (from `spec/sample1.spec.md`): copy, print to PDF, CourseRelatedLink / CourseRecomm sub-panels.

## FeaturedPromoItem — 首頁 Home › 上稿作業 (`database/promotion.sql`, `spec/custom/FeaturedPromoItem/`)
- Custom UI from screenshots, not the list/detail/form template: one route `/featured-promo-items`. Training-center tabs (`lookups/training-centers`, by DisplayOrder: 台北/新竹/台中/高雄/線上研討會; pkids 1,2,3,5,54), a Monday–Sunday week navigator, and per day 3 slot rows with +/− (move down/up), 編輯, 複製/貼上, 刪除. The editor opens inline in the row (`FeaturedPromoItemForm`, used for Edit, New and Paste).
- PK `pkid` int IDENTITY. FKs `TrainingCenter_pkid` (smallint), `Promotion_pkid` → `Promotion2` (JOINed for `TrainingCenterName`, `PromoCode`). **UNIQUE (ScheduleOn, TrainingCenter_pkid, Slot)** → API 409 `{ message }`. Slot is 1..3 (`MaxSlot`).
- **No GET-all** (31.7k rows since 2019). `POST /query { trainingCenterPkid?, weekOf? }` returns the Mon–Sun week containing `weekOf` (default: this week, via `TimeProvider`), ordered by date, center DisplayOrder, slot.
- `POST /{id}/move-up` / `move-down` swap with the neighbor slot (or just move into an empty one) through slot 0 in a transaction; 400 at the edges.
- PromoCode autocomplete: `GET /api/lookups/promotions?keyword=` (top 20, exact match first, then newest; `_` escaped). Picking one sets `promotionPkid` and prefills Topic/Description from `Promotion2` (both still editable).
- Copy keeps `{ promotionPkid, promoCode, topic, description }` in a component signal (not persisted); Paste is only offered on empty slots and opens a prefilled New form. Selected tab and week are kept in session (`featured-promo-item-list-filters`).
- Smoke-test in far-future dates (e.g. 2099) on center 54, and check for leftover `Slot = 0` rows.
