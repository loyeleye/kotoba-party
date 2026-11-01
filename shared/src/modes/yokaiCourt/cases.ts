// Yōkai Court's content: the studio mysteries that go to trial, the yōkai in the dock, the witness's four
// answers, each lawyer's evidence, the missions and the level lines. Every line is draft until a fluent check.
// See docs/modes/yokai-court.md and the storyboards (learning-path/storyboards/v2/yokai-court.html).
//
// A case: Fude-san (the presiding judge, さいばんちょう) asks the witness なにか 見ましたか？ and the witness taps one
// of four answers (saw it, saw nothing, it was someone else, or the curveball: a second suspect was there too).
// Then the prosecution and the defence each argue on a mission written for that answer, at their level, with a
// private piece of evidence: a clue for the prosecution, where the accused really was for the defence. Judges
// get one question about one of those, so the evidence is what they listen for.
//
// Lines are built from templates, so one set of missions fits every case: {A} the accused, {O} the yōkai the
// witness blames, {C} the curveball's second suspect, {D} the deed (plain past), {Dm} the deed (ます past),
// {Dn} the deed (ません past), {K} the prosecution's clue, {P} the defence's alibi place, {R} what
// the accused must do to put it right (ない stem: 返さ), so the N4 lines put a new verb in なければ / なくても each case. In the Japanese,
// [漢字|かんじ] is a word with its reading, so the line's text and kana stay space for space (furigana is
// built from the pair). Kana and N5 lines are all kana.
//
// Never: real crimes, violence, police, prison, death. The cases are studio nuisances (a bento, a pudding, a mic)
// and the worst sentence is an apology.

import type { JpText, Level } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export { LEVEL_RANK } from '../../level.js';
export const COURT_LEVELS: readonly Level[] = ['kana', 'n5', 'n4', 'n3'];
/** The levels that argue in their own words (Kana lawyers pick tiles). */
export type SpeakLevel = Exclude<Level, 'kana'>;

export type Side = 'pros' | 'def';
/** What the witness said: saw it, saw nothing, it was someone else, or the curveball (a second suspect). */
export type Testimony = 'saw' | 'unseen' | 'other' | 'curve';
export const TESTIMONIES: readonly Testimony[] = ['saw', 'unseen', 'other', 'curve'];

/** A yōkai of the studio: in the dock, blamed, or the curveball's second suspect. */
export interface Yokai {
  id: string;
  name: JpText;
  /** Path under stage/assets, without .png. */
  picture: string;
  emoji: string;
  /** Kana that show the yōkai was named, in the normalised reading. */
  keys: string[];
}

/** A piece of evidence or a place: what the judges listen for, and the check's pictures. */
export interface Thing {
  id: string;
  word: JpText;
  /** The dictionary meaning, when the English is written for sentences (a cucumber slice → cucumber). */
  gloss?: string;
  /** A place with its preposition, for the English lines (on the roof). Clues leave it out. */
  at?: string;
  picture: string;
  emoji: string;
  keys: string[];
}

export interface Case {
  id: string;
  /** The case as Fude-san reads it: a question, with kanji for the TV (furigana from the kana). */
  title: JpText;
  /** Where it happened (the case card). */
  scene: JpText;
  accused: string;
  /** The deed: plain past (食べた), ます past (食べました), ません past (食べませんでした); en is past (ate the bento). */
  deed: { plain: JpText; masu: JpText; neg: JpText };
  /** The thing it happened to: the case card's picture, and the prosecution's picture in the gist. */
  object: Thing;
  /** The case card's evidence line, in English: the damage only, never the clue the check asks about. */
  evidence: string;
  /** What the accused must do to put it right, in the ない stem (返さ: 返さなければ / 返さなくても); en: give the mic back. */
  remedy: JpText;
  /** The prosecution's clue, and two decoys for the check. */
  clue: string;
  clueDecoys: [string, string];
  /** Where the accused really was (the defence's evidence), and two decoys for the check. */
  alibi: string;
  alibiDecoys: [string, string];
  /** The yōkai the witness blames (きつねです！), and the curveball's second suspect (たぬきも いました！). */
  other: string;
  curve: string;
  /** Fude-san's last word on the case once the verdict is in, either way (the real story). */
  coda: JpText;
  audiences?: readonly Audience[];
  status: 'draft' | 'fluent-checked';
}

const jp = (text: string, en: string, kana = text): JpText => ({ text, kana, en });
const jk = (text: string, kana: string, en: string): JpText => ({ text, kana, en });

// ---- the yōkai ----

