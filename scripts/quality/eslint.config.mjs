import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: js.configs.recommended.rules,
  },
];
