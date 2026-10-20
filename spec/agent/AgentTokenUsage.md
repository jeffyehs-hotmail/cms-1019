# AgentTokenUsage: Claude Code token consumption report

Status: built 2026-10-20 (branch `feature-agent-token-usage`). Where the build differs from the original design, the text below is updated and the change is marked **(built)**.

## Goal

On every Claude Code session end, each developer's machine submits that session's token consumption to the CMS API. The API validates the report and upserts it into SQL Server. A read-only CMS page reports usage by user, date (Taipei, UTC+8), project and model.

No table exists yet. This feature adds the DDL.

## Session name **(added after the first build)**

- The hook sends `sessionName`: the last `custom-title` entry (`/rename`), else the last `ai-title` entry (rewritten by Claude Code during the session), trimmed and capped at 200 characters; null when neither exists. `PARSER_VERSION` 2.
- Stored in `AgentTokenUsage.SessionName` nvarchar(200) NULL (same on every row of the session). Blank → NULL; over 200 → 400.
- Report: the query takes `groupBySession`. When it is true, rows are also grouped by SessionId and carry `sessionId` / `sessionName`. The page has a 依工作階段 toggle that adds a 工作階段 column (unnamed: （未命名） + the first 8 characters of the id).

## Capture: SessionEnd hook (`tools/token-report/`)

- A Node script (no Python) runs as a Claude Code **SessionEnd** hook.
  - It is installed in each user's own `~/.claude/settings.json` with `"timeout": 30`. The default 1.5 s is too short.
  - Installing it per user covers every project, not just this repo.
- Config lives in `~/.claude/token-report.json` (`{ "apiUrl": "...", "token": "cms_at_..." }`), which is never committed. A README covers installation.
- Input: the hook's stdin JSON gives `session_id`, `transcript_path` and `cwd`. The script parses:
  - the main transcript, `<transcript_path>`;
  - every `<session dir>/<session_id>/subagents/*.jsonl`. Subagent tokens are in separate files.
- Parsing:
  - Count only assistant lines that have `message.usage`.
  - **Dedupe**: Claude Code writes the same API call on several lines (seen: 310 lines, 126 distinct ids). Keep one entry per `message.id`, falling back to `requestId`, using the **last** line seen.
  - Token fields:
    - `input_tokens` → Input
    - `output_tokens` → Output
    - `cache_read_input_tokens` → CacheRead
    - `cache_creation.ephemeral_5m_input_tokens` → CacheWrite5m
    - `cache_creation.ephemeral_1h_input_tokens` → CacheWrite1h
    - If the `cache_creation` breakdown is missing, all of `cache_creation_input_tokens` counts as 5m.
  - Model: `message.model`. Drop `<synthetic>` and entries where all token counts are zero.
  - Date: the UTC ISO `timestamp` + 8 h, giving a Taipei date. This is a fixed offset; Taiwan has no DST. A session crossing midnight produces rows for two dates.
  - Project, in order of preference:
    - the git remote repo name (e.g. `cms-1019`);
    - the git root folder name;
    - the `cwd` folder name.

    Subagent rows use the parent session's project.
  - The transcript format is internal to Claude Code and may change between releases. Keep all parsing in one small, tested module, and send `parserVersion` with every report. A later switch to OpenTelemetry (`claude_code.token.usage` / `cost.usage`) would replace only this module.
- Delivery through an outbox:
  1. Write `~/.claude/token-report/outbox/<sessionId>.json`.
  2. POST every file in the outbox.
  3. On 2xx, delete the file.
  4. On 4xx, move it to `failed/` and don't retry.
  5. On network failure or 5xx, keep it for the next session end.
- `--backfill` mode: report every transcript still in `~/.claude/projects` (about 30 days are kept by default). It is safe to run again because the server replaces each session's rows.
- A resumed session keeps the same session id and appends to the same transcript. Re-parsing the whole file and replacing the rows handles that.

### Payload

```json
{
  "sessionId": "a0d2cc03-...",
  "project": "cms-1019",
  "parserVersion": "1",
  "rows": [
    { "usageDate": "2026-10-20", "model": "claude-opus-5-5",
      "inputTokens": 120, "outputTokens": 3400,
      "cacheWrite5mTokens": 0, "cacheWrite1hTokens": 20445, "cacheReadTokens": 339220 }
  ]
}
```

The payload has no `userId`. The server takes the user from the token.

## API

### `POST api/agent-token-usages` (ingest)

- Requires `Authorization: Bearer cms_at_<token>`. The server takes the SHA-256 of the token and looks up `AppUser.AgentTokenHash`, which must belong to an active user.
- Missing, unknown or inactive token → 401 with the generic `{ message }`.
- Validation → 400 `{ message }` (Traditional Chinese):
  - sessionId is required and at most 100 characters;
  - between 1 and 500 rows;
  - no token count is negative;
  - a row's four token columns are not all zero;
  - usageDate is at most 1 day after today and at most 400 days before today, in Taipei time;
  - model and project are not empty and fit their column lengths;
  - (sessionId, usageDate, model) is not repeated within the payload.
- If the session already exists under a **different** UserId → 409 `{ message }`.
- Semantics:
  - In one transaction, delete all of the session's rows and insert the new set.
  - Cost per row = Σ(tokens × price per MTok / 1,000,000), using the `AgentModelPrice` row for that model with the latest `EffectiveFrom <= usageDate`.
  - If there is no price, `Cost = NULL`. The row is still accepted.
- "Today" = `TimeProvider.GetUtcNow() + 8h`, not `GetLocalNow()`.
- Response: 204.

