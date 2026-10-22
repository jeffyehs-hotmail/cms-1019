# TODOS

Follow-ups found by /ship's pre-landing review of `feature-agent-token-usage` (2026-10-22) and deferred from that PR.

## Auth and roles

### Block removing the last Admin

**What:** Return 409 `{ message }` when an AppUser update/delete or an AppRole update/delete would leave no active user in the `Admin` role, and refuse to delete the `Admin` role itself.

**Why:** AppUser/AppRole management is Admin-only, so deactivating, demoting or deleting the last Admin (one click, or a compromised admin session) leaves nobody able to manage users or agent tokens; recovery needs direct SQL.

**Context:** Check inside the write transaction (`RowAuditWriter.LoadRowAsync` already takes UPDLOCK). Paths: `AppUsersController.Update/Delete`, `AppRolesController.Update/Delete`. Add 409 tests with the fakes.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Revoke login tokens on deactivation, demotion and password change

**What:** Validate the JWT against the current user in `JwtAuthentication` (an `OnTokenValidated` that rejects missing/inactive users or tokens issued before `PasswordUpdatedTime`, and reads roles from the DB).

**Why:** A login JWT stays valid with its old roles for 24 h: a deactivated or demoted Admin keeps Admin rights (and can re-grant them), and a stolen token survives a password change.

**Context:** Found by /cso (finding c96f6b71…) and confirmed during QA. Costs one user lookup per request; consider caching with a short TTL.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Default-password accounts

**What:** Reject a change-password whose new password equals the current one or `appConfig.defaultPassword`; when `PasswordUpdatedTime` is NULL, issue a restricted token (or a `mustChangePassword` flag) that only allows change-password and route the user to /profile.

**Why:** New and reset accounts share one default password, login never forces a change, and "changing" to the same value clears the 尚未變更（預設密碼） indicator; anyone who knows the default can sign in as a fresh or just-reset user, including an Admin.

**Context:** `AuthController.Login/ChangePassword`, `authGuard`. Related: rate limiting below. Red-team finding, /ship run 4.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Concurrent AppUserRole edits from two forms

**What:** Send the originally loaded member/role list (or a rowversion) with AppRole and AppUser saves and return 409 when the current membership differs, or apply add/remove deltas instead of delete-then-reinsert.

**Why:** Membership is editable from both the AppRole form (UserIds) and the AppUser form (RoleIds); saving a stale form silently undoes grants made meanwhile (the audit row records it, nobody is warned).

**Context:** `AppRoleRepository.UpdateAsync`, `AppUserRepository.UpdateAsync`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Store the canonical RoleId

**What:** In `AppUserRepository.InsertRolesAsync`, store the `AppRole.RoleId` spelling returned by the existence check, not the caller's (or join `AppRole` in `AuthRepository.GetRoleIdsAsync` so tokens carry the canonical id). `AppRoleRepository` already writes its own canonical RoleId.

**Why:** The DB accepts "admin" for "Admin" (case-insensitive), but login copies the stored spelling into the JWT and `[Authorize(Roles = "Admin")]` / `roles().includes('Admin')` compare exactly: the user looks like an Admin everywhere and gets no Admin rights.

**Context:** `CheckRolesAsync` already queries the canonical ids. Adversarial review, /ship run 4.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Rate-limit login and change-password

**What:** Add `AddRateLimiter` policies: per UserId/IP on `POST /api/auth/login`, per `sub` on `POST /api/auth/change-password`, with a delay or lockout after N failures.

**Why:** Change-password is an unlimited online oracle for the current password (distinct 400 `目前密碼錯誤`, fast unsalted SHA-256); a stolen 24 h token can brute-force the real password.

**Account ids are visible to insiders:** since /ship run 4, RowAudit history records the login UserId, so any signed-in user can list the ids that edited non-admin tables (Course, Partner, …). That makes throttling login more urgent.

**Context:** `AuthController.Login`, `AuthController.ChangePassword`. Password hashing is unsalted SHA-256 to match existing rows (`Security/PasswordHasher`).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Escape user data in confirm dialogs

**What:** HTML-escape `userId` (and other record text) interpolated into PrimeNG `ConfirmationService` messages.

**Why:** PrimeNG renders the confirm `message` with `[innerHTML]`; Angular sanitizes scripts but markup in a UserId still renders.

