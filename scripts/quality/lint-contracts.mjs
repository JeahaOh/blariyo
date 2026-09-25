export function requireNonEmptyScope(name, count) {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`Required lint scope is empty or invalid: ${name}`);
  return count;
}

export function requireReportedFiles(tool, files) {
  if (!Array.isArray(files) || files.length === 0)
    throw new Error(`${tool} returned no file results for a required lint scope`);
  return files;
}

export function requireExactFileCoverage(tool, reportedPaths, expectedPaths) {
  requireReportedFiles(tool, reportedPaths);
  if (!Array.isArray(expectedPaths)) throw new Error(`${tool} expected files must be an array`);
  requireNonEmptyScope(`${tool} expected files`, expectedPaths.length);
  if ([...reportedPaths, ...expectedPaths].some((path) => typeof path !== 'string' || !path))
    throw new Error(`${tool} file results contain an invalid path`);
  const normalize = (path) => path.replaceAll('\\', '/').replace(/^\.\//, '');
  const reported = reportedPaths.map(normalize);
  const expected = expectedPaths.map(normalize);
  const reportedSet = new Set(reported);
  const expectedSet = new Set(expected);
  if (reportedSet.size !== reported.length)
    throw new Error(`${tool} returned duplicate file results`);
  const missing = expected.filter((path) => !reportedSet.has(path));
  const unexpected = reported.filter((path) => !expectedSet.has(path));
  if (missing.length || unexpected.length)
    throw new Error(
      `${tool} file coverage mismatch (${missing.length} missing, ${unexpected.length} unexpected)`
    );
  return reportedPaths;
}

export function parseSqlFluffReport(output, expectedPaths) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error('SQLFluff did not return valid JSON');
  }
  requireReportedFiles('SQLFluff', report);
  for (const [index, file] of report.entries())
    if (
      !file ||
      typeof file.filepath !== 'string' ||
      !file.filepath ||
      !Array.isArray(file.violations)
    )
      throw new Error(`SQLFluff returned an invalid file result at index ${index}`);
  requireExactFileCoverage(
    'SQLFluff',
    report.map((file) => file.filepath),
    expectedPaths
  );
  return report;
}
