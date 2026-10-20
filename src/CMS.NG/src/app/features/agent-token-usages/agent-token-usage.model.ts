/** Token 用量 report row: AgentTokenUsage summed per (Taipei date, user, project, model). */
export interface AgentTokenUsage {
  /** `yyyy-MM-dd`, Taipei (UTC+8) date. */
  usageDate: string;
  userId: string;
  userName: string;
  project: string;
  model: string;
  /** Filled only when the query sets `groupBySession`. */
  sessionId: string | null;
  /** Session name (last /rename title, else auto title); null = unnamed. Only with `groupBySession`. */
  sessionName: string | null;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  cacheReadTokens: number;
  /** USD at list price; null when every row is unpriced. */
  cost: number | null;
  /** At least one session row has no AgentModelPrice (cost incomplete). */
  hasUnpricedRows: boolean;
}

/** POST /api/agent-token-usages/query. Missing dates default to the current Taipei month on the server. */
export interface AgentTokenUsageQuery {
  from: string | null;
  to: string | null;
  userIds: string[];
  projects: string[];
  models: string[];
  /** 依工作階段: one row per session as well, with sessionId / sessionName. */
  groupBySession: boolean;
}

export interface AgentTokenUsageFilterOptions {
  projects: string[];
  models: string[];
}

/** Both cache-write TTLs together. */
export function cacheWriteTokens(r: AgentTokenUsage): number {
  return r.cacheWrite5mTokens + r.cacheWrite1hTokens;
}

/** "Token in": every input-side token (input + cache writes + cache reads). */
export function tokenInTokens(r: AgentTokenUsage): number {
  return r.inputTokens + cacheWriteTokens(r) + r.cacheReadTokens;
}

export interface AgentTokenUsageTotals {
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  tokenInTokens: number;
  cost: number;
  hasUnpricedRows: boolean;
}

/** Grand total of the report rows (unpriced costs count as 0 and set `hasUnpricedRows`). */
export function totalsOf(rows: AgentTokenUsage[]): AgentTokenUsageTotals {
  const t: AgentTokenUsageTotals = {
    sessionCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    tokenInTokens: 0,
    cost: 0,
    hasUnpricedRows: false,
  };
  for (const r of rows) {
    t.sessionCount += r.sessionCount;
    t.inputTokens += r.inputTokens;
    t.outputTokens += r.outputTokens;
    t.cacheWriteTokens += cacheWriteTokens(r);
    t.cacheReadTokens += r.cacheReadTokens;
    t.tokenInTokens += tokenInTokens(r);
    t.cost += r.cost ?? 0;
    t.hasUnpricedRows ||= r.hasUnpricedRows;
  }
  return t;
}

/** Local-midnight Dates for the first and last day of the current Taipei (UTC+8) month. */
export function currentTaipeiMonth(now: Date = new Date()): { from: Date; to: Date } {
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = taipei.getUTCFullYear();
  const month = taipei.getUTCMonth();
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) };
}
