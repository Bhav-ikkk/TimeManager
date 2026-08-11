// Flat ESLint config. Next.js 16 removed the `next lint` command, so the
// `lint` script now invokes the ESLint CLI directly with the same preset.
import { defineConfig, globalIgnores } from 'eslint/config';
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'public/**']),
  ...coreWebVitals,
  {
    rules: {
      // react-hooks v7 flags the long-standing "hydrate dialog state from
      // props in an effect" pattern used across this codebase. It is a
      // performance recommendation, not a correctness bug — kept as a
      // warning so new code sees it without failing CI. Refactoring the
      // existing components is tracked separately.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
