// Oekaki in the Green Car (docs/modes/oekaki.md, "Green Car"): you draw an N4/N3 sentence, not a word. Each
// sentence is two chunks, who (おとうとが, パパは, えんそくの 日に) and what happened (the chunk that carries the
// frame: ねて いる ふりを した, でんきを つけっぱなしで ねた, おばけを 見た ことが ある), so fake titles can be built
// from chunk tiles and still say a whole sentence. Frames: ＿た ことが ある and ＿て しまった (4.3), the passive
// (4.13), the suffering passive and ＿させられる (3.2), ＿ようと した and ＿ずに (3.6), with ＿ふりを した, ＿っぱなし
// and ＿まま as optional N3 frames. Kids, Family and Cheeky pools (about 40/40/20); every frame is in every pool.
// All draft: they need the fluent check and, for Kids and Cheeky, the taste check.

import type { Audience } from '../../protocol.js';
import { FRAME_BY_ID, type FrameId } from '../../japanese/frames.js';
import { normalizeReading } from '../../japanese/kana.js';
import type { Prompt, Tile } from './prompts.js';

export interface Chunk {
  text: string;
  kana: string;
  en: string;
}

export interface Sentence {
  id: string;
  level: 'n4' | 'n3';
  /** Who it happened to (or when): the subject chunk, with its particle. */
  who: Chunk;
  /** What happened: the chunk that carries the frame. */
  did: Chunk;
  en: string;
  frames: FrameId[];
  audiences: readonly Audience[];
  status: 'draft';
}

const ALL: readonly Audience[] = ['kids', 'family', 'cheeky'];
const KF: readonly Audience[] = ['kids', 'family'];
const FC: readonly Audience[] = ['family', 'cheeky'];
const C: readonly Audience[] = ['cheeky'];

/** A chunk: kana only, or text with kanji plus its kana. */
const c = (text: string, en: string, kana = text): Chunk => ({ text, kana, en });

const s = (id: string, level: 'n4' | 'n3', frames: FrameId[], audiences: readonly Audience[], who: Chunk, did: Chunk, en: string): Sentence => ({
  id: `oekaki.gc.${id}`,
  level,
  who,
  did,
  en,
  frames,
  audiences,
  status: 'draft',
});

