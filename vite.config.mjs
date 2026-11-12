// Vite build for the admin site (replaced Create React App, TD12).
//
// The source keeps Create React App's conventions, so no app code changed:
// - process.env.REACT_APP_* (and NODE_ENV, PUBLIC_URL) are replaced at build
//   time, exactly like CRA. Only REACT_APP_* variables are published, and
//   scripts/env-guard.cjs refuses to build if one of them holds a secret.
// - JSX in .js files, as CRA allowed.
// - Output goes to build/, which Netlify publishes and scripts/prerender.js reads.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findPublishedSecrets } = require('./scripts/env-guard.cjs');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const problems = findPublishedSecrets(env);
  if (problems.length) {
    throw new Error(`Refusing to build: these REACT_APP_ variables would be published to every browser:\n  ${problems.join('\n  ')}`);
  }
  const nodeEnv = mode === 'production' ? 'production' : 'development';
  const processEnv = { ...env, NODE_ENV: nodeEnv, PUBLIC_URL: '' };

  return {
    plugins: [react({ include: /\.(js|jsx)$/ })],
    define: {
      'process.env': JSON.stringify(processEnv),
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
    optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
    build: { outDir: 'build', emptyOutDir: true, sourcemap: false },
    server: { port: 3000 },
    preview: { port: 3000 },
  };
});
