# Frontend patterns and tests

Read this before adding or changing UI (`src/CMS.NG`).

## Structure

- Angular 20 standalone, no `.component` suffix (`app-role-list.ts` / class `AppRoleList`). Signals, `inject()`, `@if`/`@for`.
- Feature folder `src/app/features/{kebab-plural}/`: `{table}-list/`, `{table}-detail/`, `{table}-form/`, `{table}.model.ts`, `{table}.service.ts`. (The `/crud` skill says `core/models` / `core/services`; ignore that.)
- Shared: `core/components/qr-code/` (see Custom pages below), `core/services/lookup.service.ts`, `core/models/lookup.model.ts`, `core/utils/session-state.ts` (`readSession`/`writeSession`), `core/utils/date.util.ts` (`toIsoDate`/`parseIsoDate` use local components; never `toISOString()` for `date` columns).
- Lazy routes in `app.routes.ts`: `/{plural}`, `/{plural}/new`, `/{plural}/:id`, `/{plural}/:id/edit`. Route **and query** params arrive as `input()`s (`withComponentInputBinding`).
- Sidebar: `navGroups` in `app.ts` (`app.html` loops over `visibleNavGroups()`). Groups in order: 系統管理 Admin (`adminOnly`, role `Admin` only), 首頁 Home, 課程管理 Course. `app.spec.ts` signs in as Admin in `beforeEach` (a fake unsigned JWT in sessionStorage `auth-profile`, set **before** the `AuthService` is created) and checks the group count, the first Admin links (使用者 AppUser, then 角色 AppRole), which groups stay open after collapsing Admin, and the non-Admin menu; update it when adding a group or reordering.
- Auth (`core/auth/`): `AuthService` (sessionStorage profile, roles from the token), `authInterceptor` (Bearer + 401 → `/login`; 5xx → one 系統錯誤 toast with `serverErrorMessage(err)`, see Forms), `authGuard`/`loginGuard`. New routes go inside the guarded `''` parent's `children` in `app.routes.ts`; only `/login` sits outside. The shell (sidebar + header with UserName / 登出) renders only while signed in; the header UserName links to `/profile`. To change a stored profile field, update it in `AuthService` (as `updateProfile` does) so sessionStorage and the `profile` signal stay in sync and the header re-renders. Component specs that mock their services need nothing auth-related; specs that create `App` or `AuthService` need `provideHttpClient()` (plus `provideHttpClientTesting()` when they flush auth requests, as `app.spec.ts` and `profile.spec.ts` do).
- API base URL: `src/environments/environment*.ts`, imported as `@env/environment`. No dev proxy.
- Theme: Aura + emerald + zh-TW in `app/theme.ts`. `MessageService`/`ConfirmationService` are provided app-wide; `<p-toast>`/`<p-confirmDialog>` are in `app.html`.
- Shared CSS (`src/styles.scss`): `.page-header` (`.title`, `.subtitle`, `.actions`), `.page-card`, `.field` (`.required`, `.error`), `.view-value`, `.chips-wrap`, `.muted`.

## Lists

- Session keys `{table}-list-filters` / `-sort` / `-page`. Persist paging via `(firstChange)`/`(rowsChange)`; PrimeNG `p-table` resets `first` to 0 on sort, so `(onPage)` is unreliable.
- Filter drawer edits a `draft` copy, applied on 搜尋. Tri-state bools use a `{全部 null, 是 true, 否 false}` select. Date filters are `Date` objects in the draft, converted to ISO strings on apply.
- FK dropdowns in the drawer: load lookups the first time the drawer opens (not on list init). `appendTo="body"`; `[filter]` for 10+ options; virtual scroll for 100+.
- **Child lists filtered from a parent**: the list declares `readonly {parent}Pkid = input<string>()` (or the string key, e.g. `roleId`). When set, it replaces the saved filters and resets paging. The parent detail page links its count with `[routerLink]="['/{children}']" [queryParams]="{ … }"`, wrapping the existing `{{ n }} 筆` text so count assertions still pass. In place: Partner / CourseGroup / PublishStatus → Course, AppRole → AppUser.

## In-place cell editing (Course list)

- PrimeNG's `pEditableColumn` opens on single click and cannot be switched to double-click, so the list keeps its own state: `editing` signal `{ pkid, field }`, `editValue` (ngModel), `editError` signal, `savingPkids`. Each editable `<td class="editable">` has `(dblclick)="startEdit(c, field, $event)"` and an `@if (isEditing(c, field))` that swaps the display for a PrimeNG editor (`pInputText`, `p-inputnumber`, `p-datepicker`, `p-select`, `p-checkbox`); a shared `<ng-template #cellError>` renders the inline message.
- Commit triggers: `(blur)` / `(onBlur)`, Enter, selection (`onSelect`, `onChange`). Overlay editors use `(onBlur)="onOverlayBlur(dp)"`, which ignores the blur caused by opening the panel (`overlayVisible`), plus `(onClickOutside)` (datepicker) / `(onHide)` (select) to commit when the panel closes. `commit()` is a no-op once `editing` is null, so double triggers are harmless.
- Validation lives in a pure `validateCell(field, raw, row)` next to the model (unit-tested on its own); a failure keeps the cell open and also blocks double-clicking into another cell. Unchanged values close without an API call. Saves are optimistic (row mutated in place, so the table does not re-sort), reverted on error.
- Specs: dispatch `new MouseEvent('dblclick', { bubbles: true })` on the `<td>`, set the input value + `input` event, then `dispatchEvent(new Event('blur'))`; for overlay editors set `component.editValue` and call `commit()`. The query mock must return **copies** of the row objects, since edits mutate rows.

