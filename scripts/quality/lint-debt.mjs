import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import stylelint from 'stylelint';
import {
  parseSqlFluffReport,
  requireExactFileCoverage,
  requireNonEmptyScope,
  requireReportedFiles,
} from './lint-contracts.mjs';

const root = resolve(import.meta.dirname, '../..');
const candidatePath = resolve(root, process.argv[3] ?? '.quality/baseline.candidate.json');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

async function sourceFiles(directory, extensions) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(resolve(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        if (
          !['node_modules', '.git', '.local-data', 'build', 'dist', 'worklog'].includes(entry.name)
        )
          await visit(child);
      } else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(child);
      }
    }
  }
  await visit(directory);
  return files.sort();
}

export async function sqlFiles() {
  return (await sourceFiles('.', ['.sql'])).map((file) =>
    relative(root, file).replaceAll('\\', '/')
  );
}

export function findingFingerprint(finding, toolVersion, configSha256) {
  const material = [
    finding.tool,
    toolVersion,
    configSha256,
    finding.path,
    finding.contextSha256 ?? '',
    finding.ruleId,
    finding.line ?? '',
    finding.column ?? '',
    finding.message,
  ].join('\0');
  return hash(material);
}

function pythonCommand() {
  const commonGitDir = resolve(
    root,
    execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
  );
  const localPython = resolve(commonGitDir, 'quality-venv/bin/python');
  return process.env.QUALITY_PYTHON ?? (existsSync(localPython) ? localPython : 'python3');
}

async function sqlFindings() {
  const files = await sqlFiles();
  requireNonEmptyScope('SQL', files.length);
  const args = ['-m', 'sqlfluff', 'lint', '--format', 'json', ...files];
  const result = spawnSync(pythonCommand(), args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = result.stdout || result.stderr;
  if (!output.trim().startsWith('['))
    throw new Error(
      `SQLFluff did not return JSON (exit ${result.status}): ${output.slice(0, 500)}`
    );
  const report = parseSqlFluffReport(output, files);
  return report.flatMap((file) =>
    file.violations.map((issue) => ({
      tool: 'sqlfluff',
      path: file.filepath.replaceAll('\\', '/'),
      ruleId: issue.code,
      line: issue.start_line_no,
      column: issue.start_line_pos,
      message: issue.description,
    }))
  );
}

async function cssFindings() {
  const files = await sourceFiles('apps/web/app/assets/css', ['.css']);
  requireNonEmptyScope('CSS', files.length);
  const result = await stylelint.lint({ files, formatter: 'json', cwd: root });
  const report = requireReportedFiles('Stylelint', JSON.parse(result.report));
  const expectedPaths = files.map((file) => relative(root, file).replaceAll('\\', '/'));
  const reportedPaths = report.map((file) =>
    typeof file.source === 'string' ? relative(root, file.source).replaceAll('\\', '/') : ''
  );
  requireExactFileCoverage('Stylelint', reportedPaths, expectedPaths);
  return report.flatMap((file) =>
    file.warnings.map((issue) => ({
      tool: 'stylelint',
      path: relative(root, file.source).replaceAll('\\', '/'),
      ruleId: issue.rule,
      line: issue.line,
      column: issue.column,
      message: issue.text,
    }))
  );
}

async function markdownFindings() {
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.mdx'], {
    cwd: root,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((path) => !path.startsWith('worklog/') && !path.startsWith('codex-session-'));
  requireNonEmptyScope('Markdown', files.length);
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs'), ...files],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status))
    throw new Error(
      `Markdownlint failed to inspect files (exit ${result.status}): ${result.stderr}`
    );
  const output = `${result.stdout}\n${result.stderr}`;
  const findings = [];
  const pattern = /^(.*\.(?:md|mdx)):(\d+)(?::(\d+))? (?:error|warning) ([^ ]+) (.*)$/gm;
  for (const match of output.matchAll(pattern)) {
    findings.push({
      tool: 'markdownlint',
      path: match[1].replaceAll('\\', '/'),
      line: Number(match[2]),
      column: Number(match[3] ?? 1),
      ruleId: match[4],
      message: match[5],
    });
  }
  if (result.status === 1 && findings.length === 0)
    throw new Error(
      `Markdownlint returned failure without parseable findings: ${output.slice(0, 500)}`
    );
  return findings;
}

function prettierFindings() {
  const result = spawnSync(resolve(root, 'node_modules/.bin/prettier'), ['--list-different', '.'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status))
    throw new Error(`Prettier failed to inspect files (exit ${result.status}): ${result.stderr}`);
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => ({
      tool: 'prettier',
      path: path.replaceAll('\\', '/'),
      ruleId: 'format',
      line: null,
      column: null,
      message: 'File differs from configured Prettier output',
    }));
}