**Context:** New on this branch: regenerate/revoke agent token (`app-user-detail.ts`) and reset password (`reset-password-button.ts`). Older delete confirms interpolate titles too. The `worktree-feature-course-pdf` branch adds `core/utils/html.util.ts` (`escapeHtml`); reuse it after that branch merges.

**Effort:** S
**Priority:** P2
**Depends on:** worktree-feature-course-pdf merge (for `escapeHtml`)

### Model-validation 400s return English ProblemDetails

**What:** Configure `ApiBehaviorOptions.InvalidModelStateResponseFactory` to return `{ message }` in Traditional Chinese, and translate the `pkid is required` 400 in 6 controllers.

**Why:** The repo contract is that expected 400s return a Traditional Chinese `{ message }`; `[Required]`/`[StringLength]` failures and a missing pkid return English (seen by the hook and Swagger clients; the Angular forms hide it).

**Context:** `Program.cs` `AddControllers()`; controllers AppRoles, AppUsers, Courses, CourseGroups, FeaturedPromoItems, Partners.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Positive test: Admins can read AppUser/AppRole history

**What:** Add `Get_AdminTable_AsAdmin_Returns200` (AppUser, approle) to `RowAuditControllerTests`, and move the "Longer values…" comment in `RowAuditController` back above its length check.

**Why:** The new `AdminOnlyTables` check is only tested from the deny side; a regression that blocks Admins too would break the 異動紀錄 badge on AppUser/AppRole pages without failing a test.

**Context:** Cycle-3 review finding; deferred to avoid a fourth /ship fix cycle.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Validate JWT issuer and audience

**What:** Set `iss`/`aud` in `AccessTokenIssuer.Create` and validate them in `JwtAuthentication` (`ValidateIssuer`/`ValidateAudience` are false today).

**Why:** The HS256 key lives in the shared `SysConfig[appConfig].symmetricSecurityKey`; any other system signing with it could mint a token carrying `role: Admin` that this API accepts.

**Context:** `Security/AccessTokenIssuer.cs`, `Security/JwtAuthentication.cs`. Confirm whether any other system uses that key.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Serve Swagger only in Development

**What:** Gate `UseSwagger`/`UseSwaggerUI` on `app.Environment.IsDevelopment()` (or a config switch).

**Why:** Swagger publishes the full API surface, including the anonymous ingest endpoint, in every environment.

**Context:** `Program.cs`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Bound list parameters

**What:** Reject (400) query filters and member/role lists longer than a sane limit before Dapper expands them into `IN @list`.

**Why:** More than ~2,100 entries exceeds SQL Server's parameter limit and returns a 500 instead of a 400 (Admin-only endpoints, so low impact).

**Context:** `AgentTokenUsagesController.Query` (`UserIds`, `Projects`, `Models`), `CheckUsersAsync`/`CheckRolesAsync`.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Token usage (AgentTokenUsage + SessionEnd hook)

### Report sums can overflow

**What:** Cast the report's token `SUM`s to `decimal(38,0)` in SQL (or lower the per-row cap) and cap sessions per user per day.

**Why:** `MaxTokens` = 1e12 per row keeps one row safe, but ~9.2M maxed rows overflow `SUM(bigint)`; an agent-token holder can script that (client-chosen session ids, no rate limit), after which the Admin report returns 500 for any range covering them.

**Context:** `AgentTokenUsageRepository.QueryAsync`, `AgentTokenUsagesController.MaxTokens`. Related: ingest size/rate limits below. Agent-token holders can also report arbitrary projects/models; an allowlist is a trust-model decision.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Hook: outbox file-name collisions and unacceptable reports

**What:** Make outbox file names collision-free (e.g. hash the sessionId), and don't park reports the server can never accept (older than 400 days, more than 500 rows) as retryable `failed/` items; split or drop them with a clear log line.

**Why:** Different sessionIds can map to the same file and overwrite each other (backfill takes ids from file names), and `--retry-failed` resends permanent 400s forever.

**Context:** `tools/token-report/lib/outbox.js` (`fileName`), `report.js` backfill.

**Effort:** S
**Priority:** P4
**Depends on:** None


### Hook: outbox send-order and deadline tests

**What:** Test that `flush` sends oldest first (the current test sorts `seen`) and that an unparseable file left past the deadline stays in `outbox/`.

**Why:** Order decides which report wins when two copies of a session race; neither path is pinned by a test.

