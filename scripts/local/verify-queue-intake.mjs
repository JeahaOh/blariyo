// Explicit local confirmation smoke test. This does not connect to Discord Gateway.
// Caller supplies one public URL; source policy is validated by the real intake adapter.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
const [url, ...extra] = process.argv.slice(2);
if (!url || extra.length || new URL(url).protocol !== 'https:')
  throw Error('EXPECTED_PUBLIC_HTTPS_URL');
const config = JSON.parse(await readFile('.local-data/development/batch-config.json', 'utf8'));
if (
  config.version !== 1 ||
  config.batchRole !== 'blariyo_batch_local' ||
  config.objectRoot !== resolve('.local-data/collector-objects')
)
  throw Error('LOCAL_CONFIG_MISMATCH');
const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
await mkdir('.local-data/verification', { recursive: true, mode: 0o700 });
const directory = await mkdtemp(resolve('.local-data/verification/queue-intake-'));
const file = join(directory, 'QueueIntakeSmoke.java');
try {
  await writeFile(
    file,
    `
import com.blariyo.collector.run.*;
import com.blariyo.collector.discord.BatchDiscordIntake;
import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.source.SourceRegistry;
import com.blariyo.collector.shared.Json;
import com.zaxxer.hikari.*;
import java.util.*;
class QueueIntakeSmoke {
 public static void main(String[] args)throws Exception {
  var cfg=new HikariConfig();cfg.setJdbcUrl(OperatorSettings.url());cfg.setUsername(OperatorSettings.user());cfg.setPassword(OperatorSettings.password());cfg.setMaximumPoolSize(2);
  try(var db=new HikariDataSource(cfg)) {
   var store=new BatchStore(db);var queue=new BatchQueueStore(store);String fixture=UUID.randomUUID().toString();
   var intake=new BatchDiscordIntake(queue,()->SourceRegistry.read(System.getenv("COLLECTOR_SOURCES_FILE")),v->HexFormat.of().formatHex(BatchStore.sha(fixture+v)));
   var before=queue.counts();var confirmation=intake.prepare("local-verification","fixture-actor","fixture-channel",args[0]);
   if(!before.equals(queue.counts()))throw new IllegalStateException("PRE_CONFIRMATION_QUEUE_WRITE");
   UUID request=intake.confirm(confirmation.id(),"fixture-actor","fixture-channel");
   if(!request.equals(intake.confirm(confirmation.id(),"fixture-actor","fixture-channel")))throw new IllegalStateException("CONFIRMATION_REPLAY_FAILED");
   System.out.println(Json.tree(Map.of("gatewayConnected",false,"confirmationId",confirmation.id(),"requestId",request,"source",confirmation.source(),"url",confirmation.url(),"preConfirmationQueueUnchanged",true,"idempotentConfirmation",true)));
  }
 }
}
`,
    { mode: 0o600 }
  );
  const java = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const child = spawn(java, ['--class-path', classpath, file, url], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      COLLECTOR_DB_URL: 'jdbc:postgresql://127.0.0.1:5439/blariyo_local',
      COLLECTOR_DB_USER: config.batchRole,
      COLLECTOR_DB_PASSWORD: config.batchPassword,
      COLLECTOR_SOURCES_FILE: resolve('apps/collector/ops/reference-sites.sources.example.json'),
    },
  });
  let output = '';
  child.stdout.on('data', (b) => {
    output += b;
  });
  child.stderr.resume();
  const code = await new Promise((ok, no) => {
    child.once('error', no);
    child.once('exit', ok);
  });
  const line = output.split('\n').findLast((s) => s.startsWith('{'));
  if (code !== 0 || !line) throw Error('LOCAL_QUEUE_INTAKE_FAILED');
  const result = JSON.parse(line);
  await writeFile(
    '.local-data/verification/queue-intake.json',
    JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2),
    { mode: 0o600 }
  );
  console.log(line);
} finally {
  await rm(directory, { recursive: true, force: true });
}
