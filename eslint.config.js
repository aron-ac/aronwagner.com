import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['assets/vendor/**', 'output/**', 'dist/**', 'test-results/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['tools/**', 'tests/**', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        surfDebug: 'readonly',
        bayDebug: 'readonly',
        ciciDebug: 'readonly',
        setTestClock: 'readonly',
        themeLoadProbe: 'readonly',
      },
    },
  },
];