export const YOKAI: readonly Yokai[] = [
  { id: 'kappa', name: jp('かっぱ', 'kappa'), picture: 'hotline/caller-kappa', emoji: '🌊', keys: ['かっぱ'] },
  { id: 'kitsune', name: jp('きつね', 'fox'), picture: 'hotline/caller-kitsune', emoji: '🦊', keys: ['きつね'] },
  { id: 'tanuki', name: jp('たぬき', 'tanuki'), picture: 'fx/tanuki-doron', emoji: '🍃', keys: ['たぬき'] },
  { id: 'neko', name: jp('ねこ', 'cat'), picture: 'late/cause-cat', emoji: '🐈', keys: ['ねこが', 'ねこも', 'ねこだ', 'ねこで', 'ねこは', 'ねこじゃ', 'ねこに'] },
  { id: 'karakasa', name: jp('からかさ', 'umbrella yōkai'), picture: 'hotline/caller-karakasa', emoji: '☂️', keys: ['からかさ', 'かさおばけ'] },
  { id: 'oni', name: jp('おに', 'oni'), picture: 'hotline/caller-oni', emoji: '👹', keys: ['おにが', 'おにも', 'おにだ', 'おにで', 'おには', 'おにじゃ', 'おにに', 'あかおに'] },
  { id: 'yukionna', name: jp('ゆきおんな', 'snow woman'), picture: 'hotline/caller-yukionna', emoji: '❄️', keys: ['ゆきおんな'] },
  { id: 'nekomata', name: jp('ねこまた', 'nekomata'), picture: 'hotline/caller-nekomata', emoji: '🐾', keys: ['ねこまた'] },
  { id: 'zashiki', name: jp('ざしきわらし', 'zashiki-warashi'), picture: 'hotline/caller-zashiki', emoji: '👘', keys: ['ざしきわらし', 'わらし'] },
  { id: 'tengu', name: jp('てんぐ', 'tengu'), picture: 'hotline/caller-tengu', emoji: '👺', keys: ['てんぐ'] },
  { id: 'kodama', name: jp('こだま', 'kodama'), picture: 'hotline/caller-kodama', emoji: '🌳', keys: ['こだま'] },
];

// ---- evidence and places ----

// Keys carry a particle or a verb where the word is short or sits inside other words (いけに, not いけ: いけません).
export const CLUES: readonly Thing[] = [
  { id: 'cucumber', word: jp('きゅうり', 'a cucumber slice'), gloss: 'cucumber', picture: 'court/clue-cucumber', emoji: '🥒', keys: ['きゅうり'] },
  { id: 'leaf', word: jp('はっぱ', 'a leaf'), picture: 'late/leaf', emoji: '🍃', keys: ['はっぱ'] },
  { id: 'footprints', word: jk('足あと', 'あしあと', 'footprints'), picture: 'court/clue-footprints', emoji: '👣', keys: ['あしあと'] },
  { id: 'puddle', word: jk('水たまり', 'みずたまり', 'a puddle'), picture: 'court/clue-puddle', emoji: '💧', keys: ['みずたまり'] },
  { id: 'spoon', word: jp('スプーン', 'a spoon', 'スプーン'), picture: 'court/clue-spoon', emoji: '🥄', keys: ['すぷうん', 'すぷーん'] },
  { id: 'ice', word: jp('こおり', 'ice'), picture: 'court/clue-ice', emoji: '🧊', keys: ['こおり'] },
  { id: 'bell', word: jp('すず', 'a little bell'), picture: 'court/clue-bell', emoji: '🔔', keys: ['すずが', 'すずを', 'すずも', 'すずの', 'すずは', 'すずです'] },
  { id: 'feather', word: jp('はね', 'a feather'), picture: 'court/clue-feather', emoji: '🪶', keys: ['はねが', 'はねを', 'はねも', 'はねの', 'はねは', 'はねです'] },
];

export const PLACES: readonly Thing[] = [
  { id: 'pond', word: jk('池', 'いけ', 'the pond'), at: 'by the pond', picture: 'court/place-pond', emoji: '🪷', keys: ['いけに', 'いけで', 'いけの', 'いけへ', 'いけです', 'いけにい'] },
  { id: 'bath', word: jp('おふろ', 'the bath'), at: 'in the bath', picture: 'court/place-bath', emoji: '♨️', keys: ['ふろ'] },
  { id: 'roof', word: jk('屋根', 'やね', 'the roof'), at: 'on the roof', picture: 'court/place-roof', emoji: '🏠', keys: ['やね'] },
  { id: 'garden', word: jk('庭', 'にわ', 'the garden'), at: 'in the garden', picture: 'court/place-garden', emoji: '🌸', keys: ['にわに', 'にわで', 'にわの', 'にわへ', 'にわです'] },
  { id: 'mountain', word: jk('山', 'やま', 'the mountain'), at: 'on the mountain', picture: 'court/place-mountain', emoji: '🗻', keys: ['やまに', 'やまで', 'やまの', 'やまへ', 'やまです'] },
  { id: 'kotatsu', word: jp('こたつ', 'the kotatsu'), at: 'under the kotatsu', picture: 'hotline/advice-kotatsu', emoji: '🍊', keys: ['こたつ'] },
  { id: 'closet', word: jp('おしいれ', 'the cupboard'), at: 'in the cupboard', picture: 'court/place-closet', emoji: '🚪', keys: ['おしいれ'] },
];

