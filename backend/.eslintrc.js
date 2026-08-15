module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  rules: {
    // 风格
    'no-console': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    eqeqeq: ['warn', 'always', { null: 'ignore' }],

    // 可能的错误
    'no-var': 'error',
    'no-eval': 'error',
    'no-template-curly-in-string': 'error',
    'no-unsafe-optional-chaining': 'error',

    // 宽松项（避免大量重构）
    'no-case-declarations': 'off',
    'no-empty': 'off',
    'no-prototype-builtins': 'off',
  },
  ignorePatterns: ['node_modules/', 'logs/', 'dist/', '*.min.js'],
};
