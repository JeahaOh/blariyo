import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Both Gradle and the Node discovery test must use the same explicit Java 25 runtime.
const javaHome = process.env.JAVA_HOME;
if (!javaHome) throw new Error('Set JAVA_HOME to a Java 25 JDK before running integration tests');
const java = spawnSync(resolve(javaHome, 'bin/java'), ['-version'], { encoding: 'utf8' });
if (java.status !== 0 || !/version "25(?:[.\"])/.test(java.stderr + java.stdout))
  throw new Error('Integration fixtures require JAVA_HOME pointing to Java 25');
const result = spawnSync(
  'apps/collector/gradlew',
  ['-p', 'apps/collector', 'testClasses', 'fixtureClasspath'],
  {
    stdio: 'inherit',
  }
);
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