// ---- the cases ----

export const CASES: readonly Case[] = [
  {
    id: 'bento',
    title: jk('楽屋の お弁当、誰が 食べた？', 'がくやの おべんとう、だれが たべた？', 'Who ate the bento in the green room?'),
    scene: jk('楽屋', 'がくや', 'the green room'),
    accused: 'kappa',
    deed: { plain: jk('食べた', 'たべた', 'ate the bento'), masu: jk('食べました', 'たべました', 'ate the bento'), neg: jk('食べませんでした', 'たべませんでした', 'didn’t eat the bento') },
    object: { id: 'bento', word: jk('お弁当', 'おべんとう', 'the bento'), picture: 'cards/konbini.bento', emoji: '🍱', keys: ['べんとう'] },
    evidence: 'An empty box. Not one grain of rice left.',
    remedy: jk('作ら', 'つくら', 'make a new bento'),
    clue: 'cucumber',
    clueDecoys: ['leaf', 'puddle'],
    alibi: 'roof',
    alibiDecoys: ['pond', 'garden'],
    other: 'kitsune',
    curve: 'tanuki',
    coda: jp('ほんとうは… ポンが たべました。きゅうりは きらいです。', 'The real story… Pon ate it. He doesn’t like cucumber.'),
    status: 'draft',
  },
  {
    id: 'pudding',
    title: jk('ポンの プリン、誰が 食べた？', 'ポンの プリン、だれが たべた？', 'Who ate Pon’s pudding?'),
    scene: jk('冷蔵庫', 'れいぞうこ', 'the studio fridge'),
    accused: 'oni',
    deed: { plain: jk('食べた', 'たべた', 'ate the pudding'), masu: jk('食べました', 'たべました', 'ate the pudding'), neg: jk('食べませんでした', 'たべませんでした', 'didn’t eat the pudding') },
    object: { id: 'pudding', word: jp('プリン', 'the pudding'), picture: 'court/object-pudding', emoji: '🍮', keys: ['ぷりん'] },
    evidence: 'An empty cup, licked clean.',
    remedy: jk('買わ', 'かわ', 'buy a new pudding'),
    clue: 'spoon',
    clueDecoys: ['bell', 'ice'],
    alibi: 'bath',
    alibiDecoys: ['garden', 'mountain'],
    other: 'neko',
    curve: 'kappa',
    coda: jp('ほんとうは… おにが たべました。スプーンも おにの です。', 'The real story… the oni did eat it. The spoon is the oni’s too.'),
    status: 'draft',
  },
  {
    id: 'lantern',
    title: jk('スタジオの ちょうちん、誰が こわした？', 'スタジオの ちょうちん、だれが こわした？', 'Who broke the studio lantern?'),
    scene: jp('スタジオ', 'the studio'),
    accused: 'karakasa',
    deed: { plain: jp('こわした', 'broke the lantern'), masu: jp('こわしました', 'broke the lantern'), neg: jp('こわしませんでした', 'didn’t break the lantern') },
    object: { id: 'lantern', word: jp('ちょうちん', 'the lantern'), picture: 'court/object-lantern', emoji: '🏮', keys: ['ちょうちん'] },
    evidence: 'A broken lantern on the floor.',
    remedy: jk('直さ', 'なおさ', 'fix the lantern'),
    clue: 'puddle',
    clueDecoys: ['footprints', 'leaf'],
    alibi: 'roof',
    alibiDecoys: ['pond', 'closet'],
    other: 'tengu',
    curve: 'kodama',
    coda: jp('ほんとうは… ちょうちんさんが くしゃみを しました。みずたまりは はなみず でした。', 'The real story… Chōchin-san sneezed. The puddle was a runny nose.'),
    status: 'draft',
  },
  {
    id: 'tea',
    title: jk('のびこさんの お茶、誰が 飲んだ？', 'のびこさんの おちゃ、だれが のんだ？', 'Who drank Nobiko-san’s tea?'),
    scene: jk('楽屋', 'がくや', 'the green room'),
    accused: 'yukionna',
    deed: { plain: jk('飲んだ', 'のんだ', 'drank the tea'), masu: jk('飲みました', 'のみました', 'drank the tea'), neg: jk('飲みませんでした', 'のみませんでした', 'didn’t drink the tea') },
    object: { id: 'tea', word: jk('お茶', 'おちゃ', 'the tea'), picture: 'cards/konbini.tea', emoji: '🍵', keys: ['おちゃ'] },
    evidence: 'An empty cup. Not one drop left.',
    remedy: jk('入れ', 'いれ', 'make new tea'),
    clue: 'ice',
    clueDecoys: ['puddle', 'spoon'],
    alibi: 'bath',
    alibiDecoys: ['mountain', 'kotatsu'],
    other: 'tengu',
    curve: 'kitsune',
    coda: jp('ほんとうは… のびこさんが くびを のばして、じぶんで のみました。', 'The real story… Nobiko-san stretched her neck over and drank it herself.'),
    status: 'draft',
  },
  {
    id: 'mic',
    title: jk('スタジオの マイク、誰が とった？', 'スタジオの マイク、だれが とった？', 'Who took the studio mic?'),
    scene: jp('スタジオ', 'the studio'),
    accused: 'nekomata',
    deed: { plain: jp('とった', 'took the mic'), masu: jp('とりました', 'took the mic'), neg: jp('とりませんでした', 'didn’t take the mic') },
    object: { id: 'mic', word: jp('マイク', 'the mic'), picture: 'court/object-mic', emoji: '🎤', keys: ['まいく'] },
    evidence: 'An empty mic stand. The show starts in ten minutes.',
    remedy: jk('返さ', 'かえさ', 'give the mic back'),
    clue: 'bell',
    clueDecoys: ['feather', 'cucumber'],
    alibi: 'pond',
    alibiDecoys: ['kotatsu', 'roof'],
    other: 'kodama',
    curve: 'tengu',
    coda: jp('ほんとうは… ねこまたが とりました。カラオケが だいすきです。', 'The real story… the nekomata did take it. It loves karaoke.'),
    status: 'draft',
  },
  {
    id: 'inkstone',
    title: jk('フデさんの すずり、誰が かくした？', 'フデさんの すずり、だれが かくした？', 'Who hid Fude-san’s inkstone?'),
    scene: jk('書道室', 'しょどうしつ', 'the calligraphy room'),
    accused: 'zashiki',
    deed: { plain: jp('かくした', 'hid the inkstone'), masu: jp('かくしました', 'hid the inkstone'), neg: jp('かくしませんでした', 'didn’t hide the inkstone') },
    object: { id: 'inkstone', word: jp('すずり', 'the inkstone'), picture: 'hotline/advice-ink', emoji: '🖋️', keys: ['すずり'] },
    evidence: 'An empty desk. Fude-san can’t write a thing.',
    remedy: jk('探さ', 'さがさ', 'find the inkstone'),
    clue: 'footprints',
    clueDecoys: ['feather', 'bell'],
    alibi: 'garden',
    alibiDecoys: ['closet', 'pond'],
    other: 'neko',
    curve: 'kappa',
    coda: jp('ほんとうは… すずりは フデさんの ポケットに ありました。あしあとも フデさんの でした。', 'The real story… the inkstone was in Fude-san’s own pocket. The footprints were Fude-san’s too.'),
    status: 'draft',
  },
];

