// Sentence frames (shared/src/japanese/frames.ts): each phrase gets the frame it's built on, the most
// specific one first, and the game's own look-alike lines get none (docs/progressive-learning.md).

import { describe, expect, it } from 'vitest';
import { FRAMES, frameOf, type FrameId } from '../shared/src/japanese/frames.js';

const of = (kana: string, text = kana) => frameOf({ text, kana });

describe('sentence frames', () => {
  it('finds the frame of each beginner phrase', () => {
    const cases: [string, FrameId][] = [
      ['わたしは アキです。', 'wa-desu'],
      ['これは コーヒーです', 'wa-desu'],
      ['これは コーヒーじゃないです。', 'ja-nai'],
      ['きょうとゆきは、にばんせんではありません。', 'ja-nai'],
      ['はい、そうです。', 'sou'],
      ['いいえ、ちがいます。', 'sou'],
      ['コーヒーを ください。', 'kudasai'],
      ['すみませんコーヒーをおねがいします', 'kudasai'],
      ['おにぎり みっつ、おねがいします', 'kudasai'],
      ['すみません、えきは どこですか。', 'doko'],
      ['しゅみは なんですか。', 'nan'],
      ['ねこが だいすきです。', 'suki'],
      ['あそこにねこがいます', 'ni-aru'],
      ['ペットボトルが十本あります。', 'ni-aru'],
      ['さんびゃくきゅうじゅうえんです。', 'desu'],
      ['すしを たべます。', 'o-masu'],
      ['えいがを みました。', 'mashita'],
      ['きょうとに いきたいです。', 'tai'],
      ['たべたい！', 'tai'],
      ['まって ください。', 'te-kudasai'],
      ['いっしょに たべませんか。', 'masen-ka'],
      ['しゃしんを とっても いいですか。', 'te-mo-ii'],
    ];
    for (const [kana, frame] of cases) expect([kana, of(kana)]).toEqual([kana, frame]);
  });

  it('reads the written text too', () => {
    expect(of('えきは どこですか', '駅は 何処ですか')).toBe('doko');
    expect(of('', '写真を 撮っても 良いですか')).toBe('te-mo-ii');
  });

  it('leaves out look-alikes', () => {
    const none = [
      'はじめまして', // は that isn't the topic marker
      'けいたい',
      'そうですね、', // a filler
      'そうですか… ざんねん。',
      'よろしく おねがいします。', // a set phrase, not an order
      'すみません',
      'ねこが たべています。', // doing, not "there is"
      'こんにちは',
      'ありがとうございます。',
      'おはようございます。',
    ];
    for (const kana of none) expect([kana, of(kana)]).toEqual([kana, null]);
    expect(of('あたまが いたいです。')).toBe('desu'); // it hurts, not "want to"
    expect(of('しーん… だんなさんの へんじみたいです。')).toBe('desu'); // looks like
    expect(of('みずが つめたいです。')).toBe('desu'); // cold, not "want to"
    expect(of('おなかが すきました！')).toBe('mashita'); // hungry (past), not "like"
    expect(of('ドアが しまります。ごじょうしゃ ください。')).not.toBe('kudasai');
    expect(of('{stop}です。おわすれもの ありませんか？')).not.toBe('masen-ka');
  });

  // The Japanese review's misfires (docs/progressive-learning.md): real lines that got the wrong frame, or
  // none when they should have had one. Lines marked (probe) were written to show the same pattern.
  it('fixes the lines the Japanese review found', () => {
    const cases: [string, FrameId | null][] = [
      ['つめたくないです', null], // isn't cold, not "want to"
      ['いたくないです', null], // (probe) doesn't hurt
      ['はい、おねがいします。', null], // yes please: taking an offer, not asking for a thing
      ['わたしの ＿を たべないで ください', null], // please don't: the opposite of 〜て ください
      ['はいらないで ください', null],
      ['ゆうれいは よる、ひとりで ＿を たべて いるそうです。', null], // hearsay, not "A is B"
      ['あめが ふるそうです', null], // (probe) hearsay, not "It's ___"
      ['いぬを かっています。', null], // a state (〜て います), not "I do ___"
      ['ゆうきが ある ひと、だいすき！', null], // ある in a relative clause, not "there is"
      ['わたしは学生です。', 'wa-desu'], // unspaced, as Last Train writes it
      ['これはわたしのかばんです。', 'wa-desu'],
      ['はじめまして。アキです。よろしく おねがいします。', 'desu'], // Nice to Meet You!'s greeting
      ['それは ちがいます', 'sou'], // (probe)
      ['つめたかったです。', null], // past adjective: "It's ___" would gloss it wrongly
      ['すきですか。', 'ka'], // Who's the Tourist?'s questions
      ['たのしいですか。', 'ka'],
      ['よく きますか。', 'ka'],
      ['ここは すきですか。', 'ka'],
    ];
    for (const [kana, frame] of cases) expect([kana, of(kana)]).toEqual([kana, frame]);
    expect(of('わたしは がくせいです。', 'わたしは学生です。')).toBe('wa-desu');
    expect(of('いぬを かっています。', '犬を 飼っています。')).toBe(null);
    expect(of('{name}さんは ねこが だいすきです。')).toBe('suki');
    // Each sentence on its own: the second one here is a real "no, it isn't".
    expect(of('わたしの スプーン？　ちがいます！')).toBe('sou');
  });

  it('gives each frame an example built on that frame', () => {
    for (const f of FRAMES) expect([f.id, of(f.example.ja)]).toEqual([f.id, f.id]);
  });
});