async function collect() {
  const [stylelintPackage, markdownlintPackage, prettierPackage, qualityPins] = await Promise.all([
    readFile(resolve(root, 'node_modules/stylelint/package.json'), 'utf8'),
    readFile(resolve(root, 'node_modules/markdownlint-cli2/package.json'), 'utf8'),
    readFile(resolve(root, 'node_modules/prettier/package.json'), 'utf8'),
    readFile(resolve(root, '.quality/requirements.txt'), 'utf8'),
  ]);
  const sqlfluffResult = spawnSync(pythonCommand(), ['-m', 'sqlfluff', '--version'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (sqlfluffResult.status !== 0)
    throw new Error(`Cannot determine SQLFluff version: ${sqlfluffResult.stderr}`);
  const sqlfluffVersion = /version ([\d.]+)/.exec(sqlfluffResult.stdout)?.[1];
  const pinnedSqlfluff = /^sqlfluff==([\d.]+)$/m.exec(qualityPins)?.[1];
  if (!sqlfluffVersion || sqlfluffVersion !== pinnedSqlfluff)
    throw new Error(
      `SQLFluff version ${sqlfluffVersion ?? '(unknown)'} differs from pinned ${pinnedSqlfluff ?? '(missing)'}`
    );
  const toolchain = {
    sqlfluff: sqlfluffVersion,
    stylelint: JSON.parse(stylelintPackage).version,
    markdownlint: JSON.parse(markdownlintPackage).version,
    prettier: JSON.parse(prettierPackage).version,
  };
  const configHashes = {
    sqlfluff: hash(await readFile(resolve(root, '.sqlfluff'))),
    stylelint: hash(await readFile(resolve(root, '.stylelintrc.json'))),
    markdownlint: hash(await readFile(resolve(root, '.markdownlint-cli2.jsonc'))),
    prettier: hash(
      Buffer.concat([
        await readFile(resolve(root, '.prettierrc')),
        await readFile(resolve(root, '.prettierignore')),
      ])
    ),
  };
  const findings = [
    ...(await sqlFindings()),
    ...(await cssFindings()),
    ...(await markdownFindings()),
    ...prettierFindings(),
  ];
  const normalized = await Promise.all(
    findings.map(async (finding) => {
      const content = await readFile(resolve(root, finding.path), 'utf8');
      const fileSha256 = hash(content);
      const sourceLine = finding.line == null ? null : content.split(/\r?\n/)[finding.line - 1];
      const contextSha256 = hash(sourceLine ?? content);
      const toolKey = finding.tool;
      const normalizedFinding = { ...finding, contextSha256 };
      return {
        ...normalizedFinding,
        fileSha256,
        fingerprint: findingFingerprint(
          normalizedFinding,
          toolchain[finding.tool],
          configHashes[toolKey]
        ),
        toolVersion: toolchain[finding.tool],
        configSha256: configHashes[toolKey],
      };
    })
  );
  return {
    findings: normalized,
    policy: Object.fromEntries(
      Object.keys(toolchain).map((tool) => [
        tool,
        { version: toolchain[tool], configSha256: configHashes[tool] },
      ])
    ),
  };
}

export function validateBaseline(
  baseline,
  today = new Date().toISOString().slice(0, 10),
  currentPolicy
) {
  if (
    baseline.schemaVersion !== 1 ||
    baseline.state !== 'approved' ||
    !Array.isArray(baseline.items)
  ) {
    throw new Error('Baseline is absent or not approved; existing findings remain blocking');
  }
  if (!baseline.policy || stableJson(baseline.policy) !== stableJson(currentPolicy)) {
    throw new Error('Lint tool versions/configuration differ from the reviewed baseline policy');
  }
  const seen = new Set();
  for (const item of baseline.items) {
    if (
      !item.path ||
      !item.fingerprint ||
      !/^[a-f0-9]{64}$/.test(item.fingerprint) ||
      !item.reason?.trim() ||
      !item.owner?.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.expiresOn ?? '')
    ) {
      throw new Error(`Incomplete baseline entry: ${item.fingerprint ?? '(no fingerprint)'}`);
    }
    if (new Date(`${item.expiresOn}T00:00:00Z`).toISOString().slice(0, 10) !== item.expiresOn)
      throw new Error(`Invalid baseline expiry date: ${item.path} ${item.expiresOn}`);
    if (item.expiresOn < today)
      throw new Error(`Expired baseline entry: ${item.path} ${item.fingerprint}`);
    if (seen.has(item.fingerprint))
      throw new Error(`Duplicate baseline fingerprint: ${item.fingerprint}`);
    seen.add(item.fingerprint);
  }
  return seen;
}

export function compareFindings(findings, baseline, today, currentPolicy) {
  const approved = validateBaseline(baseline, today, currentPolicy);
  const current = new Set(findings.map((finding) => finding.fingerprint));
  const unapproved = findings.filter((finding) => !approved.has(finding.fingerprint));
  return {
    approved: findings.length - unapproved.length,
    unapproved,
    stale: [...approved].filter((fingerprint) => !current.has(fingerprint)),
  };
}

async function main() {
  const { findings, policy } = await collect();
  const [mode] = process.argv.slice(2);
  if (mode === '--draft') {
    const items = findings.map(
      ({
        tool,
        path,
        ruleId,
        line,
        column,
        message,
        fileSha256,
        contextSha256,
        configSha256,
        toolVersion,
        fingerprint,
      }) => ({
        tool,
        path,
        ruleId,
        line,
        column,
        message,
        fileSha256,
        contextSha256,
        configSha256,
        toolVersion,
        fingerprint,
        reason: null,
        owner: null,
        expiresOn: null,
      })
    );
    const draft = {
      schemaVersion: 1,
      state: 'draft-needs-review',
      generatedAt: new Date().toISOString(),
      policy,
      items,
    };
    await writeFile(candidatePath, `${JSON.stringify(draft, null, 2)}\n`, { flag: 'wx' });
    console.log(
      `Wrote ${items.length} exact findings to ${relative(root, candidatePath)}; no exceptions were approved.`
    );
    return;
  }
  if (mode !== '--check') throw new Error('Usage: lint-debt.mjs < --check | --draft >');
  if (process.env.LINT_BASELINE_SHA && !/^[a-f0-9]{40}$/i.test(process.env.LINT_BASELINE_SHA))
    throw new Error('Invalid LINT_BASELINE_SHA');
  const baselinePath = resolve(root, '.quality/baseline.json');
  let baseline;
  try {
    if (process.env.LINT_BASELINE_SHA) {
      const bytes = execFileSync(
        'git',
        ['show', `${process.env.LINT_BASELINE_SHA}:.quality/baseline.json`],
        { cwd: root }
      );
      baseline = JSON.parse(bytes.toString('utf8'));
    } else {
      baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
    }
  } catch {
    if (findings.length === 0) {
      console.log('[lint-debt] No findings; no exception baseline is required.');
      return;
    }
    const counts = findings.reduce((summary, finding) => {
      summary[finding.tool] = (summary[finding.tool] ?? 0) + 1;
      return summary;
    }, {});
    console.error(
      `[lint-debt] Trusted .quality/baseline.json is missing or unreadable; ${findings.length} findings remain blocking: ${JSON.stringify(counts)}`
    );
    process.exitCode = 1;
    return;
  }
  const { approved, unapproved, stale } = compareFindings(findings, baseline, undefined, policy);
  console.log(
    `[lint-debt] ${findings.length} findings; approved ${approved}; new ${unapproved.length}; stale ${stale.length}`
  );
  if (stale.length)
    console.warn(
      `[lint-debt] ${stale.length} approved entries no longer match current findings; review for cleanup`
    );
  if (unapproved.length) {
    for (const finding of unapproved.slice(0, 20))
      console.error(
        `[lint-debt] NEW ${finding.tool} ${finding.path}:${finding.line ?? '-'} ${finding.ruleId}`
      );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[lint-debt] ${error.message}`);
    process.exitCode = 1;
  });
}