// ---- lookups ----

const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]));
const YOKAI_BY_ID = byId(YOKAI);
const THING_BY_ID = byId([...CLUES, ...PLACES]);
export const yokaiOf = (id: string): Yokai => YOKAI_BY_ID.get(id)!;
export const thingOf = (id: string): Thing | undefined => THING_BY_ID.get(id);
export const caseOf = (id: string): Case | undefined => CASES.find((c) => c.id === id);
const fits = (x: { audiences?: readonly Audience[] }, audience: Audience): boolean => !x.audiences || x.audiences.includes(audience);
export const casesFor = (audience: Audience): Case[] => CASES.filter((c) => fits(c, audience));

/** The yōkai the testimony points at, besides the accused: the blamed one (other) or the second suspect (curve). */
export function suspectOf(c: Case, t: Testimony): Yokai | null {
  if (t === 'other') return yokaiOf(c.other);
  if (t === 'curve') return yokaiOf(c.curve);
  return null;
}

// ---- templates ----

/** A Japanese line with its reading and English, before the case fills it in. */
export interface Template {
  ja: string;
  en: string;
  /** The sentence frames the line says (ids from shared/src/japanese/frames.ts; N3 ones may land later). */
  frames?: readonly string[];
}

/** The slot values one case and testimony give a line. */
export function slotsOf(c: Case, t: Testimony): Record<string, JpText> {
  const a = yokaiOf(c.accused).name;
  const o = yokaiOf(c.other).name;
  const cv = yokaiOf(c.curve).name;
  const k = thingOf(c.clue)!.word;
  const p = thingOf(c.alibi)!.word;
  void t;
  return { A: a, O: o, C: cv, D: c.deed.plain, Dm: c.deed.masu, Dn: c.deed.neg, K: k, P: p, Pat: { ...p, en: thingOf(c.alibi)!.at ?? p.en }, R: c.remedy };
}

