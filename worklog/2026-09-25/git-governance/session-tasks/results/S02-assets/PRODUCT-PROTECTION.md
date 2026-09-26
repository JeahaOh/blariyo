# 제품 보호 경로 70개

- 기준: 기존 base `8af7244` → 제품 보존본 `e51f1b5`; 현재 후보는 PR #4 `df74827` + 별도 browser selector patch.
- 전체 blob/SHA-256·commit·중첩 issue·경로별 diff SHA-256은 [product-paths.json](product-paths.json).
- 이 표는 삭제 금지 및 의미 변경 검토 경계다. 필요한 포맷 수정은 제품 변경을 유지하고 같은 hunk를 조정한 뒤 가능하다.

| 경로 | 기존 base blob | 제품 blob | PR #4 blob | delivery blob | 보존할 변경 / 인계 |
| --- | --- | --- | --- | --- | --- |
| `apps/api/src/app.module.ts` | `ffc2b95bc60a` | `1a28d75fcd84` | `1a28d75fcd84` | `c0ebbbe9a26b` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/api/src/features/public/public.controller.ts` | `24b8f35e4de2` | `425b92bdb410` | `425b92bdb410` | `425b92bdb410` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/api/src/features/public/public.dto.ts` | `b187f55eca84` | `486e6c7ae5b2` | `486e6c7ae5b2` | `19080c12d397` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/api/src/main.ts` | `1219599da85f` | `197f9abb023f` | `197f9abb023f` | `a196a0247bbe` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/api/test/public-http.integration.test.ts` | `11084855e0ab` | `37f1b9fd6197` | `37f1b9fd6197` | `37f1b9fd6197` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/api/test/public.service.test.ts` | `91621aa30995` | `35f38dea59d4` | `35f38dea59d4` | `275b342f44bc` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/app.vue` | `c7cfb86001ce` | `c0d9df0d7589` | `c0d9df0d7589` | `c0d9df0d7589` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/assets/css/admin.css` | `없음` | `c8f548db372c` | `c8f548db372c` | `dde92bd68d24` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/assets/css/main.css` | `978dd22345e3` | `53f577538164` | `53f577538164` | `b2433d49786d` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/components/AdminWorkspace.vue` | `없음` | `4bc935815bb4` | `4bc935815bb4` | `4bc935815bb4` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/components/PostList.vue` | `27f6fb8c72d6` | `6ec973e7649f` | `6ec973e7649f` | `6ec973e7649f` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/pages/[boardSlug]/index.vue` | `d1b07ee5e3a0` | `f4fa8b55a632` | `f4fa8b55a632` | `f4fa8b55a632` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/pages/[boardSlug]/posts/[postId].vue` | `540834fa0de4` | `371ceeb6ebe6` | `371ceeb6ebe6` | `371ceeb6ebe6` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/pages/admin-batch.vue` | `b1066ae1c42f` | `a066747a056f` | `a066747a056f` | `a066747a056f` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/pages/admin-login.vue` | `없음` | `30b27df24433` | `30b27df24433` | `30b27df24433` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/pages/admin.vue` | `d1463eaeb2d5` | `4aa4bf1620d4` | `4aa4bf1620d4` | `4aa4bf1620d4` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/app/plugins/analytics.client.ts` | `12f19ee502a1` | `8e315fa24236` | `8e315fa24236` | `8e315fa24236` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/app/utils/consent.mjs` | `9751ec7512e6` | `3adea7569693` | `3adea7569693` | `3adea7569693` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `apps/web/nuxt.config.ts` | `b2e749eae678` | `b38d5a59ef61` | `b38d5a59ef61` | `b38d5a59ef61` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/api/admin/local-session.delete.ts` | `없음` | `a82d6a709b5a` | `a82d6a709b5a` | `a82d6a709b5a` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/api/admin/local-session.post.ts` | `없음` | `771f808d70bd` | `771f808d70bd` | `771f808d70bd` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/api/admin/session.get.ts` | `없음` | `2aac9f362520` | `2aac9f362520` | `2aac9f362520` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/middleware/admin.ts` | `465e6457e8b8` | `569c62bc2e8a` | `569c62bc2e8a` | `569c62bc2e8a` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/plugins/production.ts` | `3d31947f8378` | `b3372b6a516c` | `b3372b6a516c` | `b3372b6a516c` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/server/utils/local-admin.ts` | `없음` | `002b61c89f7b` | `002b61c89f7b` | `002b61c89f7b` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `apps/web/shared/admin-return.ts` | `없음` | `1d543e42c201` | `1d543e42c201` | `1d543e42c201` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `deploy/application/README.md` | `529f8c460a50` | `e7be0e1f89c0` | `e7be0e1f89c0` | `a21c4a395ee4` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S02/S06 |
| `deploy/operations/start-application.py` | `d71e83cd067f` | `787bae38a4aa` | `787bae38a4aa` | `787bae38a4aa` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S02/S06 |
| `docs/README.md` | `a266d8cc7806` | `2f29fab929cd` | `2f29fab929cd` | `7687fc105d3c` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md` | `9ba3ee3c689e` | `5fd57f0d4b48` | `5fd57f0d4b48` | `12f693a6e029` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S11 |
| `docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md` | `e37345e56def` | `ab066b12da8e` | `ab066b12da8e` | `90d53e4da7d8` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S11 |
| `docs/development-specs/m0-core/analytics-consent/analytics-consent.dev.md` | `34a417a41fa3` | `15df0ca570ff` | `15df0ca570ff` | `aa6217f746f0` | GA4 동의·이벤트 구현/계약 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/development-specs/m0-core/openapi/m0-core.yaml` | `32ff949e74cd` | `bb8add9e6db4` | `bb8add9e6db4` | `bb8add9e6db4` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/development-specs/requirements-status.md` | `d6320c8d732b` | `7c0a84d95e92` | `7c0a84d95e92` | `2463d644c073` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/legal/README.md` | `eef023676095` | `b4e6f108184d` | `b4e6f108184d` | `139ebfebd611` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/legal/cookie-settings.md` | `00d5e6c840c0` | `34b7ebaf0577` | `34b7ebaf0577` | `4f0d8b88f433` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/legal/privacy-policy.md` | `f647dcee1fc1` | `53aaf4fb55ac` | `53aaf4fb55ac` | `5efc0005d30a` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/migration/contract-evolution.json` | `7731560dba70` | `bfe48bf3ca34` | `bfe48bf3ca34` | `15b2e5c9247c` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/operations/current-status.md` | `54e258805fb8` | `b8ca8fa190d3` | `b8ca8fa190d3` | `da1638b0e3d4` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/operations/deployment-policy.md` | `8f247581004d` | `753c8ab35719` | `753c8ab35719` | `de9e6d2d3dbe` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/operations/deployment-runbook.md` | `8386dafc9f1f` | `cbc25f20e3c2` | `cbc25f20e3c2` | `b83e49caaa65` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/operations/security-protection-status.md` | `1919bbb0d00e` | `5cedda5e1657` | `5cedda5e1657` | `cf680daa7231` | 기존 제품 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/planning/03-screen-design.md` | `cce7f7a87c2f` | `b5a30366467f` | `b5a30366467f` | `b5a30366467f` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S11 |
| `docs/planning/04-analytics-ad-plan.md` | `6c133cd14df6` | `862017d91e03` | `862017d91e03` | `33bd47c6a774` | GA4 동의·이벤트 구현/계약 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/planning/04-analytics-expansion-proposal.md` | `없음` | `5e23dde1e925` | `5e23dde1e925` | `1f9a5c97e9bf` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/roadmap.md` | `b960a7fa4abb` | `1fe2f106f6b3` | `1fe2f106f6b3` | `fabfee18ce9a` | GA4 동의·이벤트 구현/계약 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/status.md` | `c17590c0a517` | `1a1548516d7d` | `1a1548516d7d` | `65ccc2a80c35` | GA4 동의·이벤트 구현/계약 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/system-design/01-system-architecture.md` | `dc531ed776b6` | `44ccd11d3a4e` | `44ccd11d3a4e` | `2c7f72a4c25b` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/system-design/03-api-design.md` | `f05ff89af8e2` | `b5a521f98d50` | `b5a521f98d50` | `e09e4ed5d072` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `docs/system-design/05-security-operations.md` | `46b2027a4b22` | `1aa8c3bf2fb5` | `1aa8c3bf2fb5` | `5097db3800ba` | GA4 동의·이벤트 구현/계약 보존; 관리자 접근·수집 검토 UX 변경 보존; GTM 배포 관련 변경/당시 증거 보존 / S11 |
| `docs/testing/local-playwright-docker.md` | `없음` | `c559acfbde1d` | `c559acfbde1d` | `c559acfbde1d` | GA4 동의·이벤트 구현/계약 보존 / S11 |
| `package.json` | `d1436449d4e8` | `cad98480581b` | `cad98480581b` | `04748489803d` | GA4 동의·이벤트 구현/계약 보존 / S10 |
| `packages/contracts/openapi/m0-core.yaml` | `32ff949e74cd` | `bb8add9e6db4` | `bb8add9e6db4` | `bb8add9e6db4` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `packages/contracts/src/api.d.ts` | `b4bf0263ad46` | `e204244e95e8` | `e204244e95e8` | `e204244e95e8` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `packages/contracts/src/schema.mjs` | `578ed59894fa` | `a392c9e27de1` | `a392c9e27de1` | `a392c9e27de1` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `scripts/local/README.md` | `390a55645303` | `e10c2267d309` | `e10c2267d309` | `abaac9b137f2` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `scripts/local/open-admin.mjs` | `4462e029fca8` | `1f811f2a18bd` | `1f811f2a18bd` | `1f811f2a18bd` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `scripts/local/playwright-tests.mjs` | `없음` | `9cdb5231d2aa` | `9cdb5231d2aa` | `50f43e0e62e3` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `scripts/local/start-development.mjs` | `62e15025e67f` | `3fc7c913af39` | `3fc7c913af39` | `3fc7c913af39` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `tests/browser/admin-workflow.test.ts` | `292ff0728595` | `d184d6b2b552` | `ea67a149da0b` | `ea67a149da0b` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `tests/browser/analytics-events.test.ts` | `없음` | `0c665c9e5318` | `0c665c9e5318` | `0c665c9e5318` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `tests/browser/batch-review.test.ts` | `936333a8dc94` | `ebd6085543cc` | `ebd6085543cc` | `3fe4b7e993e6` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `tests/browser/consent.test.ts` | `439384957004` | `0c0ec5b6ee33` | `0c0ec5b6ee33` | `0c0ec5b6ee33` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `tests/consent.test.ts` | `818511871b16` | `1adeac1b8cc2` | `1adeac1b8cc2` | `1adeac1b8cc2` | GA4 동의·이벤트 구현/계약 보존 / S02/S06 |
| `tests/helpers/browser-fixture.ts` | `ef4ff12ff20f` | `3ae0dca6a427` | `3ae0dca6a427` | `3ae0dca6a427` | 기존 제품 변경 보존; 관리자 접근·수집 검토 UX 변경 보존 / S02/S06 |
| `worklog/2026-09-25/admin-ux-rework/REQUEST.md` | `없음` | `b64bfedb7b43` | `b64bfedb7b43` | `b64bfedb7b43` | 과거 제품 요청·구현·검증 기록 보존; 현재 운영 완료로 승계하지 않음 / S02/S06 |
| `worklog/2026-09-25/admin-ux-rework/TASKS.md` | `없음` | `01fbc34a06cd` | `01fbc34a06cd` | `01fbc34a06cd` | 과거 제품 요청·구현·검증 기록 보존; 현재 운영 완료로 승계하지 않음 / S02/S06 |
| `worklog/2026-09-25/analytics-v1/RESULTS.md` | `없음` | `f3777be8eb41` | `f3777be8eb41` | `f3777be8eb41` | 과거 제품 요청·구현·검증 기록 보존; 현재 운영 완료로 승계하지 않음 / S02/S06 |
| `worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md` | `없음` | `2b3fd4acdfc8` | `2b3fd4acdfc8` | `2b3fd4acdfc8` | 과거 제품 요청·구현·검증 기록 보존; 현재 운영 완료로 승계하지 않음 / S02/S06 |
| `worklog/2026-09-25/hot-collection/RESULTS.md` | `없음` | `07ddc05d1ff6` | `07ddc05d1ff6` | `07ddc05d1ff6` | 과거 제품 요청·구현·검증 기록 보존; 현재 운영 완료로 승계하지 않음 / S02/S06 |