export const SENTENCES: readonly Sentence[] = [
  // ---- Kids (school, pets, siblings, yōkai) ----
  s('cat-swam', 'n4', ['ta-koto'], ALL, c('ねこは', 'The cat'), c('うみで およいだ ことが ある', 'has swum in the sea'), 'The cat has swum in the sea.'),
  s('saw-ghost', 'n4', ['ta-koto'], KF, c('おとうとは', 'My little brother'), c('おばけを 見た ことが ある', 'has seen a ghost', 'おばけを みた ことが ある'), 'My little brother has seen a ghost.'),
  s('kappa-pulled', 'n4', ['passive'], KF, c('おとうとは', 'My little brother'), c('かっぱに 川に ひっぱられた', 'got pulled into the river by a kappa', 'かっぱに かわに ひっぱられた'), 'My little brother got pulled into the river by a kappa.'),
  s('teacher-scared', 'n4', ['passive'], KF, c('せんせいが', 'The teacher'), c('おばけに おどかされた', 'got scared by a ghost'), 'The teacher got scared by a ghost.'),
  s('ate-cake', 'n4', ['te-shimau'], KF, c('おとうとが', 'My little brother'), c('ぼくの ケーキを 食べて しまった', 'went and ate my cake', 'ぼくの ケーキを たべて しまった'), 'My little brother went and ate my cake.'),
  s('tree-down', 'n4', ['te-shimau'], ALL, c('ねこが', 'The cat'), c('クリスマスツリーを たおして しまった', 'knocked over the Christmas tree'), 'The cat knocked over the Christmas tree.'),
  s('rain-trip', 'n3', ['suffering-passive'], KF, c('えんそくの 日に', 'On the school trip', 'えんそくの ひに'), c('あめに ふられた', 'we got rained on'), 'We got rained on on the school trip.'),
  s('penguin-hat', 'n3', ['suffering-passive'], KF, c('ぼくは', 'I'), c('ペンギンに ぼうしを とられた', 'had my hat taken by a penguin'), 'A penguin took my hat.'),
  s('toilet-duty', 'n3', ['saserareru'], KF, c('ぼくは', 'I'), c('せんせいに トイレそうじを させられた', 'was made to clean the toilets by the teacher'), 'The teacher made me clean the toilets.'),
  s('kappa-pepper', 'n3', ['saserareru'], ALL, c('かっぱは', 'The kappa'), c('きらいな ピーマンを 食べさせられた', 'was made to eat the peppers it hates', 'きらいな ピーマンを たべさせられた'), 'The kappa was made to eat the green peppers it hates.'),
  s('cat-fish', 'n3', ['you-to-suru'], ALL, c('ねこが', 'The cat'), c('さかなを ぬすもうと した', 'tried to steal the fish'), 'The cat tried to steal the fish.'),
  s('penguin-fly', 'n3', ['you-to-suru'], KF, c('ペンギンが', 'The penguin'), c('空を とぼうと した', 'tried to fly', 'そらを とぼうと した'), 'The penguin tried to fly.'),
  s('no-bath', 'n3', ['zu-ni'], KF, c('おとうとが', 'My little brother'), c('おふろに 入らずに ねた', 'went to bed without a bath', 'おふろに はいらずに ねた'), 'My little brother went to bed without having a bath.'),
  s('kappa-umbrella', 'n3', ['zu-ni'], ALL, c('かっぱが', 'The kappa'), c('かさを ささずに あるいた', 'walked without an umbrella'), 'The kappa walked without putting up an umbrella.'),
  s('fake-sleep', 'n3', ['furi'], KF, c('ぼくは', 'I'), c('ねて いる ふりを した', 'pretended to be asleep'), 'I pretended to be asleep.'),
  s('tanuki-human', 'n3', ['furi'], ALL, c('たぬきが', 'The tanuki'), c('人間の ふりを した', 'pretended to be human', 'にんげんの ふりを した'), 'The tanuki pretended to be a human.'),
  s('tv-on', 'n3', ['ppanashi'], KF, c('いもうとが', 'My little sister'), c('テレビを つけっぱなしで ねた', 'fell asleep with the TV on'), 'My little sister fell asleep with the TV left on.'),
  s('ghost-window', 'n3', ['ppanashi'], KF, c('おばけが', 'The ghost'), c('まどを あけっぱなしで 帰った', 'went home and left the window open', 'まどを あけっぱなしで かえった'), 'The ghost went home and left the window open.'),
  s('pajamas', 'n3', ['mama'], KF, c('ぼくは', 'I'), c('パジャマの まま 学校へ 行った', 'went to school in my pyjamas', 'パジャマの まま がっこうへ いった'), 'I went to school in my pyjamas.'),
  s('no-homework', 'n3', ['mama'], KF, c('おとうとは', 'My little brother'), c('しゅくだいを わすれた まま 学校に 行った', 'went to school with his homework forgotten', 'しゅくだいを わすれた まま がっこうに いった'), 'My little brother went to school and left his homework behind.'),

  // ---- Family ----
  s('fuji', 'n4', ['ta-koto'], FC, c('おじいさんは', 'Grandpa'), c('ふじさんに のぼった ことが ある', 'has climbed Mt Fuji'), 'Grandpa has climbed Mt Fuji.'),
  s('horse-fall', 'n4', ['ta-koto'], FC, c('パパは', 'Dad'), c('うまから おちた ことが ある', 'has fallen off a horse'), 'Dad has fallen off a horse.'),
  s('seagull', 'n4', ['passive'], FC, c('おじいさんが', 'Grandpa'), c('かもめに おそわれた', 'got attacked by a seagull'), 'Grandpa got attacked by a seagull.'),
  s('bee', 'n4', ['passive'], FC, c('パパが', 'Dad'), c('はちに さされた', 'got stung by a bee'), 'Dad got stung by a bee.'),
  s('salt-sugar', 'n4', ['te-shimau'], FC, c('ママが', 'Mum'), c('さとうと しおを まちがえて しまった', 'mixed up the sugar and the salt'), 'Mum mixed up the sugar and the salt.'),
  s('pond', 'n4', ['te-shimau'], FC, c('パパが', 'Dad'), c('じてんしゃで いけに おちて しまった', 'rode his bike into the pond'), 'Dad rode his bike straight into the pond.'),
  s('baby-cried', 'n3', ['suffering-passive'], FC, c('パパが', 'Dad'), c('あかちゃんに 一晩中 なかれた', 'had the baby crying all night', 'あかちゃんに ひとばんじゅう なかれた'), 'The baby cried at Dad all night.'),
  s('dog-shoes', 'n3', ['suffering-passive'], FC, c('パパが', 'Dad'), c('となりの いぬに くつを かくされた', 'had his shoes hidden by the neighbours’ dog'), 'The neighbours’ dog hid Dad’s shoes.'),
  s('horsey', 'n3', ['saserareru'], FC, c('パパが', 'Dad'), c('こどもたちに おうまさんを させられた', 'was made to play horsey by the kids'), 'The kids made Dad be their horsey.'),
  s('grandpa-game', 'n3', ['saserareru'], FC, c('おじいさんが', 'Grandpa'), c('まごに ゲームを させられた', 'was made to play video games by his grandkid'), 'Grandpa’s grandkid made him play video games.'),
  s('wardrobe', 'n3', ['you-to-suru'], FC, c('パパが', 'Dad'), c('ひとりで たんすを はこぼうと した', 'tried to carry the wardrobe on his own'), 'Dad tried to carry the wardrobe on his own.'),
  s('phone-tv', 'n3', ['you-to-suru'], FC, c('おばあさんが', 'Grandma'), c('スマホで テレビを けそうと した', 'tried to turn off the TV with her phone'), 'Grandma tried to turn the TV off with her smartphone.'),
  s('no-glasses', 'n3', ['zu-ni'], FC, c('ママが', 'Mum'), c('めがねを かけずに 出かけた', 'went out without her glasses on', 'めがねを かけずに でかけた'), 'Mum went out without her glasses on.'),
  s('no-phone', 'n3', ['zu-ni'], FC, c('パパが', 'Dad'), c('でんわを もたずに 山に 行った', 'went up the mountain without his phone', 'でんわを もたずに やまに いった'), 'Dad went up the mountain without his phone.'),
  s('cant-hear', 'n3', ['furi'], FC, c('パパが', 'Dad'), c('きこえない ふりを した', 'pretended not to hear'), 'Dad pretended he couldn’t hear.'),
  s('dont-know', 'n3', ['furi'], FC, c('おばあさんが', 'Grandma'), c('しらない ふりを した', 'pretended not to know'), 'Grandma pretended she didn’t know.'),
  s('light-on', 'n3', ['ppanashi'], FC, c('パパが', 'Dad'), c('でんきを つけっぱなしで ねた', 'fell asleep with the light on'), 'Dad fell asleep with the light left on.'),
  s('window-open', 'n3', ['ppanashi'], FC, c('ママが', 'Mum'), c('まどを あけっぱなしで 出かけた', 'went out and left the window open', 'まどを あけっぱなしで でかけた'), 'Mum went out and left the window open.'),
  s('glasses-on', 'n3', ['mama'], FC, c('おじいさんが', 'Grandpa'), c('めがねを かけた まま めがねを さがした', 'looked for his glasses with his glasses on'), 'Grandpa looked for his glasses while wearing them.'),
  s('suit-pool', 'n3', ['mama'], FC, c('パパが', 'Dad'), c('スーツの まま プールに 入った', 'got into the pool in his suit', 'スーツの まま プールに はいった'), 'Dad got into the pool in his suit.'),

  // ---- Cheeky (grown-up, never explicit) ----
  s('boss-cried', 'n4', ['ta-koto'], C, c('ぶちょうは', 'The boss'), c('カラオケで ないた ことが ある', 'has cried at karaoke'), 'The boss has cried at karaoke.'),
  s('scolded', 'n4', ['passive'], C, c('しんにゅうしゃいんが', 'The new hire'), c('ぶちょうに おこられた', 'got told off by the boss'), 'The new hire got told off by the boss.'),
  s('forgot-booking', 'n4', ['te-shimau'], C, c('かんじが', 'The organiser'), c('のみかいの よやくを わすれて しまった', 'forgot to book the drinking party'), 'The organiser forgot to book the drinks party.'),
  s('date-left', 'n3', ['suffering-passive'], C, c('デートで', 'On the date'), c('かのじょに かえられた', 'my girlfriend went home on me'), 'My girlfriend walked out on me on our date.'),
  s('made-sing', 'n3', ['saserareru'], C, c('しんにゅうしゃいんが', 'The new hire'), c('ぼうねんかいで うたわされた', 'was made to sing at the year-end party'), 'The new hire was made to sing at the year-end party.'),
  s('wrong-house', 'n3', ['you-to-suru'], C, c('よっぱらいが', 'The drunk'), c('となりの いえに かえろうと した', 'tried to go home to the house next door'), 'The drunk tried to go home to the house next door.'),
  s('no-wallet', 'n3', ['zu-ni'], C, c('ぶちょうが', 'The boss'), c('さいふを もたずに のみに 行った', 'went drinking without his wallet', 'さいふを もたずに のみに いった'), 'The boss went drinking without his wallet.'),
  s('fake-drunk', 'n3', ['furi'], C, c('ぶちょうが', 'The boss'), c('よっぱらった ふりを した', 'pretended to be drunk'), 'The boss pretended to be drunk.'),
  s('mic-hog', 'n3', ['ppanashi'], C, c('かんじが', 'The organiser'), c('マイクを もちっぱなしで うたった', 'sang and never let go of the mic'), 'The organiser hogged the mic all night.'),
  s('shoes-on', 'n3', ['mama'], C, c('よっぱらいが', 'The drunk'), c('くつを はいた まま ねた', 'fell asleep with his shoes on'), 'The drunk fell asleep with his shoes on.'),
];

