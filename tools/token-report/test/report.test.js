'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildReport } = require('../report');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'session.jsonl'), 'utf8');

function sessionDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-report-session-'));
  const transcriptPath = path.join(dir, 'sess-1.jsonl');
  fs.writeFileSync(transcriptPath, fixture);
  return { dir, transcriptPath };
}

test('buildReport includes subagent transcripts and uses the hook cwd for the project', () => {
  const { dir, transcriptPath } = sessionDir();
  const subagents = path.join(dir, 'sess-1', 'subagents');
  fs.mkdirSync(subagents, { recursive: true });
  const sub = (id, out) => JSON.stringify({ type: 'assistant', timestamp: '2026-10-20T01:00:00Z',
    message: { id, model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: out } } });
  fs.writeFileSync(path.join(subagents, 'agent-a.jsonl'), [sub('sub_1', 1), sub('sub_1', 4)].join('\n'));
  fs.writeFileSync(path.join(subagents, 'notes.txt'), 'ignored');
  const projects = [];

  const report = buildReport({ sessionId: 'sess-1', transcriptPath, cwd: 'D:\\work\\x' }, (cwd) => {
    projects.push(cwd);
    return 'x-repo';
  });

  assert.deepEqual(projects, ['D:\\work\\x']);
  assert.equal(report.sessionId, 'sess-1');
  assert.equal(report.project, 'x-repo');
  assert.equal(report.parserVersion, '1');
  const haiku = report.rows.find((r) => r.usageDate === '2026-10-20' && r.model === 'claude-haiku-5-5');
  assert.equal(haiku.inputTokens, 600);  // 500 main + 100 subagent (counted once)
  assert.equal(haiku.outputTokens, 24);
});

test('buildReport falls back to the transcript cwd (backfill) and returns null without tokens', () => {
  const { dir, transcriptPath } = sessionDir();
  const seen = [];
  buildReport({ sessionId: 'sess-1', transcriptPath }, (cwd) => {
    seen.push(cwd);
    return 'p';
  });
  assert.deepEqual(seen, ['C:\\course\\cms']);

  const empty = path.join(dir, 'empty.jsonl');
  fs.writeFileSync(empty, '{"type":"user"}\n');
  assert.equal(buildReport({ sessionId: 'empty', transcriptPath: empty }, () => 'p'), null);
  assert.equal(buildReport({ sessionId: 'missing', transcriptPath: path.join(dir, 'nope.jsonl') }, () => 'p'), null);
});