## Forms

- Reactive forms; `forkJoin` all lookups plus the record (`of(null)` on new). Immutable keys are disabled in edit mode; IDENTITY `pkid` shows as read-only text.
- `p-datepicker` holds `Date` values: `parseIsoDate` on patch, `toIsoDate` on save. Long-text controls can be driven from a `TEXT_CONTROLS` array.
- n-n: `p-multiselect` with `display="chip"`, `[maxSelectedLabels]="9999"`, `styleClass="chips-wrap"`.
- Error toasts show `err.error?.message` with a generic fallback (`errorMessage(err, fallback)` in `core/utils/server-error.ts`; load handlers too, so a non-admin on an Admin page sees the API 403 message). 5xx is already toasted by `authInterceptor`, so every `error:` callback guards its own toast with `if (!isServerError(err))` (`core/utils/server-error.ts`) and still runs the rest (reset `loading`/`saving`, revert, `notFound`). Specs cover it with a `new HttpErrorResponse({ status: 500, … })` case: no error toast, side effects still happen. Interceptor specs need `MessageService` provided. `isServerError` returns a plain `boolean` on purpose: as a type guard, `!isServerError(err)` would narrow an `err: HttpErrorResponse` param to `never` and `err.error` would stop compiling.
- **Two forms on one page** (My Profile: profile + 變更密碼): each gets its own `FormGroup`, a sibling `<form>` (HTML forms don't nest), and its own submit button; the spec scopes queries to it (`form[data-form="password"] button[type="submit"]`). Cross-field rules are group validators (`passwordsMatchValidator`); multi-line messages render with `white-space: pre-line`.
- **Pinned action toolbar** (Course form): the `.page-header` carries `.sticky-toolbar` (`position: sticky; top: 0; z-index: 10`, in the form scss with `:host { display: block }`). It sticks to `main.content`, the only scroll container, so it never covers the sidebar. The spec asserts `getComputedStyle(toolbar).position === 'sticky'` for both new and edit, plus the 儲存 / 取消 buttons. Reuse the same class on other forms when asked.

## Custom (non-CRUD-template) pages

- When the user supplies a UI spec with screenshots (e.g. `spec/custom/{Table}/`), follow the screenshots rather than the list/detail/form template. FeaturedPromoItem is the example: one route, PrimeNG `p-tabs` (tablist only, `(valueChange)`) for a filter, week navigation, an inline editor child component with `saved`/`cancelled` outputs.
- `p-autocomplete` for picking an FK by its code: the control holds typed text until a suggestion is picked, so validate that the value is an object with a `pkid`; prefill related fields in `(onSelect)`. Test by `setValue(obj)` + calling the handler.
- Shared `core/components/row-audit-badge/` (`<app-row-audit-badge tableName="Course" [pkid]="id()" />`, plus `RowAuditService`): sits in `.page-header .start` next to the `<h1>` on every detail page (once the record loaded) and edit form (`@if (isEdit())`). Page specs that render it must provide `{ provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) }` (no HttpClient in those specs). Its `p-dialog` is `appendTo="body"`: specs query `document.body` and remove leftover `.p-dialog-mask, .p-dialog` in `afterEach`, or a dialog from another test leaks in (random order).
- Week helpers: `startOfWeek` (Monday) and `addDays` in `core/utils/date.util.ts`.
- Shared `core/components/qr-code/` (`<app-qr-code [text] [title] [filename?] [size?]>`): renders with the `qrcode` npm package via the injectable `QrCodeRenderer` (spy it in page specs: `spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo()` then assert `args[1]`), and downloads a PNG named `{filename ?? title}.png` through a temporary `<a download>` (test with `spyOn(HTMLAnchorElement.prototype, 'click')`; a PNG data URL starts with `data:image/png;base64,iVBORw0KGgo`). The real render is async: `await new Promise(r => setTimeout(r, 0))` before asserting the canvas.

## Tests

- Jasmine specs next to each file. Services: `HttpTestingController`. Components: `jasmine.createSpyObj` service mocks, `provideRouter([])`, `provideNoopAnimations()`, and provide `MessageService` / `ConfirmationService` explicitly.
- Confirm dialogs: `spyOn(confirmation, 'confirm').and.callFake(c => { c.accept?.(); return confirmation; })`.
- `tsconfig.spec.json` only includes `*.spec.ts`, so no shared fixture files: define a `base: X` in each spec and spread it into **named** rows. `p-table` sorts `[value]` in place, so mocks return a copy (`callFake(() => of([...rows]))`).
- Query-param inputs: `fixture.componentRef.setInput('partnerPkid', '3')`.

## Build

- Installing PrimeNG needs explicit `@angular/animations` and `@angular/cdk` (^20), or npm fails with ERESOLVE.
- Initial-bundle budget is 1MB warn / 2MB error (PrimeNG theme ≈ 650kB).
- Third-party npm packages: pin exact versions (`npm install qrcode@1.5.4`), add `@types/*` as dev deps, and wrap them in a small injectable (e.g. `QrCodeRenderer`) so page specs can spy on them.
- `qrcode` (CommonJS) is listed in `allowedCommonJsDependencies` in `angular.json`; add other CJS libs there too, or the build warns.