**Context:** `tools/token-report/lib/outbox.js`, `test/outbox.test.js`. The requeue overwrite and the unparseable-file test were fixed in /ship run 4.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hook: stop retrying a report that always fails with 5xx

**What:** Count attempts per outbox file (sidecar or file name) and park it in `failed/` after N consecutive 5xx; on the server, skip null rows in `Normalize` and answer 400 for duplicate-key collisions instead of 500.

**Why:** A report that deterministically triggers a 500 is re-POSTed at every SessionEnd forever, sent first (oldest), and eats the 25 s hook budget so newer reports wait.

**Context:** `outbox.js` `outcomeOf`/`flush`, `AgentTokenUsagesController.Normalize`. Red-team finding, /ship run 4.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hook: a session name cut mid-emoji is rejected forever

**What:** In `lib/parse.js`, drop a trailing high surrogate after `.slice(0, MAX_SESSION_NAME)` (or slice by code point while staying ≤ 200 UTF-16 units); add a test with `'x'.repeat(199) + emoji`.

**Why:** A lone surrogate is serialized as `"\ud83d"`, System.Text.Json rejects it, the API answers 400, and the outbox parks the report in `failed/`: that session's usage is never recorded, and `--retry-failed` fails the same way.

**Context:** `tools/token-report/lib/parse.js` (sessionName). Adversarial review, /ship run 4.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Hook: verify forked/resumed transcripts are not double-counted

**What:** Check whether Claude Code copies earlier assistant lines (same `message.id`) into a new session transcript on resume/fork; if so, count only lines whose `sessionId` equals the reported session, or dedupe by message id on the server.

**Why:** Dedupe is per session and the server replaces per SessionId, so copied history would be summed twice under two sessions.

**Context:** `tools/token-report/lib/parse.js` (dedupe key). Unverified: depends on Claude Code transcript behaviour. Also memoize `resolveProject` by cwd during `--backfill` (one or two git spawns per transcript today).

**Effort:** S
**Priority:** P4
**Depends on:** None

### Hook: concurrent SessionEnd flushes race on the outbox

**What:** Write reports to `<file>.tmp` then rename; wrap per-file stat/rename/rm in try/catch and skip vanished files; take an exclusive lock file around `enqueue`, `flush` and `requeueFailed` (required, not optional), or re-check before `rm`/`moveTo` that the file still holds the content that was sent; guard `enqueue`'s delete of the failed copy (EPERM/EBUSY on Windows) and rename it aside when it fails.

**Why:** Several terminals ending at once flush the same outbox: `statSync` throws ENOENT and aborts the flush, and a half-written report can be read, fail `JSON.parse` and get parked in `failed/`. Worse, while one process awaits a POST, another can enqueue a newer copy of the same session: the first then deletes that unsent newer file, or its older POST lands last and the server replaces the newer totals; `requeueFailed` has the same window between `existsSync` and `renameSync`. A locked failed copy that survives `enqueue` can later be resent by `--retry-failed`.

**Context:** `tools/token-report/lib/outbox.js` (`enqueue`, `flush`, `moveTo`, `requeueFailed`). Ordering and locked-file cases found by the /ship run 4 cycle-3 review.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Hook: limit which projects are reported

**What:** Add a project allowlist (or per-repo opt-in) to `token-report.json`, checked in `buildReport` and `--backfill`; make sending `sessionName` opt-in; warn when `apiUrl` is plain `http://` to a non-localhost host.

