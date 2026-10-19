# Frontend patterns and tests

Read this before adding or changing UI (`src/CMS.NG`).

## Structure

- Angular 20 standalone, no `.component` suffix (`app-role-list.ts` / class `AppRoleList`). Signals, `inject()`, `@if`/`@for`.
- Feature folder `src/app/features/{kebab-plural}/`: `{table}-list/`, `{table}-detail/`, `{table}-form/`, `{table}.model.ts`, `{table}.service.ts`. (The `/crud` skill says `core/models` / `core/services`; ignore that.)
- Shared: `core/services/lookup.service.ts`, `core/models/lookup.model.ts`, `core/utils/session-state.ts` (`readSession`/`writeSession`), `core/utils/date.util.ts` (`toIsoDate`/`parseIsoDate` use local components; never `toISOString()` for `date` columns).
- Lazy routes in `app.routes.ts`: `/{plural}`, `/{plural}/new`, `/{plural}/:id`, `/{plural}/:id/edit`. Route **and query** params arrive as `input()`s (`withComponentInputBinding`).
- Sidebar: `navGroups` in `app.ts` (`app.html` loops over it). Groups: 系統管理 Admin, 課程管理 Course. `app.spec.ts` checks the group count and the first Admin links (使用者 AppUser, then 角色 AppRole); update it when adding a group or reordering Admin.
- API base URL: `src/environments/environment*.ts`, imported as `@env/environment`. No dev proxy.
- Theme: Aura + emerald + zh-TW in `app/theme.ts`. `MessageService`/`ConfirmationService` are provided app-wide; `<p-toast>`/`<p-confirmDialog>` are in `app.html`.
- Shared CSS (`src/styles.scss`): `.page-header` (`.title`, `.subtitle`, `.actions`), `.page-card`, `.field` (`.required`, `.error`), `.view-value`, `.chips-wrap`, `.muted`.

## Lists

- Session keys `{table}-list-filters` / `-sort` / `-page`. Persist paging via `(firstChange)`/`(rowsChange)`; PrimeNG `p-table` resets `first` to 0 on sort, so `(onPage)` is unreliable.
- Filter drawer edits a `draft` copy, applied on 搜尋. Tri-state bools use a `{全部 null, 是 true, 否 false}` select. Date filters are `Date` objects in the draft, converted to ISO strings on apply.
- FK dropdowns in the drawer: load lookups the first time the drawer opens (not on list init). `appendTo="body"`; `[filter]` for 10+ options; virtual scroll for 100+.
- **Child lists filtered from a parent**: the list declares `readonly {parent}Pkid = input<string>()` (or the string key, e.g. `roleId`). When set, it replaces the saved filters and resets paging. The parent detail page links its count with `[routerLink]="['/{children}']" [queryParams]="{ … }"`, wrapping the existing `{{ n }} 筆` text so count assertions still pass. In place: Partner / CourseGroup / PublishStatus → Course, AppRole → AppUser.

## Forms

- Reactive forms; `forkJoin` all lookups plus the record (`of(null)` on new). Immutable keys are disabled in edit mode; IDENTITY `pkid` shows as read-only text.
- `p-datepicker` holds `Date` values: `parseIsoDate` on patch, `toIsoDate` on save. Long-text controls can be driven from a `TEXT_CONTROLS` array.
- n-n: `p-multiselect` with `display="chip"`, `[maxSelectedLabels]="9999"`, `styleClass="chips-wrap"`.
- Error toasts show `err.error?.message` with a generic fallback.

## Tests

- Jasmine specs next to each file. Services: `HttpTestingController`. Components: `jasmine.createSpyObj` service mocks, `provideRouter([])`, `provideNoopAnimations()`, and provide `MessageService` / `ConfirmationService` explicitly.
- Confirm dialogs: `spyOn(confirmation, 'confirm').and.callFake(c => { c.accept?.(); return confirmation; })`.
- `tsconfig.spec.json` only includes `*.spec.ts`, so no shared fixture files: define a `base: X` in each spec and spread it into **named** rows. `p-table` sorts `[value]` in place, so mocks return a copy (`callFake(() => of([...rows]))`).
- Query-param inputs: `fixture.componentRef.setInput('partnerPkid', '3')`.

## Build

- Installing PrimeNG needs explicit `@angular/animations` and `@angular/cdk` (^20), or npm fails with ERESOLVE.
- Initial-bundle budget is 1MB warn / 2MB error (PrimeNG theme ≈ 650kB).
