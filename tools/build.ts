// Builds the stage and controller pages into dist/ (the server serves them from there).
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });

for (const app of ['stage', 'controller']) {
  mkdirSync(`dist/${app}`, { recursive: true });
  cpSync(`${app}/index.html`, `dist/${app}/index.html`);
  // One stylesheet: the shell's, then each mode's own (src/modes/*.css).
  const modeCss = existsSync(`${app}/src/modes`)
    ? readdirSync(`${app}/src/modes`).filter((f) => f.endsWith('.css')).sort().map((f) => readFileSync(`${app}/src/modes/${f}`, 'utf8'))
    : [];
  writeFileSync(`dist/${app}/style.css`, [readFileSync(`${app}/style.css`, 'utf8'), ...modeCss].join('\n'));
  if (existsSync(`${app}/assets`)) cpSync(`${app}/assets`, `dist/${app}/assets`, { recursive: true });
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
