const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
];

export function secretKinds(text) {
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
}

export function looksBinary(buffer) {
  return buffer.includes(0);
}