/**
 * Fills a template. `kanaOnly` writes the whole line in kana (Kana and N5 lines), so a slot's kanji never shows.
 * English slots: {A} the kappa, {deed} ate the bento, {K} a cucumber slice, {P} the pond, {Pat} by the pond,
 * {R} make a new bento.
 */
export function fill(tpl: Template, slots: Record<string, JpText>, kanaOnly: boolean): JpText {
  let text = '';
  let kana = '';
  const re = /\[([^|\]]+)\|([^\]]+)\]|\{(\w+)\}/g;
  let at = 0;
  for (let m = re.exec(tpl.ja); m; m = re.exec(tpl.ja)) {
    const plain = tpl.ja.slice(at, m.index);
    text += plain;
    kana += plain;
    if (m[1] !== undefined) {
      text += kanaOnly ? m[2]! : m[1];
      kana += m[2]!;
    } else {
      const v = slots[m[3]!];
      text += v ? (kanaOnly ? v.kana : v.text) : m[0];
      kana += v ? v.kana : m[0];
    }
    at = m.index + m[0].length;
  }
  text += tpl.ja.slice(at);
  kana += tpl.ja.slice(at);
  const en = tpl.en.replace(/\{(\w+)\}/g, (all, k: string) => {
    if (k === 'deed') return slots.D?.en ?? all;
    if (k === 'deedNeg') return slots.Dn?.en ?? all;
    return slots[k]?.en ?? all;
  });
  return { text, kana, en };
}

// ---- the witness ----

/** What Fude-san asks the witness, every case. */
export const QUESTION: JpText = jk('なにか 見ましたか？', 'なにか みましたか？', 'Did you see anything?');

/** The witness's four answers. The curveball adds a second suspect (it scores nothing: it changes the case). */
export const WITNESS: Record<Testimony, Template> = {
  saw: { ja: 'みました！', en: 'I saw it!' },
  unseen: { ja: 'なにも みて いません！', en: 'I didn’t see anything!' },
  other: { ja: '{O}です！', en: 'It was the {O}!' },
  curve: { ja: '{C}も いました！', en: 'A {C} was there too!' },
};
/** What the testimony means, for the TV and the lawyers' evidence card. */
export const TESTIMONY_NOTE: Record<Testimony, string> = {
  saw: 'The witness saw it happen.',
  unseen: 'The witness saw nothing at all.',
  other: 'The witness blames the {O}!',
  curve: 'A second suspect! The witness saw a {C} there too.',
};

// ---- missions: one per side and testimony, for every level; they never name the grammar ----

/** Kana lawyers argue with tiles, so a mission never asks for what no tile says. */
export const KANA_MISSIONS: Partial<Record<Side, Partial<Record<Testimony, string>>>> = {
  pros: { saw: 'The witness saw it. Use that, give your evidence, and say the {A} did it.' },
};

export const MISSIONS: Record<Side, Record<Testimony, string>> = {
  pros: {
    saw: 'The witness saw it. Use that, give your evidence, and say what the {A} must do now.',
    unseen: 'Nobody saw a thing. Say your evidence proves it anyway, and sound sure.',
    other: 'The witness blames the {O}. Give your evidence, and say why it was still the {A}.',
    curve: 'Use what the witness said. Then give your evidence and say who it must have been, and sound sure.',
  },
  def: {
    saw: 'The witness says they saw it. Say that doesn’t prove anything, then say where the {A} really was.',
    unseen: 'Nobody saw a thing. Say so, then say where the {A} really was.',
    other: 'The witness blames the {O}. Back that up, then say where the {A} really was.',
    curve: 'Agree the {C} was there, but say that doesn’t prove the {A} did it. Then say where the {A} really was.',
  },
};

// ---- level lines: what the presiding judge would say, behind "Need a hint?" and read on a mic pass ----

const W = '[証人|しょうにん]';
const SAID = '[言って|いって] いました';

