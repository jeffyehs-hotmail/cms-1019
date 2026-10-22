'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { enqueue, flush, outcomeOf, requeueFailed } = require('../lib/outbox');

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'token-report-'));
}

const report = (sessionId) => ({ sessionId, project: 'p', parserVersion: '1', rows: [] });
const list = (dir) => {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
};

test('outcomeOf: 2xx sent, 404/408/429/5xx/network retried, other 4xx failed', () => {
  assert.equal(outcomeOf(204), 'sent');
  assert.equal(outcomeOf(400), 'failed');
  assert.equal(outcomeOf(401), 'failed');
  assert.equal(outcomeOf(409), 'failed');
  assert.equal(outcomeOf(404), 'retry'); // API not updated yet
  assert.equal(outcomeOf(408), 'retry');
  assert.equal(outcomeOf(429), 'retry');
  assert.equal(outcomeOf(500), 'retry');
  assert.equal(outcomeOf(0), 'retry');
});

test('enqueue overwrites the same session and sanitizes the file name', () => {
  const home = tempHome();
  enqueue(home, report('a/b'));
  enqueue(home, { ...report('a/b'), project: 'q' });

  assert.deepEqual(list(path.join(home, 'outbox')), ['a_b.json']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'outbox', 'a_b.json'), 'utf8')).project, 'q');
});

test('flush deletes sent reports, parks rejected ones and keeps the rest', async () => {
  const home = tempHome();
  enqueue(home, report('ok'));
  enqueue(home, report('bad'));
  enqueue(home, report('down'));
  const statuses = { ok: 204, bad: 400, down: 0 };
  const seen = [];

  const result = await flush(home, async (r) => {
    seen.push(r.sessionId);
    return { status: statuses[r.sessionId], body: '{"message":"x"}' };
  });

  assert.deepEqual(result, { sent: 1, failed: 1, retry: 1 });
  assert.deepEqual(seen.sort(), ['bad', 'down', 'ok']);
  assert.deepEqual(list(path.join(home, 'outbox')), ['down.json']);
  assert.deepEqual(list(path.join(home, 'failed')), ['bad.json']);
});

test('flush stops sending at the deadline and leaves the files queued', async () => {
  const home = tempHome();
  enqueue(home, report('a'));
  let calls = 0;

  const result = await flush(home, async () => {
    calls += 1;
    return { status: 204 };
  }, { deadline: Date.now() - 1 });

  assert.equal(calls, 0);
  assert.deepEqual(result, { sent: 0, failed: 0, retry: 1 });
  assert.deepEqual(list(path.join(home, 'outbox')), ['a.json']);
});

test('flush without an outbox is a no-op; requeueFailed moves failed reports back', async () => {
  const home = tempHome();
  assert.deepEqual(await flush(home, async () => ({ status: 204 })), { sent: 0, failed: 0, retry: 0 });

  enqueue(home, report('bad'));
  await flush(home, async () => ({ status: 401 }));
  assert.equal(requeueFailed(home), 1);
  assert.deepEqual(list(path.join(home, 'outbox')), ['bad.json']);
  assert.deepEqual(list(path.join(home, 'failed')), []);
});

test('requeueFailed keeps a newer outbox copy of the same session and drops the failed one', async () => {
  const home = tempHome();
  enqueue(home, { ...report('s'), project: 'old' });
  await flush(home, async () => ({ status: 401 }));
  enqueue(home, { ...report('s'), project: 'new' });

  assert.equal(requeueFailed(home), 0);
  assert.deepEqual(list(path.join(home, 'outbox')), ['s.json']);
  assert.deepEqual(list(path.join(home, 'failed')), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'outbox', 's.json'), 'utf8')).project, 'new');
});

test('flush parks an unparseable outbox file without posting it and still sends the rest', async () => {
  const home = tempHome();
  enqueue(home, report('ok'));
  fs.writeFileSync(path.join(home, 'outbox', 'broken.json'), '{bad', 'utf8');
  const seen = [];

  const result = await flush(home, async (r) => {
    seen.push(r.sessionId);
    return { status: 204 };
  });

  assert.deepEqual(result, { sent: 1, failed: 1, retry: 0 });
  assert.deepEqual(seen, ['ok']);
  assert.deepEqual(list(path.join(home, 'outbox')), []);
  assert.deepEqual(list(path.join(home, 'failed')), ['broken.json']);
});
