'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { taipeiDate, tokensOf, collectCalls, aggregate, sessionName, firstCwd } = require('../lib/parse');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'session.jsonl'), 'utf8');

test('taipeiDate converts UTC timestamps to the UTC+8 date', () => {
  assert.equal(taipeiDate('2026-10-19T15:59:59.999Z'), '2026-10-19');
  assert.equal(taipeiDate('2026-10-19T16:00:00.000Z'), '2026-10-20');
  assert.equal(taipeiDate('nonsense'), null);
});

test('tokensOf splits cache writes by TTL, or counts them as 5m without a breakdown', () => {
  assert.deepEqual(
    tokensOf({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 9,
      cache_creation: { ephemeral_5m_input_tokens: 4, ephemeral_1h_input_tokens: 5 } }),
    { inputTokens: 1, outputTokens: 2, cacheWrite5mTokens: 4, cacheWrite1hTokens: 5, cacheReadTokens: 3 });
  assert.deepEqual(
    tokensOf({ input_tokens: 1, cache_creation_input_tokens: 9 }),
    { inputTokens: 1, outputTokens: 0, cacheWrite5mTokens: 9, cacheWrite1hTokens: 0, cacheReadTokens: 0 });
});

test('collectCalls counts each message.id once, keeping the last line', () => {
  const calls = collectCalls(fixture);

  assert.equal(calls.size, 4); // msg_1 (3 lines), msg_2, msg_3, msg_5; <synthetic> dropped
  assert.equal(calls.get('msg_1').outputTokens, 343);
});

test('collectCalls falls back to requestId when message.id is missing', () => {
  const line = (out) => JSON.stringify({ type: 'assistant', requestId: 'req_x', timestamp: '2026-10-20T00:00:00Z',
    message: { model: 'm', usage: { output_tokens: out } } });
  const calls = collectCalls([line(1), line(5)].join('\n'));

  assert.equal(calls.size, 1);
  assert.equal(calls.get('req_x').outputTokens, 5);
});

test('aggregate sums per Taipei date and model and drops all-zero rows', () => {
  const rows = aggregate(collectCalls(fixture));

  assert.deepEqual(rows, [
    // msg_1 at 15:55Z → 2026-10-19 23:55 Taipei
    { usageDate: '2026-10-19', model: 'claude-opus-5-5',
      inputTokens: 2, outputTokens: 343, cacheWrite5mTokens: 0, cacheWrite1hTokens: 100, cacheReadTokens: 1000 },
    // after midnight Taipei; msg_2 has no breakdown, so its 40 writes count as 5m
    { usageDate: '2026-10-20', model: 'claude-haiku-5-5',
      inputTokens: 500, outputTokens: 20, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, cacheReadTokens: 0 },
    { usageDate: '2026-10-20', model: 'claude-opus-5-5',
      inputTokens: 3, outputTokens: 7, cacheWrite5mTokens: 40, cacheWrite1hTokens: 0, cacheReadTokens: 2000 },
  ]);
});

test('firstCwd returns the first recorded working directory', () => {
  assert.equal(firstCwd(fixture), 'C:\\course\\cms');
  assert.equal(firstCwd('{"type":"x"}'), null);
});

test('sessionName prefers the last custom-title, then the last ai-title, trimmed and capped', () => {
  assert.equal(sessionName(fixture), 'token report');
  const ai = (t) => JSON.stringify({ type: 'ai-title', aiTitle: t });
  assert.equal(sessionName([ai('first'), ai('second')].join('\n')), 'second');
  assert.equal(sessionName(ai('x'.repeat(250))).length, 200);
  assert.equal(sessionName(JSON.stringify({ type: 'custom-title', customTitle: '  ' }) + '\n' + ai('fallback')), 'fallback');
  assert.equal(sessionName('{"type":"user"}'), null);
});
