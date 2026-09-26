import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommendedTypeChecked, {
  files: ['src/**/*.ts', 'test/**/*.ts', 'dev.ts', 'build.ts'],
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json', './tsconfig.test.json', './tsconfig.dev.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/require-await': 'off',
  },
});
