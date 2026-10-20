'use strict';

// Turns Claude Code transcript JSONL into per-(Taipei date, model) token totals.
// The transcript format is internal to Claude Code and can change between releases;
// keep every assumption about it in this file and bump PARSER_VERSION when it changes.

const PARSER_VERSION = '1';
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000; // Taiwan has no DST
const SKIPPED_MODELS = new Set(['<synthetic>']);

/** 'YYYY-MM-DD' in Taipei (UTC+8) for an ISO timestamp, or null when unparseable. */
function taipeiDate(timestamp) {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/** Token counts of one assistant line's message.usage. Without a cache_creation breakdown, all writes count as 5m. */
function tokensOf(usage) {
  const breakdown = usage.cache_creation;
  const hasBreakdown = breakdown && typeof breakdown === 'object';
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheWrite5mTokens: hasBreakdown ? count(breakdown.ephemeral_5m_input_tokens) : count(usage.cache_creation_input_tokens),
    cacheWrite1hTokens: hasBreakdown ? count(breakdown.ephemeral_1h_input_tokens) : 0,
    cacheReadTokens: count(usage.cache_read_input_tokens),
  };
}

/**
 * Collects one entry per API call from transcript text into `calls` (a Map).
 * Claude Code writes the same call on several lines; the last line for a message.id
 * (falling back to requestId) wins, since it carries the final counts.
 */
function collectCalls(text, calls = new Map()) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry && entry.type === 'assistant' ? entry.message : null;
    if (!message || !message.usage || typeof message.model !== 'string') continue;
    if (SKIPPED_MODELS.has(message.model)) continue;
    const date = taipeiDate(entry.timestamp);
    if (!date) continue;
    const key = message.id || entry.requestId || entry.uuid;
    if (!key) continue;
    calls.set(key, { date, model: message.model, ...tokensOf(message.usage) });
  }
  return calls;
}

const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheWrite5mTokens', 'cacheWrite1hTokens', 'cacheReadTokens'];

/** Sums calls per (usageDate, model), dropping all-zero rows; sorted by date then model. */
function aggregate(calls) {
  const rows = new Map();
  for (const call of calls.values()) {
    const key = `${call.date}|${call.model}`;
    let row = rows.get(key);
    if (!row) {
      row = { usageDate: call.date, model: call.model };
      for (const f of TOKEN_FIELDS) row[f] = 0;
      rows.set(key, row);
    }
    for (const f of TOKEN_FIELDS) row[f] += call[f];
  }
  return [...rows.values()]
    .filter((r) => TOKEN_FIELDS.some((f) => r[f] > 0))
    .sort((a, b) => a.usageDate.localeCompare(b.usageDate) || a.model.localeCompare(b.model));
}

/** First `cwd` recorded in the transcript (used by --backfill, where the hook input is not available). */
function firstCwd(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('"cwd"')) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.cwd === 'string' && entry.cwd) return entry.cwd;
    } catch {
      // ignore broken lines
    }
  }
  return null;
}

module.exports = { PARSER_VERSION, taipeiDate, tokensOf, collectCalls, aggregate, firstCwd };
