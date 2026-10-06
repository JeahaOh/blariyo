# Selected Anti Slop rule

- Source: https://github.com/dmmulroy/anti-slop/tree/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b
- License: MIT, preserved in `LICENSE`.
- Unmodified upstream files: `rules/no-reduce-accumulator-copy.ts`, `shared/array-method.ts`.
- Local file: `index.ts` registers only the evaluated rule. Oxlint and `@oxlint/plugins` are both pinned to `1.78.0`.
- Maintainer: Blariyo developer responsible for quality tooling. Changes require source/test review and renewed paired fixtures; no automatic upstream replacement.
- Evidence: [evaluation](../../../worklog/2026-10-06/ai-quality-adoption/verification/external-evaluation.json).
- `oxc/no-accumulating-spread` complements this rule. Type assertions remain covered by the existing typed ESLint rules. No unknown/typeof ban or formatting rules are imported.
- Scope: JS/TS and Vue script blocks in application/contracts/scripts/tests. This is not Java, Vue-template or security analysis. Copying a bounded accumulator may be intentional; review ownership/size before changing it. No automatic rewrite is enabled.
