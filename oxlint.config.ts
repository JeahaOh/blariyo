import { defineConfig } from 'oxlint';

// Additive checks only. The existing typed ESLint command remains mandatory.
export default defineConfig({
  categories: { correctness: 'off' },
  plugins: ['oxc'],
  jsPlugins: [{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' }],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/dist-test/**', '**/.nuxt/**', '**/.output/**'],
  rules: {
    'oxc/no-accumulating-spread': 'error',
    'anti-slop/no-reduce-accumulator-copy': 'error',
  },
});