export const LINES: Record<Side, Record<Testimony, Record<SpeakLevel, Template>>> = {
  pros: {
    saw: {
      n5: { ja: 'しょうにんは みました。{K}が ありました。{A}が {Dm}！', en: 'The witness saw it. We found {K}. The {A} {deed}!', frames: ['mashita'] },
      n4: { ja: `${W}は {A}を [見た|みた]と ${SAID}。{K}も ありました。{A}は {R}なければ なりません！`, en: 'The witness said they saw the {A}. We found {K} too. The {A} must {R}!', frames: ['to-itte-ita', 'nakereba'] },
      n3: { ja: `${W}に よると、{A}が {D} そうです。{K}も ありました。{A}に ちがいありません！`, en: 'According to the witness, the {A} {deed}. We found {K} too. It must have been the {A}!', frames: ['ni-yoru', 'ni-chigainai'] },
    },
    unseen: {
      n5: { ja: 'だれも みて いません。でも、{K}が ありました。{A}が {Dm}！', en: 'Nobody saw it. But we found {K}. The {A} {deed}!', frames: ['mashita'] },
      n4: { ja: `${W}は [見て|みて] いないと ${SAID}。でも、{K}が ありました。{A}は {R}なければ なりません！`, en: 'The witness said they didn’t see it. But we found {K}. The {A} must {R}!', frames: ['to-itte-ita', 'nakereba'] },
      n3: { ja: `${W}は [見て|みて] いない そうですが、{K}が ありました。{A}じゃ ないなんて、ありえません！`, en: 'I hear the witness saw nothing, but we found {K}. Saying it wasn’t the {A} is absurd!', frames: ['sou-hear', 'nante'] },
    },
    other: {
      n5: { ja: '{O}じゃ ありません。{K}が ありました。{A}が {Dm}！', en: 'It wasn’t the {O}. We found {K}. The {A} {deed}!', frames: ['ja-nai', 'mashita'] },
      n4: { ja: `${W}は {O}だと ${SAID}。でも、{K}が ありました。{A}は {R}なければ なりません！`, en: 'The witness said it was the {O}. But we found {K}. The {A} must {R}!', frames: ['to-itte-ita', 'nakereba'] },
      n3: { ja: `${W}に よると、{O}だ そうですが、{K}が ありました。{A}に ちがいありません！`, en: 'According to the witness it was the {O}, but we found {K}. It must have been the {A}!', frames: ['ni-yoru', 'ni-chigainai'] },
    },
    curve: {
      n5: { ja: '{C}も いました。でも、{K}が ありました。{A}が {Dm}！', en: 'A {C} was there too. But we found {K}. The {A} {deed}!', frames: ['mashita'] },
      n4: { ja: `${W}は {C}も いたと ${SAID}。でも、{K}が ありました。{A}は {R}なければ なりません！`, en: 'The witness said a {C} was there too. But we found {K}. The {A} must {R}!', frames: ['to-itte-ita', 'nakereba'] },
      n3: { ja: '{C}も いた らしいですが、{K}が ありました。{D}のは {A}に ちがいありません！', en: 'Apparently a {C} was there too, but we found {K}. The one who did it must have been the {A}!', frames: ['rashii', 'ni-chigainai'] },
    },
  },
  def: {
    saw: {
      n5: { ja: 'ちがいます！ {A}は {P}に いました！', en: 'That’s wrong! The {A} was {Pat}!', frames: ['wa-ni-aru'] },
      n4: { ja: `${W}は [見た|みた]と ${SAID}。でも、{A}は {P}に いました。だから、{R}なくても いいです！`, en: 'The witness said they saw it. But the {A} was {Pat}. So there’s no need to {R}!', frames: ['to-itte-ita', 'nakutemo-ii'] },
      n3: { ja: `${W}が [見た|みた]からと いって、{A}が {D} わけでは ありません。{A}は {P}に いました。`, en: 'Just because the witness saw something doesn’t mean the {A} {deed}. The {A} was {Pat}.', frames: ['wake-dewa-nai'] },
    },
    unseen: {
      n5: { ja: 'だれも みて いません！ {A}は {P}に いました！', en: 'Nobody saw it! The {A} was {Pat}!', frames: ['te-iru', 'wa-ni-aru'] },
      n4: { ja: `${W}は [見て|みて] いないと ${SAID}。{A}は {P}に いました。だから、{R}なくても いいです！`, en: 'The witness said they didn’t see it. The {A} was {Pat}. So there’s no need to {R}!', frames: ['to-itte-ita', 'nakutemo-ii'] },
      n3: { ja: `${W}に よると、だれも [見て|みて] いない そうです。だからと いって、{A}が {D} わけでは ありません。{A}は {P}に いました。`, en: 'According to the witness, nobody saw it. But that doesn’t mean the {A} {deed}. The {A} was {Pat}.', frames: ['ni-yoru', 'wake-dewa-nai'] },
    },
    other: {
      n5: { ja: '{O}です！ {A}は {P}に いました！', en: 'It was the {O}! The {A} was {Pat}!', frames: ['desu', 'wa-ni-aru'] },
      n4: { ja: `${W}は {O}だと ${SAID}。{A}は {P}に いました。だから、{R}なくても いいです！`, en: 'The witness said it was the {O}. The {A} was {Pat}. So there’s no need to {R}!', frames: ['to-itte-ita', 'nakutemo-ii'] },
      n3: { ja: `${W}に よると、{O}だ そうです。{A}は {P}に いました。いかにも {O}っぽい やり方です！`, en: 'According to the witness, it was the {O}. The {A} was {Pat}. That’s just the sort of thing a {O} does!', frames: ['ni-yoru', 'ppoi'] },
    },
    curve: {
      n5: { ja: '{C}も いました！ {A}は {P}に いました！', en: 'A {C} was there too! The {A} was {Pat}!', frames: ['wa-ni-aru'] },
      n4: { ja: `${W}は {C}も いたと ${SAID}。{A}は {P}に いました。だから、{R}なくても いいです！`, en: 'The witness said a {C} was there too. The {A} was {Pat}. So there’s no need to {R}!', frames: ['to-itte-ita', 'nakutemo-ii'] },
      n3: { ja: '{C}が いたからと いって、{A}が {D} わけでは ありません。{A}は {P}に いました。', en: 'Just because a {C} was there doesn’t mean the {A} {deed}. The {A} was {Pat}.', frames: ['wake-dewa-nai'] },
    },
  },
};