export const SENTENCE_BY_ID: ReadonlyMap<string, Sentence> = new Map(SENTENCES.map((x) => [x.id, x]));

export const sentenceText = (x: Sentence): { text: string; kana: string } => ({ text: `${x.who.text} ${x.did.text}`, kana: `${x.who.kana} ${x.did.kana}` });

export const sentencesFor = (audience: Audience): Sentence[] => SENTENCES.filter((x) => x.audiences.includes(audience));

/** A sentence as the prompt an artist draws (its parts are the two chunks' readings). */
export function sentencePrompt(x: Sentence): Prompt {
  const { text, kana } = sentenceText(x);
  return { id: x.id, text, kana, en: x.en, parts: [normalizeReading(x.who.kana), normalizeReading(x.did.kana)] };
}

/** Is this frame an N4 or N3 one (the Green Car's fakes must carry one)? */
export const isGreenFrame = (f: FrameId): boolean => FRAME_BY_ID[f]?.level === 'n4' || FRAME_BY_ID[f]?.level === 'n3';

/** The Green Car's tiles: who chunks and what-happened chunks. */
export type ChunkTile = Tile & { chunk: 'who' | 'did' };

const pick = <T>(items: readonly T[], n: number, random: () => number): T[] => {
  const left = [...items];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(random() * left.length), 1)[0]!);
  return out;
};