**Why:** Installed at user level, the hook reports every Claude Code session on the machine (personal and other clients' repos, with AI-generated session titles), and sends the long-lived agent token in cleartext over http.

**Context:** `tools/token-report/report.js`, `README.md` install section.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Ingest endpoint: request size and rate limits

**What:** Add `[RequestSizeLimit]` (about 256 KB, enough for 500 rows) and a fixed-window rate limiter to the anonymous `POST /api/agent-token-usages`; optionally check the bearer before model binding.

**Why:** Anyone can send a body up to the server limit (~30 MB); it is fully deserialized before the 401.

**Context:** `AgentTokenUsagesController.Report`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Session ownership check outside the replace transaction

**What:** Read the session owner `WITH (UPDLOCK, HOLDLOCK)` inside `ReplaceSessionAsync`'s transaction (409 if it differs), or add `AND UserId = @UserId` to its DELETE.

**Why:** Two token holders posting the same SessionId at once can both pass the check; the later write deletes the other user's rows. Needs a leaked/guessed UUID, so low impact.

**Context:** `AgentTokenUsagesController.Report` → `AgentTokenUsageRepository.ReplaceSessionAsync`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Self-service agent tokens

**What:** `POST /api/auth/agent-token` (JWT `sub` only) plus a My Profile button, so a developer issues their own token; keep Admin regenerate/revoke for incidents.

**Why:** Only Admins can issue tokens and they see them in plain text, so admins hold every user's ingest credential and can submit usage attributed to someone else; the README install step doesn't work for non-admins.

**Context:** `AppUsersController.RegenerateAgentToken`; `tools/token-report/README.md`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Report performance

**What:** Cap the report's date span (e.g. 400 days) and/or row count; add paging or virtual scroll; make `IX_AgentTokenUsage_Date_User` covering (INCLUDE the selected columns); limit `filter-options` to a recent window or index Project/Model; index `AgentTokenUsage(UserId)` (the AppUser list counts usage per user with a correlated COUNT); cache the JWT signing key read from SysConfig for 30–60 s instead of one query per request.

**Why:** The report is unpaged and unbounded, the index forces key lookups, and filter options scan the whole table twice per page open; all grow with usage.

**Context:** `AgentTokenUsageRepository.QueryAsync/GetFilterOptionsAsync`, `database/agent.sql`, `agent-token-usage-report.html`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Price data: verify and document corrections

**What:** Check the seeded `AgentModelPrice` rows against Anthropic's pricing page (the cache-read ratios differ by model: Fable 0.025×, Opus/Sonnet 0.05×, Haiku 0.1× input), and document that a correction needs a new `EffectiveFrom` row or an UPDATE plus a Cost recompute (cost is stored at ingest; the seed is insert-only).

**Why:** Every cost figure in the report depends on these values.

**Context:** `database/agent.sql` seed block. Post-merge step for PR #2 (plan item 43).

**Effort:** S
**Priority:** P1
**Depends on:** None

## Database scripts

### Deploy order and script hygiene

**What:** Run `database/agent.sql` (and `rowaudit.sql`) before deploying an API build from this branch; filter the `sys.indexes` existence guards in `agent.sql` by `object_id`; optionally add a rollback script; run `rowaudit.sql`'s index build in a quiet window (offline build blocks audited writes).

**Why:** The new API reads `AppUser.AgentTokenHash` and `AgentTokenUsage`; without the script the AppUser endpoints return 500.

**Context:** Post-merge step for PR #2 (plan item 47).

**Effort:** S
**Priority:** P1
**Depends on:** None

## Frontend

### Audit Course link changes

**What:** Pass `RowAuditWriter.MemberChange` for `CourseInCertification` and `CourseJobCategories` in `CourseRepository.UpdateAsync`, as AppUser/AppRole do for roles, or list Course links as an exception in backend.md.

**Why:** An edit that only changes a course's links is logged with `ActionDesc = ""`, so the history can't say what changed.

**Context:** `CourseRepository.cs` (delete-then-reinsert of those two link tables; `CourseRecomm` is only re-keyed on a CourseId change, which ActionDesc already shows). Adversarial review, /ship run 4.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Row-audit badge freshness and cost

**What:** Make the badge reloadable after actions on the same record (reset password, regenerate/revoke token), fetch only the latest row for the inline badge (TOP 1) and the full trail when the dialog opens, and show a failed reload in the dialog.

**Why:** The badge stays stale after the user's own action, and every page view downloads the record's full history to show one line.

**Context:** `core/components/row-audit-badge/`, `app-user-detail`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Non-admin positive routes and hook CLI contract tests

**What:** An `AuthorizationTests` theory that sends a User-only token to every route meant to stay open (lookups, courses, partners, course groups, featured promo items, RowAudit for Course) and expects 200; `node --test` cases that spawn `report.js` with empty/invalid stdin (exit 0, stderr message), with no config (report stays queued), and for `poster` non-2xx/timeout mapping.

**Why:** Every positive API test uses the default Admin token, so an `[Authorize(Roles=Admin)]` that spread to a content controller would pass every test; the hook's "never fails the session" contract is untested.

**Context:** `CmsApiFactory.AccessToken("carol", "Carol", ["User"])`, `tools/token-report/report.js`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Error-callback 5xx spec cases

**What:** Add a 500 case (no component toast) for every `error:` callback guarded by `!isServerError`, preferably table-driven per spec; plus the missing cases below.

**Why:** CLAUDE.md requires a 500 case per callback; most specs have one per file, so dropping any other guard double-toasts without failing a test.

**Context:** List delete callbacks (app-role, app-user, course-group, partner, publish-status, featured-promo-item), form load callbacks, course-list query/lookups, featured-promo-item options/PATCH/delete; plus app-user-list delete 409, app-user-detail load 500 and revoke error, profile `getProfile` error, login network error (status 0), RowAudit length guard, AgentTokenUsages `from`-only/`to`-only dates and parserVersion > 20, `UnhandledExceptionMiddleware` abort and HasStarted branches; clean up temp dirs in `tools/token-report` tests; pin the clock in the report's default-month spec.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Sidebar and surface polish

**What:** Sidebar: animate a transform (or drop the `width` transition, honoring `prefers-reduced-motion`), add `:focus-visible`/hover styles to `.collapse-btn`, `.nav-group` and `.nav-items a`, collapse to the 56px rail below ~768px, and tell group toggles from links when collapsed. Share one chip-list class (`.role-chips` ×2 and `.user-chips`), give the report's `.table-card` the `.page-card` radius, and derive the report's colspans from computed signals.

**Why:** Keyboard focus is hard to see on the dark sidebar, tables get squeezed on narrow screens, and copied styles drift.

**Context:** `app.scss`, `profile.ts`, `app-user-detail.ts`, `styles.scss`, `agent-token-usage-report.*`. Design reviewer, /ship run 4.

**Effort:** S
**Priority:** P4
**Depends on:** None

### UX and copy nits

**What:** Rename the report's 本月 reset button (it also clears the user/project/model filters) or add `showClear` to the date range; decide whether the row-audit badge's bilingual copy (`History`, `by`) is intended and document it in frontend.md; update the stale `passwordUpdatedTime` comment in `app-user.model.ts` if it drifts again.

**Why:** Small clarity issues found in review.

**Context:** `agent-token-usage-report.html`, `row-audit-badge.html`.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Code health

### Small correctness items

**What:** Cancel or ignore a superseded `RowAuditBadge.open()` reply when `tableName`/`pkid` change; treat a token without `exp` as expired in `AuthService.isLoggedIn`; check AgentTokenUsage rows inside the AppUser delete transaction (or revoke the agent token first) so a concurrent ingest gives the 409, not an FK 500.

**Why:** Each is low impact (wrong history after fast navigation, UI-only session, rare 500), but cheap to fix.

**Context:** `core/auth/auth.service.ts`, `core/components/row-audit-badge/`, `AppUsersController.Delete`. Adversarial review, /ship run 4.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Simplification advisories

**What:** Replace `serverErrorMessage` with `errorMessage(err, SERVER_ERROR_MESSAGE)`; bind 登出 to `auth.logout()` and drop the wrapper; use `Base64Url.EncodeToString` in `AgentTokenHasher`; share one `fetch` in the row-audit badge; share a `jsonLines` generator in `tools/token-report/lib/parse.js`; one Taipei-time helper instead of four `TimeSpan.FromHours(8)` copies; build `PasswordPolicy.Message` from `MinLength`; rename or delete `.claude/setting.json` (Claude Code reads `settings.json`). From /ship run 4: make `RowAuditWriter.Log*Async` take `AuditRow` and a required `tx` (drop the reflection path and the own-connection insert), move `AuthRepository.UpdateAuditedAsync` (plus a delete twin) onto the writer, keep audited table names in one constants class used by the repositories and `RowAuditController.AuditedTables`, name the ingest usageDate window (+1/−400 days), and read hook stdin with `fs.readFileSync(0)` if that is reliable on Windows pipes.

**Why:** About 30 lines removable and fewer places to keep in sync.

**Context:** Advisory findings from the simplification and maintainability reviewers.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Completed

- **Hook: --retry-failed can overwrite newer session totals**: `enqueue` deletes the session's failed copy and `requeueFailed` drops one whose session is already queued (CLI prints the dropped count); tests for both and for an unparseable outbox file. **Completed:** /ship run 4 (2026-10-22)
- **Audit attribution used the editable display name**: RowAudit.UserName now records the login UserId (JWT `sub`). **Completed:** /ship run 4 (2026-10-22)
- **PublishStatus history readable by non-admins**: added to `RowAuditController.AdminOnlyTables`; the publish-status load toasts and the AppRole form now show the API message. **Completed:** /ship run 4 (2026-10-22)
