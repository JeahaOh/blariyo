# 관련 변경 전체 파일 경로 색인

[issue 상세](README.md) · [원본 SHA·blob·상태](inventory.json)

PR·HARN branch·보조 ref·stash·현재 변경의 합집합이다. **삭제 허용 목록이 아니다.** GOV-30은 기존 제품 변경이 섞인 파일이다. 의미상 포맷 전용이라는 자동 판정은 하지 않았다.

| 경로 | 관련 issue | 근거 |
| --- | --- | --- |
| `.commitlintrc.json` | GOV-17 | PR#7, refs/stash |
| `.githooks/commit-msg` | GOV-07, GOV-09 | PR#2, PR#7 |
| `.githooks/post-commit` | GOV-07, GOV-10 | PR#2, PR#7 |
| `.githooks/pre-commit` | GOV-07, GOV-08 | PR#2, PR#7 |
| `.githooks/pre-push` | GOV-07, GOV-11 | PR#2, PR#7 |
| `.github/workflows/backup-restore.yml` | GOV-19, GOV-20, GOV-21, GOV-22, GOV-23, GOV-25, GOV-26 | PR#2, PR#7, refs/stash |
| `.github/workflows/ci.yml` | GOV-19, GOV-20, GOV-21, GOV-22, GOV-23, GOV-25, GOV-26 | PR#2, PR#7, PR#8, refs/stash |
| `.harness/policy.json` | GOV-01, GOV-02, GOV-03 | PR#1, PR#2, PR#5 |
| `.harness/tasks/HARN-06.json` | GOV-01, GOV-02, GOV-03 | PR#1, PR#2, PR#5 |
| `.harness/tasks/HARN-07.json` | GOV-01, GOV-02, GOV-03 | PR#1, PR#2, PR#5 |
| `.harness/tasks/HARN-08.json` | GOV-01, GOV-02, GOV-03 | PR#5 |
| `.harness/tasks/HARN-09.json` | GOV-01, GOV-02, GOV-03 | PR#5 |
| `.lintstagedrc` | GOV-17 | PR#7, refs/stash |
| `.markdownlint-cli2.jsonc` | GOV-13 | PR#2, PR#7 |
| `.prettierignore` | GOV-13 | PR#2, PR#7 |
| `.prettierrc` | GOV-17 | PR#2, PR#7, refs/stash |
| `.quality/baseline.candidate.json` | GOV-14 |  |
| `.quality/requirements.txt` | GOV-15 | PR#2, PR#7 |
| `.ruff.toml` | GOV-13 | PR#2, PR#7 |
| `.sqlfluff` | GOV-13 | PR#2, PR#7 |
| `.stylelintrc.json` | GOV-13 | PR#2, PR#7 |
| `AGENTS.md` | GOV-29 | PR#6, refs/stash |
| `README.md` | GOV-29 | PR#6, refs/stash |
| `apps/api/eslint.config.mjs` | GOV-13 | PR#6, refs/stash |
| `apps/api/migrations/V001__core.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V002__meme.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V003__schedule_alert.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V004__collection_assist.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V005__spring_collection.down.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V005__spring_collection.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V006__collection_content.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V007__collection_discovery.down.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V007__collection_discovery.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/migrations/V008__batch_review.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/api/src/adapters/collect-reader.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/adapters/remote-adapters.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/adapters/schedule-webhook.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/app.module.ts` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/api/src/bootstrap/collection-settings.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/bootstrap/config.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/bootstrap/database-config.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/bootstrap/startup.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/commands/command.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/commands/migrate.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/src/commands/migration-checksum-compatibility.ts` | GOV-18 | PR#6 |
| `apps/api/src/commands/migrations.module.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/src/commands/migrations.repository.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/src/commands/migrations.service.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/src/features/collection/batch-result.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/batch-review.controller.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/batch-review.module.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/batch-review.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/batch-review.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/collection-url.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/collection.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/collection/collector-quota.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/health/health.controller.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/health/health.module.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/health/health.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/health/health.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/images/collected-animation.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/images/image-validation.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/images/images.module.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/images/images.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/images/local-media.controller.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/policies/policies.module.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/policies/policies.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/policies/policies.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/policies/policy-artifact.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/posts/posts.dto.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/posts/posts.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/features/public/public.controller.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/api/src/features/public/public.dto.ts` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/api/src/main.ts` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/api/src/operations/cleanup.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/operations/operations.module.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/operations/outbox.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/operations/schedule-alerts.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/operations/schedule-alerts.service.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/batch-result.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/batch-review.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/cleanup.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/collect-ownership.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/collection-operations.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/collection.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/collector-lease.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/database.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/entities.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/health.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/idempotency.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/images.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/migrations.repository.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/src/persistence/outbox.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/policies.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/posts.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/src/persistence/schedule-alerts.repository.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/architecture.service.test.ts` | GOV-16 | PR#2, PR#7, refs/stash |
| `apps/api/test/batch-review.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collect-reader.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collected-animation.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collected-image.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collection-admin.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collection-discovery.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/collector-lease.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/database-config.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/doubles.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/failures.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/images.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/migrations.integration.test.ts` | GOV-18 | PR#6, refs/stash |
| `apps/api/test/public-http.integration.test.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/api/test/public.service.test.ts` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/api/test/r2-storage.service.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/review-regressions.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/runtime-operations.integration.test.ts` | GOV-17 | PR#6, refs/stash |
| `apps/api/test/schema-restore.integration.test.ts` | GOV-22 | PR#6, refs/stash |
| `apps/api/tsconfig.dev.json` | GOV-13 | PR#6, refs/stash |
| `apps/api/tsconfig.json` | GOV-13 | PR#6, refs/stash |
| `apps/collector/build.gradle.kts` | GOV-13, GOV-15, GOV-16, GOV-19 | PR#2, PR#7, refs/stash |
| `apps/collector/config/checkstyle/checkstyle.xml` | GOV-13 | PR#2, PR#7 |
| `apps/collector/gradle.lockfile` | GOV-17 | PR#2, PR#7, refs/stash |
| `apps/collector/ops/README.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/compose.yaml` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/discord-e2e-checklist.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reference-sites.collection-policy.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reference-sites.sources.example.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/collector-inventory-2026-09-23.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/dev-21-site-review-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/dev-readback-review-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/local-3000-review-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/local-gallery-limits-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/local-role-followup-2026-09-23.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/local-role-followup-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/media-notice-video-policy-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/reports/observed-fixtures-2026-09-23.md` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/sources.schema.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/ops/verify-write-db-readback.sh` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/main/java/com/blariyo/collector/ops/MigrationMain.java` | GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v001.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v002.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v003.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v004.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v005.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/main/resources/db/collector-v006.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `apps/collector/src/test/java/com/blariyo/collector/ops/MigrationMainTests.java` | GOV-18 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/arcalive.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/arcalive.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/bobaedream.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/bobaedream.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/dcinside.dccon.observed.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/dcinside.detail.observed.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/dogdrip.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/dogdrip.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/etoland.list.observed.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/fixture-provenance.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/inven.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/inven.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/module-baseline.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/arcalive.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/arcalive.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/arcalive.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/bobaedream.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/bobaedream.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/bobaedream.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/clien.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/clien.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/clien.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dcinside.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dcinside.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dmitory.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dmitory.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/dmitory.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dogdrip.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/dogdrip.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/dogdrip.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/etoland.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/etoland.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/etoland.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/goodgag.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/goodgag.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/goodgag.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/humoruniv.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/humoruniv.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/humoruniv.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/instiz.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/instiz.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.attachments-external.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.attachments-repeated.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.attachments-repeated.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/inven.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/mlbpark.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/mlbpark.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/mlbpark.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/natepann.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/natepann.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/natepann.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/ruliweb.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/ruliweb.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/ruliweb.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/theqoo.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/theqoo.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/theqoo.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/todayhumor.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/todayhumor.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/yuldo.detail.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/observed/yuldo.detail.html.json` | GOV-17 | PR#6, refs/stash |
| `apps/collector/src/test/resources/sites/observed/yuldo.list.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/theqoo.detail.observed.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/collector/src/test/resources/sites/todayhumor.gallery.observed.html` | GOV-17, GOV-28, GOV-32 | refs/stash |
| `apps/web/app/app.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/assets/css/admin.css` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/web/app/assets/css/main.css` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `apps/web/app/components/AdminWorkspace.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/components/CollectImagePreview.vue` | GOV-17 | PR#6, refs/stash |
| `apps/web/app/components/LinkedText.vue` | GOV-17 | PR#6, refs/stash |
| `apps/web/app/components/PostList.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/pages/[boardSlug]/index.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/pages/[boardSlug]/posts/[postId].vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/pages/admin-batch.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/pages/admin-login.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/pages/admin.vue` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/plugins/analytics.client.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/utils/consent.mjs` | GOV-17, GOV-30 | PR#4 |
| `apps/web/app/utils/text-links.mjs` | GOV-17 | PR#6, refs/stash |
| `apps/web/nuxt.config.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/api/admin/local-session.delete.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/api/admin/local-session.post.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/api/admin/session.get.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/api/v1/[...path].ts` | GOV-17 | PR#6, refs/stash |
| `apps/web/server/middleware/admin.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/plugins/production.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/server/routes/media/[...path].get.ts` | GOV-17 | PR#6, refs/stash |
| `apps/web/server/utils/local-admin.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/shared/admin-return.ts` | GOV-17, GOV-30 | PR#4 |
| `apps/web/test/collected-gallery.test.mjs` | GOV-17 | PR#6, refs/stash |
| `apps/web/test/text-links.test.mjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/README.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `deploy/application/compose.yaml` | GOV-17 | PR#6, refs/stash |
| `deploy/application/fixtures/release-compatibility.mjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/policy-release-review.md` | GOV-17 | PR#6, refs/stash |
| `deploy/application/prepare-policy-review.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/prepare-public-config.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/prepare-runtime-config.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/production-logging.yaml` | GOV-17 | PR#6, refs/stash |
| `deploy/application/publish-policies-input.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/stage-server.py` | GOV-17 | PR#6, refs/stash |
| `deploy/application/start-server.py` | GOV-17 | PR#6, refs/stash |
| `deploy/application/test-policy-review.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/application/test-runtime-config.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/backup/install-from-mac.py` | GOV-17 | PR#6, refs/stash |
| `deploy/backup/r2-transfer.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/backup/test-retention.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/gateway/compose.yaml` | GOV-17 | PR#6, refs/stash |
| `deploy/gateway/production-logging.yaml` | GOV-17 | PR#6, refs/stash |
| `deploy/operations/start-application.py` | GOV-17, GOV-30 | PR#4 |
| `deploy/postgresql/README.md` | GOV-17 | PR#6, refs/stash |
| `deploy/postgresql/apply-privileges.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `deploy/postgresql/compose.yaml` | GOV-17 | PR#6, refs/stash |
| `deploy/postgresql/create-batch-role.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `deploy/postgresql/create-roles.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `deploy/postgresql/policy-seed-input.cjs` | GOV-17 | PR#6, refs/stash |
| `deploy/postgresql/seed-policy-drafts.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `docs/README.md` | GOV-29, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/ai/README.md` | GOV-29 | PR#6, refs/stash |
| `docs/ai/git-workflow.md` | GOV-29 | PR#1, PR#2, PR#4, PR#5, PR#8, refs/stash |
| `docs/ai/governance-bootstrap.md` | GOV-17 | PR#1, PR#2 |
| `docs/ai/harness-implementation-plan.md` | GOV-29 | PR#1, PR#2, PR#4, PR#5, PR#8, PR#9, refs/stash |
| `docs/ai/skills/blariyo-plan-to-development-spec/agents/openai.yaml` | GOV-17 | PR#6, refs/stash |
| `docs/ai/skills/blariyo-plan-to-development-spec/references/canonical-routing.md` | GOV-17 | PR#6, refs/stash |
| `docs/ai/skills/blariyo-plan-to-development-spec/references/spec-quality-gates.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/development-specs/m0-core/analytics-consent/analytics-consent.dev.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/legal-contact-benchmark-research.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/open-decisions.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/operational-values-checklist.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/reference-site-copy-research.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/검수/task-07-source-specs-all-sites.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/검수/task-09-discord-page-only-collection.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/검수/task-10-m0-core-openapi-source.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/decisions/검수/task.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/implementation-backlog.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/openapi/m0-core.yaml` | GOV-17, GOV-30 | PR#4 |
| `docs/development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m1-5/community-moderation/community-moderation.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m1-5/community-participation/community-participation.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m1/account-lifecycle/account-lifecycle.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/m1/member-identity/member-identity.dev.md` | GOV-17 | PR#6, refs/stash |
| `docs/development-specs/requirements-status.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/implementation-tasks/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/legal/README.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/legal/cookie-settings.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/legal/m0-core/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/cookies.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/draft-2/privacy.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/draft-2/terms.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/privacy.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/rights.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/m0-core/terms.html` | GOV-17 | PR#6, refs/stash |
| `docs/legal/privacy-policy.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/legal/rights-request.md` | GOV-17 | PR#6, refs/stash |
| `docs/legal/signup-privacy-consent.md` | GOV-17 | PR#6, refs/stash |
| `docs/legal/terms-of-service.md` | GOV-17 | PR#6, refs/stash |
| `docs/migration/contract-evolution.json` | GOV-18, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/operations/collector-transition-observation.md` | GOV-17 | PR#6, refs/stash |
| `docs/operations/current-status.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/operations/deployment-policy.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/operations/deployment-runbook.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/operations/environment-configuration.md` | GOV-17 | PR#6, refs/stash |
| `docs/operations/infrastructure-review-brief.md` | GOV-17 | PR#6, refs/stash |
| `docs/operations/owner-setup-checklist.md` | GOV-17 | PR#6, refs/stash |
| `docs/operations/security-evidence/2026-09-20-deploy-precheck.json` | GOV-17 | PR#6, refs/stash |
| `docs/operations/security-evidence/2026-09-20-server-final.json` | GOV-17 | PR#6, refs/stash |
| `docs/operations/security-protection-status.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/planning/01-service-plan.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/02-infra-plan.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/03-screen-design.md` | GOV-17, GOV-30 | PR#4 |
| `docs/planning/04-analytics-ad-plan.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/planning/04-analytics-expansion-proposal.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/planning/05-benchmark-spec.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/06-copy-contract.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/07-color-palette.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/08-member-community-plan.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/09-random-name-catalog.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/reference-site-validation.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/source-collection-policy.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/source-spec-template.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/arcalive.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/bobaedream.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/clien.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/dcinside.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/dmitory.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/dogdrip.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/etoland.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/fmkorea.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/goodgag.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/humoruniv.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/instiz.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/inven.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/mlbpark.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/natepann.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/pgr21.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/ppomppu.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/ruliweb.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/theqoo.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/todayhumor.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/youtube-community.md` | GOV-17 | PR#6, refs/stash |
| `docs/planning/content-collection/sources/yuldo.md` | GOV-17 | PR#6, refs/stash |
| `docs/roadmap.md` | GOV-29, GOV-30 | PR#4, PR#6, PR#8, PR#9, refs/stash |
| `docs/status.md` | GOV-29, GOV-30 | PR#4, PR#6, PR#8, PR#9, refs/stash |
| `docs/system-design/01-system-architecture.md` | GOV-16, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/system-design/02-data-model.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/03-api-design.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/system-design/04-infrastructure-design.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/05-security-operations.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `docs/system-design/06-member-community-design.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/07-spring-collector-design.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/08-code-structure.md` | GOV-16 | PR#6, refs/stash |
| `docs/system-design/09-security-cost-protection-plan.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/design-readiness.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/nest-implementation-decisions.md` | GOV-17 | PR#6, refs/stash |
| `docs/system-design/validation/member-readiness-review.md` | GOV-17 | PR#6, refs/stash |
| `docs/testing/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/testing/collection-operations-cases.md` | GOV-17 | PR#6, refs/stash |
| `docs/testing/local-playwright-docker.md` | GOV-17, GOV-30 | PR#4 |
| `docs/testing/operator-acceptance.md` | GOV-17 | PR#6, refs/stash |
| `docs/testing/ui-wireframe-review-20260920.md` | GOV-17 | PR#6, refs/stash |
| `docs/ui/publishing/admin-core-review.md` | GOV-17 | PR#6, refs/stash |
| `docs/ui/publishing/responsive/README.md` | GOV-17 | PR#6, refs/stash |
| `docs/ui/publishing/responsive/app.js` | GOV-17 | PR#6, refs/stash |
| `docs/ui/publishing/responsive/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/publishing/responsive/styles.css` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/ads/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/archive/app/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/archive/desktop/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/archive/mobile/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/community/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/legal/index.html` | GOV-17 | PR#6, refs/stash |
| `docs/ui/wireframes/responsive/index.html` | GOV-17 | PR#6, refs/stash |
| `package-lock.json` | GOV-13, GOV-15, GOV-16, GOV-19 | PR#2, PR#7, refs/stash |
| `package.json` | GOV-13, GOV-15, GOV-16, GOV-19, GOV-30 | PR#2, PR#4, PR#7, refs/stash |
| `packages/contracts/eslint.config.mjs` | GOV-13 | PR#6, refs/stash |
| `packages/contracts/openapi/m0-core.yaml` | GOV-17, GOV-30 | PR#4 |
| `packages/contracts/src/api.d.ts` | GOV-17, GOV-30 | PR#4 |
| `packages/contracts/src/index.mjs` | GOV-17 | PR#6, refs/stash |
| `packages/contracts/src/schema.mjs` | GOV-17, GOV-30 | PR#4 |
| `packages/contracts/tsconfig.json` | GOV-13 | PR#6, refs/stash |
| `scripts/collector-test-support.ts` | GOV-17 | PR#6, refs/stash |
| `scripts/content/complete-originals.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/metadata-batch.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/migration-checksum.mjs` | GOV-18 | PR#6 |
| `scripts/content/migrations/001_source_capture.sql` | GOV-17, GOV-18 | PR#6, refs/stash |
| `scripts/content/record-reference-failure.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/reference-site-audit.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/reference-sites-config.test.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/replace-local-originals.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/content/scrape-originals.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/generate-contracts.ts` | GOV-17 | PR#6, refs/stash |
| `scripts/harness/branches.mjs` | GOV-01, GOV-04 | PR#2, PR#7 |
| `scripts/harness/check.mjs` | GOV-02, GOV-08, GOV-11, GOV-12 | PR#2, PR#7 |
| `scripts/harness/ci-context.mjs` | GOV-20 | PR#2, PR#7 |
| `scripts/harness/cli.mjs` | GOV-04, GOV-06 | PR#2, PR#7 |
| `scripts/harness/git.mjs` | GOV-04 | PR#2, PR#7 |
| `scripts/harness/hooks.mjs` | GOV-07, GOV-08, GOV-09, GOV-10, GOV-11 | PR#2, PR#7 |
| `scripts/harness/job-receipt.mjs` | GOV-20 | PR#2, PR#7 |
| `scripts/harness/lease_lock.py` | GOV-05 | PR#2, PR#7 |
| `scripts/harness/leases.mjs` | GOV-05 | PR#2, PR#7 |
| `scripts/harness/merge-back.mjs` | GOV-24 | PR#2, PR#7 |
| `scripts/harness/release.mjs` | GOV-05, GOV-24 | PR#2, PR#7 |
| `scripts/harness/restore-scope.mjs` | GOV-22, GOV-23 | PR#2, PR#7 |
| `scripts/harness/run-tests.mjs` | GOV-06 | PR#2, PR#7 |
| `scripts/harness/secrets.mjs` | GOV-12 | PR#2, PR#7 |
| `scripts/harness/tap.mjs` | GOV-06 | PR#2, PR#7 |
| `scripts/harness/verify.mjs` | GOV-06 | PR#2, PR#7 |
| `scripts/local/README.md` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `scripts/local/batch-review.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/collector-mime-repair.test.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/environment-config.test.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/local-identity.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/local-identity.test.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/open-admin.mjs` | GOV-17, GOV-30 | PR#4 |
| `scripts/local/playwright-tests.mjs` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `scripts/local/prepare-batch-review.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/probe-sites.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/repair-collected-labels.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/repair-collected-media.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/repair-collected-media.test.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/repair-collector-mime.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/repair-notice-posts.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/run-batch.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/start-development.mjs` | GOV-17, GOV-30 | PR#4 |
| `scripts/local/verify-batch-run.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/verify-collected-animations.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/verify-collected-content.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/verify-collector-inventory.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/verify-dry-run.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/local/verify-queue-intake.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/prepare-collector-fixtures.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/quality/eslint.config.mjs` | GOV-13 | PR#2, PR#7 |
| `scripts/quality/lint-all.mjs` | GOV-13 | PR#2, PR#7 |
| `scripts/quality/lint-contracts.mjs` | GOV-14 | PR#2, PR#7 |
| `scripts/quality/lint-debt.mjs` | GOV-14 | PR#2, PR#7 |
| `scripts/quality/setup-native-tools.mjs` | GOV-15 | PR#2, PR#7 |
| `scripts/test-collector-readback.mjs` | GOV-17 | PR#6, refs/stash |
| `scripts/test-collector-restore.mjs` | GOV-23 | PR#2, PR#7 |
| `scripts/test-database-roles.ts` | GOV-17 | PR#6, refs/stash |
| `scripts/tsconfig.json` | GOV-13 | PR#6, refs/stash |
| `tests/architecture.test.ts` | GOV-16 | PR#2, PR#7, refs/stash |
| `tests/browser/admin-recovery.test.ts` | GOV-27 | PR#6, refs/stash |
| `tests/browser/admin-workflow.test.ts` | GOV-27, GOV-30 | PR#3, PR#4 |
| `tests/browser/analytics-events.test.ts` | GOV-17, GOV-30 | PR#4 |
| `tests/browser/batch-review.test.ts` | GOV-17, GOV-30 | PR#4, PR#6, refs/stash |
| `tests/browser/consent.test.ts` | GOV-17, GOV-30 | PR#4 |
| `tests/collector-verification.test.ts` | GOV-17 | PR#6, refs/stash |
| `tests/consent.test.ts` | GOV-17, GOV-30 | PR#4 |
| `tests/harness/branches.test.mjs` | GOV-01, GOV-04 | PR#2, PR#7 |
| `tests/harness/ci-context.test.mjs` | GOV-20 | PR#2, PR#7 |
| `tests/harness/ci-workflow.test.mjs` | GOV-19, GOV-21, GOV-25 | PR#2, PR#7, PR#8 |
| `tests/harness/hooks.test.mjs` | GOV-07, GOV-08, GOV-09, GOV-10, GOV-11 | PR#2, PR#7 |
| `tests/harness/job-receipt.test.mjs` | GOV-20 | PR#2, PR#7 |
| `tests/harness/leases.test.mjs` | GOV-05 | PR#2, PR#7 |
| `tests/harness/merge-back.test.mjs` | GOV-24 | PR#2, PR#7 |
| `tests/harness/release.test.mjs` | GOV-05, GOV-24 | PR#2, PR#7 |
| `tests/harness/restore-scope.test.mjs` | GOV-22, GOV-23 | PR#2, PR#7 |
| `tests/harness/verify.test.mjs` | GOV-06 | PR#2, PR#7 |
| `tests/helpers/browser-fixture.ts` | GOV-17, GOV-30 | PR#4 |
| `tests/migration-contracts.test.ts` | GOV-18 | PR#6, refs/stash |
| `tests/quality/lint-debt.test.mjs` | GOV-14 | PR#2, PR#7 |
| `tests/quality/lint-tools.test.mjs` | GOV-15 | PR#2, PR#7 |
| `tests/tsconfig.json` | GOV-13 | PR#6, refs/stash |
| `tools/collector/README.md` | GOV-17 | PR#6, refs/stash |
| `tools/collector/collector.py` | GOV-17 | PR#6, refs/stash |
| `tools/collector/discord_bot.py` | GOV-17 | PR#6, refs/stash |
| `tools/collector/test_collector.py` | GOV-17 | PR#6, refs/stash |
| `worklog/2026-09-25/admin-ux-rework/REQUEST.md` | GOV-29, GOV-30 | PR#4 |
| `worklog/2026-09-25/admin-ux-rework/TASKS.md` | GOV-29, GOV-30 | PR#4 |
| `worklog/2026-09-25/analytics-v1/RESULTS.md` | GOV-29, GOV-30 | PR#4 |
| `worklog/2026-09-25/git-governance/BRANCH-TRANSITION-INVENTORY.md` | GOV-29 | PR#1, PR#2, PR#5 |
| `worklog/2026-09-25/git-governance/CI-RECOVERY.md` | GOV-29 | PR#5, PR#8, PR#9 |
| `worklog/2026-09-25/git-governance/DEVELOP-BOOTSTRAP-DECISION.md` | GOV-29 | PR#1, PR#2, PR#5 |
| `worklog/2026-09-25/git-governance/LINT-CANDIDATE-REVIEW.md` | GOV-29 | PR#1, PR#2, PR#5 |
| `worklog/2026-09-25/git-governance/PR-RECOVERY.md` | GOV-29 | PR#2 |
| `worklog/2026-09-25/git-governance/README.md` | GOV-29 |  |
| `worklog/2026-09-25/git-governance/REQUEST.md` | GOV-29 | PR#1, PR#2, PR#5 |
| `worklog/2026-09-25/git-governance/RESULT.md` | GOV-29 | PR#1, PR#2, PR#5 |
| `worklog/2026-09-25/git-governance/STASH-RECOVERY.md` | GOV-29 | PR#5, PR#8 |
| `worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md` | GOV-29, GOV-30 | PR#4 |
| `worklog/2026-09-25/hot-collection/RESULTS.md` | GOV-29, GOV-30 | PR#4 |
| `worklog/README.md` | GOV-29 | PR#6, refs/stash |
