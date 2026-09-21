// Reads a JSON object passed to a known bootstrap function; never evaluates page code.
export function jsonArgument(source, marker) {
  const offset = source.indexOf(marker);
  if (offset < 0) return null;
  const start = source.indexOf('{', offset + marker.length);
  if (start < 0) return null;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(source.slice(start, index + 1));
  }
  throw new Error('INCOMPLETE_EMBEDDED_JSON');
}

// X's public SSR records contain JavaScript references, so parse only the exact
// NoteTweet record's JSON string literal. Page code is never evaluated.
export function noteTweetText(source, encodedResultsId) {
  const decoded = Buffer.from(encodedResultsId, 'base64').toString('utf8');
  const id = /^NoteTweetResults:(\d+)$/.exec(decoded)?.[1];
  if (!id) throw new Error('INVALID_NOTE_TWEET_ID');
  const pattern = new RegExp(
    '__typename:"NoteTweet",\\s*rest_id:"' + id + '",\\s*text:("(?:\\\\.|[^"\\\\])*")',
    'g'
  );
  const matches = [...source.matchAll(pattern)].map((match) => JSON.parse(match[1]));
  if (!matches.length || new Set(matches).size !== 1 || !matches[0].trim())
    throw new Error('NOTE_TWEET_TEXT_NOT_UNIQUE');
  return { id, text: matches[0] };
}
