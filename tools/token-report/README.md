# token-report: Claude Code token usage → CMS

A Claude Code **SessionEnd** hook that sends each session's token usage to the CMS API (`POST /api/agent-token-usages`). The report is in the CMS at 系統管理 › Token 用量. Spec: `spec/agent/AgentTokenUsage.md`.

It runs in plain Node (18 or later) and has no dependencies.

## Install (once per developer machine)

1. **Get an agent token.** In the CMS, open 系統管理 › 使用者 › (your user) and click **重新產生 Agent Token**. Copy the `cms_at_…` token. It is shown only once.
2. **Create `~/.claude/token-report.json`.** It is never committed.

   ```json
   { "apiUrl": "http://localhost:5000", "token": "cms_at_..." }
   ```

3. **Register the hook in your user-level `~/.claude/settings.json`.** User level covers every project. Use the absolute path to this folder:

   ```json
   {
     "hooks": {
       "SessionEnd": [
         {
           "hooks": [
             { "type": "command", "command": "node \"C:/course/cms/tools/token-report/report.js\"", "timeout": 30 }
           ]
         }
       ]
     }
   }
   ```

   The default SessionEnd timeout is 1.5 s, which is too short for an HTTP call. Keep `"timeout": 30`; the script itself stops sending after 25 s.

4. **Optional: backfill.** Send every transcript still on disk. Claude Code keeps them for 30 days by default (`cleanupPeriodDays`).

   ```sh
   node tools/token-report/report.js --backfill
   ```

## How it works

1. **Parse.** The hook reads `transcript_path` plus `<session>/subagents/*.jsonl`.
   - Each API call is counted once, by `message.id`, using the last line written for it.
   - `<synthetic>` entries and zero-token entries are dropped.
   - Each call's UTC timestamp is converted to a Taipei (UTC+8) date. A session that crosses midnight gives rows for both days.
2. **Project.** The project name is taken from the `origin` remote repo name. Without a remote, it falls back to the git root folder name, then to the `cwd` folder name.
3. **Outbox.** The report is written to `~/.claude/token-report/outbox/<sessionId>.json`, then every outbox file is POSTed:

   | Response | What happens |
   |---|---|
   | 2xx | File deleted |
   | 408, 429, 5xx, offline | File kept; retried at the next session end |
   | Other 4xx | File moved to `failed/`. After fixing the token or config, run `node report.js --retry-failed` |

4. **Server.** The server replaces all rows of a session on every report, so resending (resume, retry, backfill) never double-counts. The user is taken from the token, and cost is calculated on the server from `AgentModelPrice`.
5. **Errors.** The script always exits 0. Problems are printed to stderr and never block Claude Code.

The transcript format is internal to Claude Code and may change. All format assumptions live in `lib/parse.js`. Bump `PARSER_VERSION` there when they change. The version is stored with every row.

## Tests

```sh
cd tools/token-report && node --test
```
