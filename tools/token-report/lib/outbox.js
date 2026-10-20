'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Reports are spooled to <home>/outbox/<sessionId>.json before sending, so nothing is lost when the API is down.
// The server replaces a session's rows on every report, so resending is always safe.

function dirs(home) {
  return { outbox: path.join(home, 'outbox'), failed: path.join(home, 'failed') };
}

function fileName(sessionId) {
  return `${sessionId.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}

/** Writes (or overwrites) the session's report in the outbox. */
function enqueue(home, report) {
  const { outbox } = dirs(home);
  fs.mkdirSync(outbox, { recursive: true });
  const file = path.join(outbox, fileName(report.sessionId));
  fs.writeFileSync(file, JSON.stringify(report), 'utf8');
  return file;
}

/** 2xx = sent; 408/429/5xx/network = retry later; any other 4xx = the report or token is bad, park it in failed/. */
function outcomeOf(status) {
  if (status >= 200 && status < 300) return 'sent';
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'failed';
  return 'retry';
}

/**
 * Sends every outbox file through `post(report) → Promise<{ status, body }>` (status 0 = network error),
 * oldest first, until `deadline` (ms timestamp). Returns counts per outcome.
 */
async function flush(home, post, { deadline = Infinity, log = () => {} } = {}) {
  const { outbox, failed } = dirs(home);
  const result = { sent: 0, failed: 0, retry: 0 };
  let files;
  try {
    files = fs.readdirSync(outbox).filter((f) => f.endsWith('.json'));
  } catch {
    return result;
  }
  files = files
    .map((f) => ({ f, t: fs.statSync(path.join(outbox, f)).mtimeMs }))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.f);

  for (const f of files) {
    if (Date.now() >= deadline) {
      result.retry += 1;
      continue;
    }
    const file = path.join(outbox, f);
    let report;
    try {
      report = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      moveTo(failed, file);
      result.failed += 1;
      continue;
    }
    const { status, body } = await post(report);
    const outcome = outcomeOf(status);
    result[outcome] += 1;
    if (outcome === 'sent') fs.rmSync(file, { force: true });
    else if (outcome === 'failed') {
      moveTo(failed, file);
      log(`token-report: ${f} rejected (${status}) ${body || ''}`.trim());
    }
  }
  return result;
}

function moveTo(dir, file) {
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(file, path.join(dir, path.basename(file)));
}

/** Moves failed/ reports back to the outbox (after fixing the token or config). */
function requeueFailed(home) {
  const { outbox, failed } = dirs(home);
  let files = [];
  try {
    files = fs.readdirSync(failed).filter((f) => f.endsWith('.json'));
  } catch {
    return 0;
  }
  fs.mkdirSync(outbox, { recursive: true });
  for (const f of files) fs.renameSync(path.join(failed, f), path.join(outbox, f));
  return files.length;
}

module.exports = { enqueue, flush, outcomeOf, requeueFailed, fileName };
