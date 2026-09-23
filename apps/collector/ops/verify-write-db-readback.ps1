$ErrorActionPreference = 'Stop'

if ($args.Count -gt 0 -and $args[0] -eq '--help') {
@'
Usage:
  apps\collector\ops\verify-write-db-readback.ps1 [source ...]
  apps\collector\ops\verify-write-db-readback.ps1 --manifest apps\collector\ops\production-readback-sample.json

Required environment:
  COLLECTOR_DB_URL                 jdbc:postgresql://host:port/database
  COLLECTOR_DB_USER                collect DB user
  COLLECTOR_DB_PASSWORD            collect DB password
  COLLECTOR_SOURCE_CONFIG or COLLECTOR_SOURCES_FILE
  One object store backend:
    COLLECTOR_OBJECT_STORE_DIRECTORY
    or COLLECTOR_OBJECT_STORE_S3_ENDPOINT, COLLECTOR_OBJECT_STORE_S3_BUCKET,
       COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID, COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY

Optional:
  COLLECTOR_VERIFY_REPORT_DIR      default: $env:TEMP\blariyo-collector-production-readback
  COLLECTOR_VERIFY_MAX_PAGES       default: 1
  COLLECTOR_VERIFY_MAX_ITEMS       default: 1
  COLLECTOR_VERIFY_SINCE           default: 24h
  COLLECTOR_VERIFY_INTERVAL_MS     default: 10000
  COLLECTOR_VERIFY_MANIFEST        manifest path when --manifest is omitted
'@ | Write-Output
  exit 0
}

function Require-Env($Name) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
    throw "missing required env: $Name"
  }
}

