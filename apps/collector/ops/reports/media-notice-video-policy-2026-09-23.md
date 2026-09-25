# Media, video link, notice-filter verification — 2026-09-23

Scope: verify the collector changes for image extraction, mp4/audio handling, and notice-row filtering.

## Code changes verified

- `OrderedContentParser` extracts article images from `src`, lazy-load data attributes, `srcset`/`data-srcset`, and CSS `background-image` after source image policy validation.
- `mp4`, `mov`, `mp3`, and `wav` are not attachment download candidates. They remain ordered `LINK` blocks.
- Hot/Top list discovery skips structural notice rows using class/id/badge/title-prefix markers while preserving ordinary posts.

## Test evidence

- `./gradlew --no-watch-fs --max-workers=1 test` — passed.
- `./gradlew --no-watch-fs --max-workers=1 bootJar` — passed.
- `git diff --check` — passed.

## Live write-db sample after parser change

Environment:

- DB: local PostgreSQL container `blariyo-m0-core-local-postgresql-1`, database `blariyo_local`.
- Object store: local directory `/tmp/blariyo-collector-objects`.
- JDK: `/opt/homebrew/opt/openjdk@25`.

Before:

| metric                     |     value |
| -------------------------- | --------: |
| `collect.batch_media` rows |        41 |
| bytes                      | 2,664,402 |

After four hot-list write-db runs:

| metric                     |      value |
| -------------------------- | ---------: |
| `collect.batch_media` rows |         56 |
| bytes                      | 10,716,756 |
| delta rows                 |        +15 |
| delta bytes                | +8,052,354 |

Run results:

| source     | run ID                                 | state     | discovered | fetched |           failures |
| ---------- | -------------------------------------- | --------- | ---------: | ------: | -----------------: |
| arcalive   | `74956ebf-c994-4275-9306-223fa206693d` | COMPLETED |          2 |       2 |                  0 |
| bobaedream | `a4f51c16-c8e9-4dc7-b402-23fb76c2c603` | COMPLETED |          2 |       2 |                  0 |
| dogdrip    | `3430989c-fd3b-4ffe-a33c-b79a984c8db0` | COMPLETED |          2 |       2 |                  0 |
| inven      | `52e81bc7-6f87-4651-89a5-f7cb8fcf1d1c` | PARTIAL   |          2 |       1 | 1 (`PARSE_FAILED`) |

Fetched item/media readback:

| source     | fetched items in run | media rows in run | MIME examples |
| ---------- | -------------------: | ----------------: | ------------- |
| arcalive   |                    2 |                 5 | image/webp    |
| bobaedream |                    2 |                 4 | image/jpeg    |
| dogdrip    |                    2 |                 5 | image/webp    |
| inven      |                    1 |                 1 | image/png     |

Object readback directory contained 26 files for the sampled runs:

- 4 report JSONL files
- 7 raw HTML files
- 15 media files

## CLI interval check

`--interval-ms 1000` is rejected by design because the current minimum interval is 10,000ms. `--interval-ms 10000` was verified with dry-run:

```text
./bin/blariyo-collector batch --source arcalive --chart hot --max-pages 1 --max-items 1 --since 720h --interval-ms 10000 --dry-run
```

Result: `COMPLETED`, `discovered=1`, `fetched=1`.

## Remaining limits

- This is a 4-source live sample, not a fresh 21-source full verification.
- `inven` still has one sampled hot item failing `PARSE_FAILED`; it needs fixture capture and selector inspection.
- mp4/audio binary preservation remains intentionally deferred. Current behavior is ordered link preservation only.
