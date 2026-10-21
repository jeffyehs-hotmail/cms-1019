import { brochureFooterText, printTitle, toCssString, truncateTitle } from './brochure-print';

describe('brochure-print', () => {
  describe('truncateTitle', () => {
    it('keeps titles up to the limit', () => {
      expect(truncateTitle('Azure 管理', 30)).toBe('Azure 管理');
      expect(truncateTitle('a'.repeat(30), 30)).toBe('a'.repeat(30));
    });

    it('cuts a 60-character title to 30 plus …', () => {
      expect(truncateTitle('課'.repeat(60), 30)).toBe(`${'課'.repeat(30)}…`);
    });

    it('never splits an emoji (surrogate pair) at the cut', () => {
      const t = `${'a'.repeat(29)}😀${'b'.repeat(10)}`;
      expect(truncateTitle(t, 30)).toBe(`${'a'.repeat(29)}😀…`);
    });
  });

  it('brochureFooterText joins company, title and date with ·', () => {
    expect(brochureFooterText('Azure 管理', '2026-10-21')).toBe('恆逸教育訓練中心 · Azure 管理 · 2026/10/21');
  });

  describe('toCssString', () => {
    it('quotes plain text', () => expect(toCssString('Azure 管理')).toBe('"Azure 管理"'));
    it('escapes double quotes', () => expect(toCssString('A "B"')).toBe('"A \\"B\\""'));
    it('escapes backslashes', () => expect(toCssString('C:\\x')).toBe('"C:\\\\x"'));
    it('drops control characters', () => expect(toCssString('a\nb\tc\u0085d')).toBe('"abcd"'));
  });

  it('printTitle replaces characters Windows file names reject', () => {
    expect(printTitle('AZ-104')).toBe('AZ-104');
    expect(printTitle('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });
});