Require-Env 'COLLECTOR_DB_URL'
Require-Env 'COLLECTOR_DB_USER'
Require-Env 'COLLECTOR_DB_PASSWORD'
if ([string]::IsNullOrWhiteSpace($env:COLLECTOR_SOURCE_CONFIG) -and [string]::IsNullOrWhiteSpace($env:COLLECTOR_SOURCES_FILE)) {
  throw 'missing required env: COLLECTOR_SOURCE_CONFIG or COLLECTOR_SOURCES_FILE'
}
if ([string]::IsNullOrWhiteSpace($env:COLLECTOR_OBJECT_STORE_DIRECTORY)) {
  Require-Env 'COLLECTOR_OBJECT_STORE_S3_ENDPOINT'
  Require-Env 'COLLECTOR_OBJECT_STORE_S3_BUCKET'
  Require-Env 'COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID'
  Require-Env 'COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$reportRoot = if ($env:COLLECTOR_VERIFY_REPORT_DIR) { $env:COLLECTOR_VERIFY_REPORT_DIR } else { Join-Path $env:TEMP 'blariyo-collector-production-readback' }
New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$report = Join-Path $reportRoot "readback-$stamp.md"
$jsonl = Join-Path $reportRoot "runs-$stamp.jsonl"
$maxPages = if ($env:COLLECTOR_VERIFY_MAX_PAGES) { $env:COLLECTOR_VERIFY_MAX_PAGES } else { '1' }
$maxItems = if ($env:COLLECTOR_VERIFY_MAX_ITEMS) { $env:COLLECTOR_VERIFY_MAX_ITEMS } else { '1' }
$since = if ($env:COLLECTOR_VERIFY_SINCE) { $env:COLLECTOR_VERIFY_SINCE } else { '24h' }
$interval = if ($env:COLLECTOR_VERIFY_INTERVAL_MS) { $env:COLLECTOR_VERIFY_INTERVAL_MS } else { '10000' }
$manifest = if ($env:COLLECTOR_VERIFY_MANIFEST) { $env:COLLECTOR_VERIFY_MANIFEST } else { '' }

if ($args.Count -gt 0 -and $args[0] -eq '--manifest') {
  if ($args.Count -ne 2 -or [string]::IsNullOrWhiteSpace($args[1])) { throw 'usage: verify-write-db-readback.ps1 --manifest manifest.json' }
  $manifest = $args[1]
}

$operations = @()
if (-not [string]::IsNullOrWhiteSpace($manifest)) {
  if (-not (Test-Path $manifest)) { throw "manifest not found: $manifest" }
  $rows = Get-Content -Raw -Encoding UTF8 $manifest | ConvertFrom-Json
  foreach ($row in $rows) {
    if ($row.kind -eq 'batch') {
      $operations += [pscustomobject]@{
        kind = 'batch'; source = [string]$row.source; chart = if ($row.chart) { [string]$row.chart } else { 'hot' }
        maxPages = if ($row.maxPages) { [string]$row.maxPages } else { $maxPages }
        maxItems = if ($row.maxItems) { [string]$row.maxItems } else { $maxItems }
        since = if ($row.since) { [string]$row.since } else { $since }
        intervalMs = if ($row.intervalMs) { [string]$row.intervalMs } else { $interval }
        url = ''
      }
    } elseif ($row.kind -eq 'collect-url') {
      if (-not $row.url) { throw 'collect-url manifest row requires url' }
      $operations += [pscustomobject]@{
        kind = 'collect-url'; source = [string]$row.source; chart = ''; maxPages = ''; maxItems = ''; since = ''
        intervalMs = if ($row.intervalMs) { [string]$row.intervalMs } else { $interval }
        url = [string]$row.url
      }
    } else {
      throw 'manifest row requires kind=batch|collect-url'
    }
  }
} else {
  $sources = if ($args.Count -gt 0) { $args } else { @('theqoo', 'humoruniv', 'todayhumor') }
  foreach ($source in $sources) {
    $operations += [pscustomobject]@{ kind = 'batch'; source = [string]$source; chart = 'hot'; maxPages = $maxPages; maxItems = $maxItems; since = $since; intervalMs = $interval; url = '' }
  }
}

$jdbc = $env:COLLECTOR_DB_URL -replace '^jdbc:', ''
if (-not $jdbc.StartsWith('postgresql://')) { throw 'COLLECTOR_DB_URL must be jdbc:postgresql://...' }

@(
  '# Collector 운영 write-db readback',
  '',
  ('생성일: ' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')),
  '',
  '비밀값은 이 파일에 기록하지 않는다.',
  '',
  '| source/command | command state | run id | DB state | fetched | failures | report object |',
  '|---|---|---|---|---:|---:|---|'
) | Set-Content -Encoding UTF8 $report

$collector = Join-Path $repoRoot 'bin\blariyo-collector.ps1'
foreach ($op in $operations) {
  if ($op.kind -eq 'batch') {
    $commandLabel = "batch:$($op.chart)"
    $output = & $collector batch --source $op.source --chart $op.chart --max-pages $op.maxPages --max-items $op.maxItems --since $op.since --interval-ms $op.intervalMs --write-db | Out-String
  } else {
    $commandLabel = 'collect-url'
    $output = & $collector collect-url --source $op.source --url $op.url --interval-ms $op.intervalMs --write-db | Out-String
  }
  Add-Content -Encoding UTF8 -Path $jsonl -Value $output.Trim()
  $parsed = $output | ConvertFrom-Json
  $runId = $parsed.runId
  $state = $parsed.report.state
  if ([string]::IsNullOrWhiteSpace($runId)) {
    Add-Content -Encoding UTF8 -Path $report -Value "| $($op.source) $commandLabel | $state |  |  | 0 | 1 |  |"
    continue
  }
  $env:PGPASSWORD = $env:COLLECTOR_DB_PASSWORD
  $sql = "select state, checkpoint->>'fetched', coalesce((checkpoint->>'failures'),'0'), coalesce(report_object_key,'') from collect.batch_run where id='$runId'"
  $row = (& psql $jdbc -U $env:COLLECTOR_DB_USER -v ON_ERROR_STOP=1 -A -F "`t" -P pager=off -c $sql | Select-Object -Skip 1 -First 1)
  $cols = $row -split "`t"
  Add-Content -Encoding UTF8 -Path $report -Value "| $($op.source) $commandLabel | $state | ``$runId`` | $($cols[0]) | $($cols[1]) | $($cols[2]) | ``$($cols[3])`` |"
}

Add-Content -Encoding UTF8 -Path $report -Value ''
Add-Content -Encoding UTF8 -Path $report -Value '## DB item readback'
Add-Content -Encoding UTF8 -Path $report -Value ''
Add-Content -Encoding UTF8 -Path $report -Value '```text'
$readbackSql = "select i.source_key, i.source_post_key, i.state, left(coalesce(i.title,''),80) title, jsonb_array_length(coalesce(i.body_blocks,'[]'::jsonb)) blocks, (select count(*) from collect.batch_media m where m.item_id=i.id) media_count, i.raw_object_key from collect.batch_item i where i.run_id in (select id from collect.batch_run order by started_at desc limit 20) order by i.fetched_at desc nulls last limit 20;"
& psql $jdbc -U $env:COLLECTOR_DB_USER -v ON_ERROR_STOP=1 -P pager=off -c $readbackSql | Add-Content -Encoding UTF8 -Path $report
Add-Content -Encoding UTF8 -Path $report -Value '```'

Write-Output $report
Write-Output $jsonl
