import { escapeHtml } from './html.util';

describe('html.util', () => {
  it('escapeHtml escapes &, <, >, " and \'', () => {
    expect(escapeHtml(`A & B <img src=x onerror="alert('x')">`)).toBe(
      'A &amp; B &lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;',
    );
  });

  it('escapeHtml escapes & first, so existing entities are shown literally', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapeHtml leaves plain text unchanged and stringifies numbers / null', () => {
    expect(escapeHtml('CCNP 課程')).toBe('CCNP 課程');
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escaped text renders as text through innerHTML', () => {
    const div = document.createElement('div');
    div.innerHTML = `<b>${escapeHtml('A <img src=x> & B')}</b>`;
    expect(div.textContent).toBe('A <img src=x> & B');
    expect(div.querySelector('img')).toBeNull();
  });
});