// ---- Kana lawyers: three tiles a side, to build an argument from (one or two, in order) ----

export interface ArgTile {
  id: string;
  tpl: Template;
  /** This tile says the side's evidence (the clue, or the alibi place): what the check asks about. */
  evidence?: boolean;
}

export function kanaTilesOf(side: Side, t: Testimony): ArgTile[] {
  if (side === 'pros') {
    const third: Record<Testimony, Template> = {
      saw: { ja: 'しょうにんが みた！', en: 'The witness saw it!' },
      unseen: { ja: 'ぜったい {A}！', en: 'It was the {A}, for sure!' },
      other: { ja: '{O}じゃ ない！', en: 'Not the {O}!' },
      curve: { ja: '{C}じゃ ない！', en: 'Not the {C}!' },
    };
    return [
      { id: 'claim', tpl: { ja: '{A}が {D}！', en: 'The {A} {deed}!' } },
      { id: 'evidence', tpl: { ja: '{K}が あった！', en: 'We found {K}!' }, evidence: true },
      { id: 'answer', tpl: third[t] },
    ];
  }
  const third: Record<Testimony, Template> = {
    saw: { ja: 'ちがう！', en: 'That’s wrong!' },
    unseen: { ja: 'だれも みてない！', en: 'Nobody saw it!' },
    other: { ja: '{O}が {D}！', en: 'The {O} {deed}!' },
    curve: { ja: '{C}が {D}！', en: 'The {C} {deed}!' },
  };
  return [
    { id: 'evidence', tpl: { ja: '{A}は {P}に いた！', en: 'The {A} was {Pat}!' }, evidence: true },
    { id: 'claim', tpl: { ja: '{A}じゃ ない！', en: 'It wasn’t the {A}!' } },
    { id: 'answer', tpl: third[t] },
  ];
}

// ---- gists: the main claim at each level, never the detail the check asks about ----

export const GISTS: Record<Side, { kana: Template; n5: Template }> = {
  pros: { kana: { ja: '{A}が {D}！', en: 'The {A} {deed}.' }, n5: { ja: '{A}が {Dm}。', en: 'The {A} {deed}.' } },
  def: { kana: { ja: '{A}じゃ ない！', en: 'It wasn’t the {A}.' }, n5: { ja: '{A}は {Dn}。', en: 'The {A} {deedNeg}.' } },
};

// ---- the check: one question about one side's evidence ----

export interface CheckQuestion {
  side: Side;
  /** By level: Kana gets the short form. */
  ja: { kana: Template; n5: Template };
  en: string;
}

export const CHECKS: Record<Side, CheckQuestion> = {
  def: { side: 'def', ja: { kana: { ja: '{A}は どこに いた？', en: '' }, n5: { ja: '{A}は どこに いましたか？', en: '' } }, en: 'Where did the defence say the {A} was?' },
  pros: { side: 'pros', ja: { kana: { ja: 'なにが あった？', en: '' }, n5: { ja: 'なにが ありましたか？', en: '' } }, en: 'What did the prosecution say was left behind?' },
};

