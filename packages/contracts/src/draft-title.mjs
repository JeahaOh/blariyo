// Collector reference keys are stable even when an administrator renames a common code.
/** @type {Readonly<Record<string, readonly string[]>>} */
const sourceSuffixes = {
  dogdrip: ['DogDrip.Net 개드립', 'DogDrip.Net', '개드립'],
  theqoo: ['더쿠'],
  ppomppu: ['뽐뿌'],
  yuldo: ['율도', 'YULDO'],
  inven: ['인벤'],
  ruliweb: ['루리웹'],
  arcalive: ['아카라이브', '베스트 라이브'],
  bobaedream: ['보배드림 베스트글', '보배드림'],
  clien: ['클리앙'],
  dcinside: ['디시인사이드', 'HIT 갤러리'],
  dmitory: ['디미토리'],
  etoland: ['이토랜드'],
  fmkorea: ['에펨코리아'],
  goodgag: ['고급유머'],
  humoruniv: ['웃긴대학'],
  instiz: ['인스티즈'],
  mlbpark: ['MLBPARK'],
  natepann: ['네이트판'],
  pgr21: ['PGR21'],
  todayhumor: ['오늘의유머'],
  'youtube-community': ['YouTube'],
};

/** Remove only a known trailing site/board label, never arbitrary hyphenated title text.
 * @param {string} title
 * @param {string} sourceKey
 * @returns {string}
 */
export function draftTitle(title, sourceKey) {
  const trimmed = title.trim();
  const suffixes = Object.hasOwn(sourceSuffixes, sourceKey) ? sourceSuffixes[sourceKey] : [];
  for (const suffix of suffixes ?? []) {
    const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const result = trimmed.replace(new RegExp(`\\s+[-–—|]\\s*${escaped}$`, 'iu'), '').trim();
    if (result && result !== trimmed) return result;
  }
  return trimmed;
}
