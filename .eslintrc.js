module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // 필요에 따라 커스터마이징 가능
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
};