export const WHO_TILES = 3;
export const DID_TILES = 3;

/**
 * A writer's hand for a Green Car drawing: three who chunks and three what-happened chunks from other sentences in
 * the room's audience, none of them a chunk of the real title. Two what-happened chunks share a frame with the real
 * sentence (so the fake can sound like it); the third is the other level: an N3 stretch for an N4 writer, the level
 * the drawing isn't for an N3 writer (so their fakes run about half and half).
 */
export function dealChunkTiles(real: Sentence, writerLevel: string, audience: Audience, random: () => number): ChunkTile[] {
  const pool = sentencesFor(audience).filter((x) => x.id !== real.id);
  const realWho = normalizeReading(real.who.kana);
  const realDid = normalizeReading(real.did.kana);
  const whos = new Map<string, Chunk>();
  for (const x of pool) {
    const k = normalizeReading(x.who.kana);
    if (k !== realWho && !whos.has(k)) whos.set(k, x.who);
  }
  const dids = pool.filter((x) => normalizeReading(x.did.kana) !== realDid);
  const same = pick(
    dids.filter((x) => x.frames.some((f) => real.frames.includes(f))),
    2,
    random,
  );
  const otherLevel = writerLevel === 'n3' ? (real.level === 'n3' ? 'n4' : 'n3') : 'n3';
  const other = pick(
    dids.filter((x) => x.level === otherLevel && !same.includes(x)),
    1,
    random,
  );
  const rest = pick(
    dids.filter((x) => !same.includes(x) && !other.includes(x)),
    DID_TILES - same.length - other.length,
    random,
  );
  const didTiles = [...same, ...rest, ...other].map((x): ChunkTile => ({ ...x.did, chunk: 'did', ...(x.level === 'n3' ? { n3: true as const } : {}) }));
  const whoTiles = pick([...whos.values()], WHO_TILES, random).map((w): ChunkTile => ({ ...w, chunk: 'who' }));
  return [...whoTiles, ...didTiles];
}

/** House decoys in the Green Car: other sentences for the room's audience. */
export function sentenceDecoys(audience: Audience, random: () => number): Prompt[] {
  return pick(sentencesFor(audience), SENTENCES.length, random).map(sentencePrompt);
}
