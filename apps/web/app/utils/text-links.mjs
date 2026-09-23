/** Preserve every source character; only valid credential-free HTTP(S) URLs become links.
 * @param {string} text
 * @returns {Array<{text:string,href?:string}>}
 */
export function textLinks(text) {
  /** @type {Array<[string,string]>} */
  const brackets = [['(', ')'], ['[', ']'], ['{', '}']];
  const parts = [];
  let offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/giu)) {
    let candidate = match[0].replace(/[.,!?:;]+$/u, '');
    for (const [open, close] of brackets) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length)
        candidate = candidate.slice(0, -1);
    }
    let href;
    try {
      const url = new URL(candidate);
      if (url.hostname && !url.username && !url.password) href = url.href;
    } catch { /* Keep invalid input as plain text. */ }
    if (!href) continue;
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) });
    parts.push({ text: candidate, href });
    offset = match.index + candidate.length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