// ---- the booth: chunks a lawyer's own words can use, highest level first ----

export interface CourtChunk {
  id: string;
  level: SpeakLevel;
  /** As written, to highlight in the line. */
  text: string;
  /** Kana that show it was said, in the normalised reading. */
  keys: string[];
  /** One line of colour, in English. Calls the play, never a mistake. */
  note: string;
  tag: string;
}

const tag = {
  chigai: 'Limited Express · 〜に ちがいありません',
  rashii: 'Limited Express · 〜らしい',
  ppoi: 'Limited Express · 〜っぽい',
  nante: 'Limited Express · 〜なんて',
  wake: 'Limited Express · 〜わけでは ありません',
  yoru: 'Express Line · 〜に よると',
  itte: 'Express Line · 〜と いって いました',
  nakereba: 'Express Line · 〜なければ なりません',
  nakutemo: 'Express Line · 〜なくても いいです',
  imashita: 'Local Line · 〜に いました',
  janai: 'Local Line · 〜じゃ ありません',
  atta: 'Local Line · 〜が ありました',
};

/** Within a level the longer chunk comes first, so its keys win. */
export const CHUNKS: readonly CourtChunk[] = [
  { id: 'rashii', level: 'n3', text: 'らしいです', keys: ['いたらしい', 'らしいですが'], note: '〜らしい: “apparently…”. Hearsay, entered into evidence.', tag: tag.rashii },
  { id: 'nante', level: 'n3', text: 'なんて', keys: ['なんておかし', 'なんてひど', 'なんてうそ', 'なんてありえ'], note: '〜なんて: “to say that…!”. The court is outraged.', tag: tag.nante },
  { id: 'ppoi', level: 'n3', text: 'っぽい', keys: ['っぽいやり', 'っぽいです'], note: '〜っぽい: “so very like a…”. The court nods.', tag: tag.ppoi },
  { id: 'chigai', level: 'n3', text: 'に ちがいありません', keys: ['にちがいありません', 'にちがいない'], note: '〜に ちがいありません: “it must have been…”. Said like a closing argument. The court leans in.', tag: tag.chigai },
  { id: 'wake', level: 'n3', text: 'わけでは ありません', keys: ['わけではありません', 'わけじゃありません', 'わけではない', 'わけじゃない'], note: '〜わけでは ありません: “that doesn’t mean…”. One line, and the case has a hole in it.', tag: tag.wake },
  { id: 'itte', level: 'n4', text: 'と いって いました', keys: ['といっていました', 'っていっていました', 'といってました', 'っていってました', 'といっていた', 'っていっていた', 'っていってた', 'といいました'], note: '〜と いって いました: “they said…”. The testimony, quoted back at the court.', tag: tag.itte },
  { id: 'nakereba', level: 'n4', text: 'なければ なりません', keys: ['なければなりません', 'なければならない', 'なければいけ', 'なくてはいけ', 'なくてはなりません', 'なきゃいけ', 'なくちゃいけ', 'ないといけ'], note: '〜なければ なりません: “must”. The sentence, before the judges have even voted.', tag: tag.nakereba },
  { id: 'nakutemo', level: 'n4', text: 'なくても いいです', keys: ['なくてもいい', 'なくていい'], note: '〜なくても いいです: “no need to…”. The defence lets its client off the hook, politely.', tag: tag.nakutemo },
  { id: 'yoru', level: 'n4', text: 'に よると', keys: ['によると', 'によれば'], note: '〜に よると: “according to…”. The witness’s words, kept apart from your own. Very lawyerly.', tag: tag.yoru },
  { id: 'imashita', level: 'n5', text: 'に いました', keys: ['にいました'], note: '〜に いました: “was at…”. An alibi in three words.', tag: tag.imashita },
  { id: 'atta', level: 'n5', text: 'が ありました', keys: ['がありました', 'もありました'], note: '〜が ありました: “there was…”. Exhibit A, laid on the table.', tag: tag.atta },
  { id: 'janai', level: 'n5', text: 'じゃ ありません', keys: ['じゃありません', 'じゃないです', 'ではありません', 'じゃない'], note: '〜じゃ ありません: “it wasn’t…”. Short, firm, and the court heard it.', tag: tag.janai },
];

/** Hand romaji for Kana phones where the kana alone can't show the word split. Keyed by the kana as shown. */
export const ROMAJI: Record<string, string> = {
  'みました！': 'Mimashita!',
  'なにも みて いません！': 'Nani mo mite imasen!',
  'ちがう！': 'Chigau!',
  'だれも みてない！': 'Dare mo mitenai!',
  'しょうにんが みた！': 'Shōnin ga mita!',
  'なにが あった？': 'Nani ga atta?',
};
