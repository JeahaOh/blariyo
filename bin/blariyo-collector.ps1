$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jar = if ($env:COLLECTOR_JAR) { $env:COLLECTOR_JAR } else { Join-Path $root 'apps/collector/build/libs/blariyo-collector-0.1.0.jar' }
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { 'java' }
if (-not $env:COLLECTOR_SOURCES_FILE) { $env:COLLECTOR_SOURCES_FILE = Join-Path $root 'apps/collector/ops/reference-sites.sources.example.json' }
& $java '-Dloader.main=com.blariyo.collector.ops.BatchMain' '-cp' $jar 'org.springframework.boot.loader.launch.PropertiesLauncher' @args
exit $LASTEXITCODE
