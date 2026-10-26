// Command-line tools for the host voices. Needs a VOICEVOX engine (VOICEVOX_URL, default http://127.0.0.1:50021):
//
//   npx tsx server/ai/tools/voice.ts check                         are all three hosts' voices installed?
//   npx tsx server/ai/tools/voice.ts say pon 'いっぽん！' out.wav     voice one line
//   npx tsx server/ai/tools/voice.ts render <bank.ts> <out dir>    pre-render a line bank: <id>.wav + manifest.json
//   npx tsx server/ai/tools/voice.ts demo <out dir>                a short sample of each host, through the full
//                                                                  pipeline (Claude if ANTHROPIC_API_KEY is set)

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOSTS } from '../hosts.js';
import { createHostVoice } from '../hostVoice.js';
import { llmFromEnv, ScriptedLlm } from '../llm.js';
import { VoicevoxTts } from '../tts.js';
import type { BankLine, HostId } from '../types.js';

const [cmd, ...args] = process.argv.slice(2);
const tts = new VoicevoxTts();
const isHost = (h: string | undefined): h is HostId => !!h && h in HOSTS;

async function main(): Promise<void> {
  const ok = await tts.check();
  if (!ok.ok) throw new Error(`VOICEVOX not ready: ${ok.why}`);
  if (cmd === 'check') {
    for (const h of Object.keys(HOSTS) as HostId[]) console.log(`${h}: style ${await tts.styleId(h)} (${HOSTS[h].credit})`);
    return;
  }
  if (cmd === 'say') {
    const [host, kana, out = 'line.wav'] = args;
    if (!isHost(host) || !kana) throw new Error('usage: say <pon|chochin|fude> <kana> [out.wav]');
    await writeFile(out, (await tts.speak({ host, kana })).bytes);
    console.log(out);
    return;
  }
  if (cmd === 'render') {
    const [bank, dir] = args;
    if (!bank || !dir) throw new Error('usage: render <module exporting hostLines> <out dir>');
    const mod = (await import(pathToFileURL(resolve(bank)).href)) as { hostLines?: BankLine[]; default?: BankLine[] };
    const lines = mod.hostLines ?? mod.default ?? [];
    await mkdir(dir, { recursive: true });
    const manifest: Record<string, { file: string; ms?: number; kana: string }> = {};
    for (const l of lines) {
      if (l.slots?.length) continue; // voiced at runtime, with the player's name
      const a = await tts.speak({ host: l.host, kana: l.jp.kana, tier: l.tier });
      const file = `${l.id}.wav`;
      await writeFile(join(dir, file), a.bytes);
      manifest[l.id] = { file, ms: a.ms, kana: l.jp.kana };
    }
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`${Object.keys(manifest).length} lines → ${dir}`);
    return;
  }
  if (cmd === 'demo') {
    const [dir = 'voice-demo'] = args;
    await mkdir(dir, { recursive: true });
    const scripted = new ScriptedLlm(() => ({ text: 'ねこが ぎんこういん？ ぽんぽこ！', kana: 'ねこが ぎんこういん？ ぽんぽこ！', en: 'A cat bank clerk? Ponpoko!' }));
    const llm = llmFromEnv() ?? scripted;
    const voice = createHostVoice({ llm, tts });
    const samples: { host: HostId; say: string; en: string }[] = [
      { host: 'pon', say: 'さあ、こんやも はじまるよ！おおぎり ナイト！', en: "Here we go again! It's Oogiri Night!" },
      { host: 'pon', say: 'いっぽん！ざぶとん いちまい！', en: 'IPPON! One cushion!' },
      { host: 'chochin', say: 'まもなく、しゅうでんが しゅっぱつ いたします…', en: 'The last train will soon depart...' },
      { host: 'chochin', say: 'つぎは、コンビニまえ。コンビニまえ。', en: 'Next stop: in front of the konbini.' },
      { host: 'fude', say: 'きたきた！「あ」の ようかいだ！', en: 'Here it comes! The あ yōkai!' },
      { host: 'fude', say: 'コンボ！みっつめ！いけいけ！', en: 'Combo! Three! Go go go!' },
    ];
    const index: string[] = [];
    for (const [i, s] of samples.entries()) {
      const file = `${String(i + 1).padStart(2, '0')}-${s.host}.wav`;
      await writeFile(join(dir, file), (await tts.speak({ host: s.host, kana: s.say })).bytes);
      index.push(`${file}\t${HOSTS[s.host].name}\t${s.say}\t${s.en}`);
    }
    // One line through the whole pipeline: answer → host LLM → kana check → TTS.
    const line = await voice.prepare('DEMO', { host: 'pon', event: 'reveal_react', answer: 'ねこの ひみつの しごとは ぎんこういん です。' }).ready(15000);
    if (line?.audio) {
      await writeFile(join(dir, '07-pon-pipeline.wav'), voice.audio(line.audio.id)!.bytes);
      index.push(`07-pon-pipeline.wav\tPon (${line.source === 'llm' && llm !== scripted ? 'Claude' : line.source === 'llm' ? 'scripted LLM stand-in' : 'bank'})\t${line.kana}\t${line.en}`);
    }
    await writeFile(join(dir, 'index.tsv'), index.join('\n') + '\n');
    console.log(index.join('\n'));
    return;
  }
  throw new Error('commands: check | say | render | demo');
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
