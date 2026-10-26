import { fileURLToPath } from 'node:url';
import { loadContent } from './content.js';
import { bankVoice, hostDirector } from './host.js';
import { createReader } from './reading.js';
import { createKotobaServer } from './server.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

const content = loadContent(root);
const server = createKotobaServer({
  content,
  onCues: hostDirector(bankVoice(content)),
  reader: await createReader(),
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
