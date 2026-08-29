import tsParser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist/**', 'demo/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
]
