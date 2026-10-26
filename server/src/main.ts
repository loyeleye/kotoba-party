import { fileURLToPath } from 'node:url';
import { loadContent } from './content.js';
import { HOST_EVENTS, SilentTts, VoicevoxTts, createHostVoice, llmFromEnv, type BankLine } from '../ai/index.js';
import { aiVoice, bankVoice, hostDirector } from './host.js';
import { createReader } from './reading.js';
import { createKotobaServer } from './server.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

const content = loadContent(root);

// The host: LLM lines when ANTHROPIC_API_KEY is set, VOICEVOX audio when VOICEVOX_URL is set,
// and the written line bank otherwise (see server/ai/README.md).
const ai = createHostVoice({
  llm: llmFromEnv(),
  tts: process.env.VOICEVOX_URL ? new VoicevoxTts() : new SilentTts(),
  // The pipeline voices the events it knows; lines for the rest go through the plain bank voice.
  lines: content.hostLines.filter((l): l is typeof l & BankLine => (HOST_EVENTS as readonly string[]).includes(l.event)),
});
if (process.env.VOICEVOX_URL) void ai.warmUp().then((r) => console.log(`host voices: ${r.rendered} lines rendered, ${r.failed} failed`));

const server = createKotobaServer({
  content,
  onCues: hostDirector(aiVoice(ai, bankVoice(content))),
  onPhase: (room) => room.state.phase === 'intro' && ai.newGame(room.code),
  onRoomClosed: (room) => ai.closeRoom(room.code),
  audio: (id) => ai.audio(id),
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
