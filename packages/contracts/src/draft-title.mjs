// Collector reference keys are stable even when an administrator renames a common code.
/** @type {Readonly<Record<string, readonly string[]>>} */
const sourceSuffixes = {
  dogdrip: ['DogDrip.Net 개드립', 'DogDrip.Net', '개드립'],
  theqoo: ['더쿠'],
  ppomppu: ['뽐뿌'],
  yuldo: ['율도', 'YULDO', '유머/이슈'],
  inven: ['인벤'],
  ruliweb: ['루리웹'],
  arcalive: ['아카라이브', '베스트 라이브'],
  bobaedream: ['보배드림 베스트글', '보배드림'],
  clien: ['클리앙'],
  dcinside: ['디시인사이드', 'HIT 갤러리'],
  dmitory: ['디미토리'],
  etoland: ['이토랜드', '유머 게시판'],
  fmkorea: ['에펨코리아'],
  goodgag: ['고급유머'],
  humoruniv: ['웃긴대학'],
  instiz: ['인스티즈'],
  mlbpark: ['MLBPARK'],
  natepann: ['네이트판', '네이트 판'],
  pgr21: ['PGR21'],
  todayhumor: ['오늘의유머'],
  'youtube-community': ['YouTube'],
};

/** @type {Readonly<Record<string, readonly string[]>>} */
const sourcePrefixes = {
  theqoo: ['더쿠'],
  todayhumor: ['오늘의유머'],
  dmitory: ['이슈/유머'],
};

/** @param {string} label */
function labelPattern(label) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

/** Remove known source labels, never arbitrary hyphenated title text.
 * @param {string} title
 * @param {string} sourceKey
 * @returns {string}
 */
export function draftTitle(title, sourceKey) {
  let result = title.trim();
  const prefixes = Object.hasOwn(sourcePrefixes, sourceKey) ? sourcePrefixes[sourceKey] : [];
  const suffixes = Object.hasOwn(sourceSuffixes, sourceKey) ? sourceSuffixes[sourceKey] : [];
  // Repeated known labels occur as "title - board | site". Never split on
  // arbitrary punctuation or remove a label from the middle of article text.
  const separator = '\\s+[-–—|:]\\s*';
  let previous;
  do {
    previous = result;
    for (const prefix of prefixes ?? []) {
      const stripped = result.replace(new RegExp(`^${labelPattern(prefix)}${separator}`, 'iu'), '').trim();
      if (stripped) result = stripped;
    }
    for (const suffix of suffixes ?? []) {
      const stripped = result.replace(new RegExp(`${separator}${labelPattern(suffix)}$`, 'iu'), '').trim();
      if (stripped) result = stripped;
    }
  } while (result !== previous);
  return result;
}
