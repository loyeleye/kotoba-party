// Builds the stage and controller pages into dist/ (the server serves them from there).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });

for (const app of ['stage', 'controller']) {
  mkdirSync(`dist/${app}`, { recursive: true });
  cpSync(`${app}/index.html`, `dist/${app}/index.html`);
  cpSync(`${app}/style.css`, `dist/${app}/style.css`);
  await build({
    entryPoints: [`${app}/src/main.ts`],
    bundle: true,
    format: 'esm',
    target: ['es2022', 'safari15'],
    sourcemap: true,
    minify: !watch,
    outfile: `dist/${app}/main.js`,
    logLevel: 'info',
  });
}
