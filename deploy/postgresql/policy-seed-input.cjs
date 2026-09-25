#!/usr/bin/env node
'use strict';
// Machine pipe only: stdout includes private contact values; parent must capture it.
const fs = require('node:fs');
const path = require('node:path');
const { prepare, validate } = require('../application/prepare-public-config.cjs');
const { renderTemplate } = require('../application/prepare-policy-review.cjs');
function build(config) {
  return [
    ['TERMS', 'terms', '이용약관'],
    ['PRIVACY', 'privacy', '개인정보처리방침'],
  ].map(([type, file, title]) => ({
    type,
    version: 'v0.1-draft.2',
    title,
    status: 'DRAFT',
    effectiveAt: null,
    body: renderTemplate(
      fs.readFileSync(
        path.resolve(__dirname, '../../docs/legal/m0-core/draft-2', file + '.html'),
        'utf8'
      ),
      config
    ),
  }));
}
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--pipe' || process.stdout.isTTY)
    throw Error('PIPE_REQUIRED');
  const { config } = prepare();
  await validate(config);
  process.stdout.write(JSON.stringify(build(config)));
}
module.exports = { build };
if (require.main === module)
  main().catch(() => {
    console.error('POLICY_SEED_INPUT_FAILED');
    process.exitCode = 1;
  });
