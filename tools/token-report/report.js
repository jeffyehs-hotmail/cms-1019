#!/usr/bin/env node
'use strict';

// Claude Code token usage reporter (CMS 系統管理 › Token 用量).
//
//   SessionEnd hook:  node report.js                 (hook JSON on stdin)
//   Backfill:         node report.js --backfill      (every transcript still in ~/.claude/projects)
//   Retry rejected:   node report.js --retry-failed  (moves failed/ back to the outbox and sends)
//
// Config: ~/.claude/token-report.json  { "apiUrl": "http://localhost:5000", "token": "cms_at_..." }
// Never fails the session: errors go to stderr and the exit code is always 0.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PARSER_VERSION, collectCalls, aggregate, sessionName, firstCwd } = require('./lib/parse');
const { resolveProject } = require('./lib/project');
const { enqueue, flush, requeueFailed } = require('./lib/outbox');

const HOOK_BUDGET_MS = 25_000; // the hook is registered with timeout 30
const REQUEST_TIMEOUT_MS = 10_000;

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** Subagent transcripts live next to the main one: <dir>/<sessionId>/subagents/*.jsonl */
function subagentFiles(transcriptPath, sessionId) {
  const dir = path.join(path.dirname(transcriptPath), sessionId, 'subagents');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/** The session's full report (main + subagent transcripts), or null when it used no tokens. */
function buildReport({ sessionId, transcriptPath, cwd }, resolve = resolveProject) {
  const main = readText(transcriptPath);
  const calls = collectCalls(main);
  for (const file of subagentFiles(transcriptPath, sessionId)) collectCalls(readText(file), calls);
  const rows = aggregate(calls);
  if (rows.length === 0) return null;
  return {
    sessionId,
    sessionName: sessionName(main),
    project: resolve(cwd || firstCwd(main)),
    parserVersion: PARSER_VERSION,
    rows,
  };
}

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(claudeDir(), 'token-report.json'), 'utf8'));
    return cfg && cfg.apiUrl && cfg.token ? cfg : null;
  } catch {
    return null;
  }
}

function poster(cfg) {
  const url = `${cfg.apiUrl.replace(/\/+$/, '')}/api/agent-token-usages`;
  return async (report) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { status: res.status, body: res.ok ? '' : await res.text().catch(() => '') };
    } catch {
      return { status: 0, body: '' };
    }
  };
}

async function send(home, deadline) {
  const cfg = readConfig();
  if (!cfg) {
    console.error(`token-report: no apiUrl/token in ${path.join(claudeDir(), 'token-report.json')}; reports kept in the outbox`);
    return;
  }
  const r = await flush(home, poster(cfg), { deadline, log: (m) => console.error(m) });
  if (r.failed || r.retry) console.error(`token-report: sent ${r.sent}, rejected ${r.failed}, pending ${r.retry}`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function hook(home) {
  const deadline = Date.now() + HOOK_BUDGET_MS;
  const input = JSON.parse(await readStdin());
  if (input.session_id && input.transcript_path) {
    const report = buildReport({ sessionId: input.session_id, transcriptPath: input.transcript_path, cwd: input.cwd });
    if (report) enqueue(home, report);
  }
  await send(home, deadline);
}

async function backfill(home) {
  const projectsDir = path.join(claudeDir(), 'projects');
  let queued = 0;
  for (const dir of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = path.join(projectsDir, dir.name);
    for (const f of fs.readdirSync(base)) {
      // agent-*.jsonl are subagent sidechains from older Claude Code versions, not sessions.
      if (!f.endsWith('.jsonl') || f.startsWith('agent-')) continue;
      const report = buildReport({ sessionId: f.slice(0, -'.jsonl'.length), transcriptPath: path.join(base, f) });
      if (report) {
        enqueue(home, report);
        queued += 1;
      }
    }
  }
  console.log(`token-report: queued ${queued} sessions`);
  await send(home, Infinity);
}

async function main(argv) {
  const home = path.join(claudeDir(), 'token-report');
  if (argv.includes('--backfill')) return backfill(home);
  if (argv.includes('--retry-failed')) {
    const { moved, dropped } = requeueFailed(home);
    console.log(`token-report: requeued ${moved} reports${dropped ? `, dropped ${dropped} superseded by a newer queued copy` : ''}`);
    return send(home, Infinity);
  }
  return hook(home);
}

if (require.main === module) {
  main(process.argv.slice(2))
    .catch((err) => console.error(`token-report: ${err && err.message ? err.message : err}`))
    .finally(() => {
      process.exitCode = 0;
    });
}

module.exports = { buildReport, subagentFiles };
