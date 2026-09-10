import { spawn, type ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Compiler polling also works where native recursive file watching is unavailable.
// Development runs the compiled Nest main, with a fresh process after each valid build.
const directory = fileURLToPath(new URL('.', import.meta.url));
await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
let server: ChildProcess | undefined;
let stopping = false;
let restarting = Promise.resolve();
let reportedError = false;
const formatting: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => directory,
  getCanonicalFileName: (file) => file,
  getNewLine: () => '\n',
};
async function stopServer(): Promise<void> {
  const current = server;
  server = undefined;
  if (!current || current.exitCode !== null || current.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => current.kill('SIGKILL'), 10000);
    current.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
    current.kill('SIGTERM');
  });
}
const host = ts.createWatchCompilerHost(
  fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
  { noEmitOnError: true },
  ts.sys,
  ts.createEmitAndSemanticDiagnosticsBuilderProgram,
  (diagnostic) => {
    if (diagnostic.category === ts.DiagnosticCategory.Error) reportedError = true;
    console.error(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatting));
  },
  (diagnostic) => console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
  {
    watchFile: ts.WatchFileKind.DynamicPriorityPolling,
    watchDirectory: ts.WatchDirectoryKind.DynamicPriorityPolling,
  }
);
const compile = host.afterProgramCreate?.bind(host);
host.afterProgramCreate = (builder) => {
  reportedError = false;
  compile?.(builder);
  if (
    reportedError ||
    ts
      .getPreEmitDiagnostics(builder.getProgram())
      .some((item) => item.category === ts.DiagnosticCategory.Error)
  )
    return;
  restarting = restarting
    .then(async () => {
      if (stopping) return;
      await stopServer();
      if (stopping) return;
      console.log('Restarting Nest after successful TypeScript build');
      server = spawn(process.execPath, ['dist/main.js'], {
        cwd: directory,
        env: process.env,
        stdio: 'inherit',
      });
      server.once('error', () => console.error('DEV_SERVER_START_FAILED'));
    })
    .catch(() => {
      console.error('DEV_RESTART_FAILED');
    });
};
const watcher = ts.createWatchProgram(host);
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  watcher.close();
  await restarting;
  await stopServer();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void shutdown();
  });
