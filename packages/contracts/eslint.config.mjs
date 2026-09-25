import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommendedTypeChecked, {
  files: ['src/*.mjs'],
  languageOptions: {
    parserOptions: { project: ['./tsconfig.json'], tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
  },
});
