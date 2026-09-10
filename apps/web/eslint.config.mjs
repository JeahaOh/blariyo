import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

const parserOptions = {
  project: [
    './.nuxt/tsconfig.app.json',
    './.nuxt/tsconfig.server.json',
    './.nuxt/tsconfig.node.json',
    './.nuxt/tsconfig.shared.json',
  ],
  tsconfigRootDir: import.meta.dirname,
  extraFileExtensions: ['.vue'],
};
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/base'],
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.vue'],
    languageOptions: { parser: tseslint.parser, parserOptions },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { ...parserOptions, parser: tseslint.parser },
    },
  }
);
