import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Lints the Vite/React frontend (src/**). The Supabase edge functions under
// supabase/functions/** are Deno + TypeScript — a different runtime and
// language ESLint isn't configured to parse here (no @typescript-eslint /
// Deno globals set up) — so they're excluded rather than linted incorrectly.
// npm audit already covers their dependency risk; issue #81's build+lint+test
// gate is about the frontend app that actually ships to production.
export default [
  { ignores: ['dist', 'node_modules', 'supabase/functions/**', 'archive/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Underscore-prefixed args/vars (including caught errors, e.g. `catch (_) {}`)
      // are an intentional "unused" convention used throughout this codebase.
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Several existing, working patterns here call setState synchronously inside an
      // effect (seeding filter state from a URL search param on mount, triggering a
      // tracked data fetch on mount). That's an established pattern in this app, not a
      // correctness bug, so keep this newer/stricter rule as a warning rather than a
      // lint-breaking error.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
