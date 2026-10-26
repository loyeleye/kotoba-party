// Builds the stage and controller pages into dist/ (the server serves them from there).
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });

for (const app of ['stage', 'controller']) {
  mkdirSync(`dist/${app}`, { recursive: true });
  cpSync(`${app}/index.html`, `dist/${app}/index.html`);
  // One stylesheet: the shell's, then each mode's own (src/modes/*.css).
  const modeFiles = existsSync(`${app}/src/modes`) ? readdirSync(`${app}/src/modes`).filter((f) => f.endsWith('.css')).sort() : [];
  const modeCss = modeFiles.map((f) => readFileSync(`${app}/src/modes/${f}`, 'utf8'));
  checkClashes(app, readFileSync(`${app}/style.css`, 'utf8'), modeFiles, modeCss);
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

/**
 * Mode sheets share one stylesheet, so two modes that style the same top-level class or name the
 * same @keyframes overwrite each other (Omiai and Onsen both used .om-). Fails the build if so.
 * Classes only used inside another selector (.oek .ink-svg) or from the shell's sheet don't count.
 */
function checkClashes(app: string, shell: string, files: string[], sheets: string[]): void {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '');
  const classes = (css: string) => [...css.replace(/\{[^{}]*\}/g, '{}').matchAll(/(?:^|[,{}])\s*\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => `.${m[1]}`);
  const shared = new Set(classes(strip(shell)));
  const owner = new Map<string, string>();
  const clashes: string[] = [];
  files.forEach((file, i) => {
    const css = strip(sheets[i]!);
    const names = new Set([...classes(css).filter((c) => !shared.has(c)), ...[...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => `@keyframes ${m[1]}`)]);
    for (const name of names) {
      const first = owner.get(name);
      if (first) clashes.push(`${name} (${first} and ${file})`);
      else owner.set(name, file);
    }
  });
  if (clashes.length) throw new Error(`${app}: mode stylesheets clash, give each mode its own prefix:\n  ${clashes.join('\n  ')}`);
}
