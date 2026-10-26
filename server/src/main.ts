import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Prompt } from '../../shared/src/protocol.js';
import { createKotobaServer } from './server.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pack = JSON.parse(readFileSync(`${root}content/debug/prompts.json`, 'utf8')) as { prompts: Prompt[] };

const server = createKotobaServer({
  prompts: pack.prompts,
  staticDir: `${root}dist`,
  publicUrl: process.env.PUBLIC_URL,
});

const port = Number(process.env.PORT ?? 3000);
const url = await server.listen(port, process.env.HOST ?? '0.0.0.0');
console.log(`Kotoba Party server on ${url}`);
console.log(`  stage:      ${url}/stage`);
console.log(`  controller: ${url}/`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
