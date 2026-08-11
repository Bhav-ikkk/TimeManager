// Flat ESLint config. Next.js 16 removed the `next lint` command, so the
// `lint` script now invokes the ESLint CLI directly with the same preset.
import { defineConfig, globalIgnores } from 'eslint/config';
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'public/**']),
  ...coreWebVitals,
]);
