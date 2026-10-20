import { AgentTokenUsage, cacheWriteTokens, currentTaipeiMonth, tokenInTokens, totalsOf } from './agent-token-usage.model';

describe('agent-token-usage.model', () => {
  const base: AgentTokenUsage = {
    usageDate: '2026-10-20',
    userId: 'alice',
    userName: 'Alice',
    project: 'cms-1019',
    model: 'claude-opus-5-5',
    sessionCount: 1,
    inputTokens: 1,
    outputTokens: 2,
    cacheWrite5mTokens: 3,
    cacheWrite1hTokens: 4,
    cacheReadTokens: 5,
    cost: 1.5,
    hasUnpricedRows: false,
  };
  const unpriced: AgentTokenUsage = { ...base, model: 'new', sessionCount: 2, cost: null, hasUnpricedRows: true };

  it('cacheWriteTokens adds both TTLs; tokenInTokens adds every input-side count', () => {
    expect(cacheWriteTokens(base)).toBe(7);
    expect(tokenInTokens(base)).toBe(1 + 7 + 5);
  });

  it('totalsOf sums rows, counting unpriced cost as 0 and flagging it', () => {
    expect(totalsOf([base, unpriced])).toEqual({
      sessionCount: 3,
      inputTokens: 2,
      outputTokens: 4,
      cacheWriteTokens: 14,
      cacheReadTokens: 10,
      tokenInTokens: 26,
      cost: 1.5,
      hasUnpricedRows: true,
    });
    expect(totalsOf([]).hasUnpricedRows).toBeFalse();
  });

  it('currentTaipeiMonth uses the UTC+8 calendar month', () => {
    // 2026-10-31 16:30 UTC is already 2026-11-01 in Taipei.
    const { from, to } = currentTaipeiMonth(new Date(Date.UTC(2026, 9, 31, 16, 30)));
    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2026, 10, 1]);
    expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([2026, 10, 30]);

    const feb = currentTaipeiMonth(new Date(Date.UTC(2028, 1, 10)));
    expect(feb.to.getDate()).toBe(29);
  });
});
