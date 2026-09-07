export function description(blocks, fallback = '블라리요에서 블라블라블라') {
  const text = blocks.find((b) => b.type === 'TEXT')?.text;
  if (!text) return fallback;
  const normalized = text.replace(/\p{White_Space}+/gu, ' ').trim();
  const graphemes = [
    ...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(normalized),
  ].map((s) => s.segment);
  return graphemes.length > 120 ? graphemes.slice(0, 119).join('') + '…' : normalized;
}