### `POST api/agent-token-usages/query` (report) **(built: POST /query like the other lists, not GET)**

- Body: `from`, `to` (DateOnly; default = current Taipei month; from > to → 400), and `userIds[]`, `projects[]`, `models[]`.
- Returns rows grouped by (UsageDate, UserId, UserName, Project, Model), with sums of the five token columns and of Cost. A group with any NULL cost is flagged `hasUnpricedRows`.
- Filter options **(built)**: users from `GET api/lookups/app-users`; distinct projects and models from `GET api/agent-token-usages/filter-options`.
- **Unauthenticated**, like the rest of the API, until JWT validation exists. Record this as deferred work in features.md.

### AppUser agent token actions

These follow the repo's action-endpoint convention.

- `POST api/app-users/{id}/regenerate-agent-token` → 200 `{ token }`.
  - The token is `cms_at_` + 32 random bytes in base64url.
  - Only the SHA-256 hex is stored, in `AppUser.AgentTokenHash`.
  - The previous token stops working. The plain token is returned only once.
- `POST api/app-users/{id}/revoke-agent-token` → 204. Sets the hash to NULL.
- `AgentTokenHash` is backend-only and never sent to the client, the same as `PasswordHash`.

## DB: new `database/agent.sql`

```sql
CREATE TABLE AgentTokenUsage (
  SessionId          nvarchar(100) NOT NULL,
  UsageDate          date          NOT NULL,   -- Taipei (UTC+8) date
  Model              nvarchar(100) NOT NULL,
  UserId             nvarchar(200) NOT NULL REFERENCES AppUser(UserId),
  Project            nvarchar(200) NOT NULL,
  InputTokens        bigint NOT NULL,
  OutputTokens       bigint NOT NULL,
  CacheWrite5mTokens bigint NOT NULL,
  CacheWrite1hTokens bigint NOT NULL,
  CacheReadTokens    bigint NOT NULL,
  Cost               decimal(18,6) NULL,      -- USD, list price; NULL = unpriced model
  ParserVersion      nvarchar(20)  NOT NULL,
  UpdatedTime        datetime      NOT NULL,
  CONSTRAINT PK_AgentTokenUsage PRIMARY KEY (SessionId, UsageDate, Model)
);
CREATE INDEX IX_AgentTokenUsage_Date_User ON AgentTokenUsage (UsageDate, UserId);

CREATE TABLE AgentModelPrice (
  Model                  nvarchar(100) NOT NULL,
  EffectiveFrom          date          NOT NULL,
  InputPerMTok           decimal(18,6) NOT NULL,
  OutputPerMTok          decimal(18,6) NOT NULL,
  CacheWrite5mPerMTok    decimal(18,6) NOT NULL,
  CacheWrite1hPerMTok    decimal(18,6) NOT NULL,
  CacheReadPerMTok       decimal(18,6) NOT NULL,
  CONSTRAINT PK_AgentModelPrice PRIMARY KEY (Model, EffectiveFrom)
);

ALTER TABLE AppUser ADD AgentTokenHash nvarchar(64) NULL;
-- (built) plus a plain nonclustered index on AgentTokenHash; a filtered unique index broke AppUser INSERTs
-- on connections with QUOTED_IDENTIFIER OFF. The real script (database/agent.sql) is re-runnable.
```

- **(built)** Deleting an AppUser that has usage rows returns 409 (FK). AppUser responses carry `hasAgentToken` and `agentTokenUsageCount`.

- Seed `AgentModelPrice` with **published list prices**, looked up at build time and not guessed, for the models actually in use.
- Prices are maintained by hand in the DB. There is no CRUD screen.
- Cost is a list-price estimate. For subscription users it is not their actual bill.

## UI

- **系統管理 › Token 用量** (`/agent-token-usages`), a read-only report.
  - Filters:
    - date range, defaulting to the current month in Taipei time;
    - multi-select user, project and model.
  - Table: one row per (date, user, project, model), with columns:
    - Input, Output, Cache write (5m + 1h added together), Cache read;
    - a "Token in" column (Input + both cache writes + Cache read);
    - Cost.
  - Unpriced groups show 未定價. A grand-total row sits at the bottom.
  - Filtering is server-side, with no paging for now.
  - Add the item to the 系統管理 group in `navGroups` and update `app.spec.ts`.
- **AppUser detail**:
  - A 重新產生 Agent Token button opens a dialog that shows the token once, with a copy button and a warning that it won't be shown again.
  - A 撤銷 Agent Token button, with a confirm step.

## Tests

- `tools/token-report/`: `node --test` with fixture `.jsonl` files covering:
  - repeated `message.id` lines (counted once);
  - subagent files;
  - midnight crossing in UTC+8;
  - `<synthetic>` and zero-token entries dropped;
  - a missing `cache_creation` breakdown;
  - project resolution;
  - outbox behaviour on 2xx, 4xx and network failure.
- Backend: `AgentTokenUsagesControllerTests` via `CmsApiFactory` with an in-memory fake (no Moq), covering:
  - 401 cases;
  - each 400 rule;
  - 409 when the session belongs to another user;
  - replace semantics;
  - cost calculation and choosing the price by effective date;
  - NULL cost for unpriced models;
  - report grouping and filters.

  Also add AppUser regenerate/revoke tests.
- Frontend: Jasmine specs for the report page, the token dialog and the nav change.

## Docs

Add notes to `docs/claude/features.md` (decisions above, plus deferred work: auth on the GET report, an OpenTelemetry alternative, a price CRUD screen). Add a row to the CLAUDE.md Features table.
