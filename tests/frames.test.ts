// Sentence frames (shared/src/japanese/frames.ts): each phrase gets the frame it's built on, the most
// specific one first, and the game's own look-alike lines get none (docs/progressive-learning.md).

import { describe, expect, it } from 'vitest';
import { createReader } from '../server/src/reading.js';
import { ALL_FRAMES, creditable, FRAME_BY_ID, FRAMES, frameOf, framesOf, type FrameId } from '../shared/src/japanese/frames.js';
import { cases as n4a } from './frame-cases/n4-a.js';
import { cases as n4b } from './frame-cases/n4-b.js';
import { cases as n4c } from './frame-cases/n4-c.js';
import { cases as n4d } from './frame-cases/n4-d.js';
import { cases as n3a } from './frame-cases/n3-a.js';
import { cases as n3b } from './frame-cases/n3-b.js';
import { cases as n3c } from './frame-cases/n3-c.js';
import { cases as n5existing } from './frame-cases/n5-existing.js';
import { cases as n5new } from './frame-cases/n5-new.js';
import { probes } from './frame-cases/panel-probes.js';
import type { CaseLine, FrameCases } from './frame-cases/types.js';

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
    // N4 favours, not invitations (the tiered path's 5.9).
    expect(of('ペンを かして くれませんか。')).not.toBe('masen-ka');
    expect(of('もう いちど いって いただけませんか。')).not.toBe('masen-ka');
    expect(of('しゃしんを とって もらえませんか。')).not.toBe('masen-ka');
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

  it('gives a favour request no chip rather than a plain question chip', () => {
    // ＿て くれませんか is not an invitation (＿ませんか), and calling it ＿ますか "Do you ___?" fits worse.
    for (const kana of ['ちょっと てつだって くれませんか。', 'もう いちど いって いただけませんか。', 'まどを あけて もらえますか。']) {
      expect([kana, of(kana)]).toEqual([kana, null]);
    }
    expect(of('ゆっくり はなして くださいませんか。')).toBe('te-kudasai');
    expect(of('いっしょに たべませんか。')).toBe('masen-ka');
  });
});

// ---- framesOf: every frame in a line, with the precision bar (docs/n4-n3-frames.md) ----
// Each matcher must find its frame in at least 10 positive lines and in none of 10 look-alikes. The lines
// live in tests/frame-cases/ (real game lines where the game has them, marked probes otherwise). Lines
// are read with kuromoji tokens, as the server reads them.

const reader = (await createReader())!;
const cases: FrameCases = { ...n5existing, ...n5new, ...n4a, ...n4b, ...n4c, ...n4d, ...n3a, ...n3b, ...n3c };
const line = (l: CaseLine) => (typeof l === 'string' ? { text: l, kana: l } : l);

describe('every frame in a line (framesOf)', () => {
  const all = (l: CaseLine) => {
    const p = line(l);
    return framesOf(p, reader.tokens(p.text));
  };

  it('has 10 positives and 10 look-alikes for every frame', () => {
    for (const f of ALL_FRAMES) {
      const c = cases[f.id];
      expect([f.id, c?.pos.length ?? 0, c?.neg.length ?? 0]).toEqual([f.id, expect.any(Number), expect.any(Number)]);
      expect([f.id, (c?.pos.length ?? 0) >= 10, (c?.neg.length ?? 0) >= 10]).toEqual([f.id, true, true]);
    }
  });

  for (const f of ALL_FRAMES) {
    it(`${f.id}: finds it in every positive and in no look-alike`, () => {
      const c = cases[f.id]!;
      // Positives are counted the way progress counts (keepHidden), so a frame shown under a more specific one
      // still passes. Look-alikes must stay out with tokens and on the phone, which has none (panel on #148).
      const counted = (l: CaseLine) => {
        const p = line(l);
        return framesOf(p, reader.tokens(p.text), { keepHidden: true });
      };
      const missed = c.pos.filter((l) => !counted(l).includes(f.id)).map((l) => line(l).text);
      const wrong = c.neg.filter(([l]) => all(l).includes(f.id) || framesOf(line(l)).includes(f.id)).map(([l, why]) => `${line(l).text} (${why})`);
      expect({ missed, wrong }).toEqual({ missed: [], wrong: [] });
    });
  }

  it('gets fresh lines from the Japanese review right, with and without tokens', () => {
    const bad: string[] = [];
    for (const p of probes) {
      const l = line(p.line);
      const withTok = all(p.line);
      const phone = framesOf(l);
      for (const id of p.not) if (withTok.includes(id as FrameId) || phone.includes(id as FrameId)) bad.push(`${l.text}: not ${id}`);
      for (const id of p.want ?? []) if (!withTok.includes(id as FrameId)) bad.push(`${l.text}: wants ${id}`);
    }
    expect(bad).toEqual([]);
  });

  // Speech comes back from the recognizer with kanji and no spaces. Every N3 positive with kanji, spaces taken
  // out and its kana read by the dictionary, still has its frame. Kana-only lines with no spaces are a known gap
  // (docs/n4-n3-frames.md): the phone sends them spaced.
  it('finds N3 frames in written lines with no spaces', () => {
    const missed: string[] = [];
    for (const [id, { pos }] of Object.entries({ ...n3a, ...n3b, ...n3c })) {
      for (const p of pos) {
        if (typeof p === 'string') continue;
        const text = p.text.replace(/[\s　]/g, '');
        const l = { text, kana: reader(text) };
        if (!framesOf(l, reader.tokens(text), { keepHidden: true }).includes(id as FrameId)) missed.push(`${id}: ${text}`);
      }
    }
    expect(missed).toEqual([]);
  });

  it("finds each frame's own example", () => {
    for (const f of ALL_FRAMES) expect([f.id, all(f.example.ja).includes(f.id)]).toEqual([f.id, true]);
  });

  it('names every frame in a line, the specific one over the general', () => {
    // The suffering passive is shown over the plain passive chip (one chip for one verb); counting keeps both.
    const rain = { text: '雨に降られたので、遅れました。', kana: 'あめに ふられたので、おくれました。' };
    expect(all(rain)).toEqual(expect.arrayContaining(['mashita', 'suffering-passive', 'node']));
    expect(all(rain)).not.toContain('passive');
    expect(framesOf(rain, reader.tokens(rain.text), { keepHidden: true })).toEqual(expect.arrayContaining(['passive', 'suffering-passive']));
    // While N3 can't be credited, the recap (only creditable frames) still shows the N4 chips the N3 ones hide.
    expect(framesOf(rain, reader.tokens(rain.text), { only: creditable })).toEqual(expect.arrayContaining(['passive', 'node']));
    const scold = 'ははに ゲームを すてられた！';
    expect(framesOf({ text: scold, kana: scold }, reader.tokens(scold), { only: creditable })).toContain('passive');
    const orimasu = 'いま、でかけて おります。';
    expect(framesOf({ text: orimasu, kana: orimasu }, undefined, { only: creditable })).toContain('keigo');
    expect(all('まどを あけて もらえますか。')).not.toContain('ka');
    // 3.8's ＿て おります and ＿で ございます are shown over the keigo-verb chip (4.9); counting keeps it (panel on #149).
    for (const k of ['おまち して おります。', 'こちらが おへやで ございます。']) {
      expect(all(k)).not.toContain('keigo');
      expect(framesOf({ text: k, kana: k }, reader.tokens(k), { keepHidden: true })).toContain('keigo');
    }
    // Casual ＿みたい (3.1) is shown over ＿みたいです (4.6); counting keeps both, and ＿みたいです alone isn't casual.
    const kept = (k: string) => framesOf({ text: k, kana: k }, reader.tokens(k), { keepHidden: true });
    expect(all('でんぱが わるいみたい。')).toEqual(['mitai-casual']);
    expect(kept('でんぱが わるいみたい。')).toEqual(expect.arrayContaining(['mitai-casual', 'mitai-you']));
    expect(kept('でんぱが わるい みたいです。')).not.toContain('mitai-casual');
    // Every suffering passive counts as a passive too, with tokens and on the phone (JLPT seat on #153).
    for (const k of ['さいふを ぬすまれました。', 'あしを ふまれました。', 'ともだちに こられて、こまった。', 'あめに ふられました。']) {
      expect([k, kept(k).includes('passive')]).toEqual([k, true]);
      expect([k, framesOf({ text: k, kana: k }, undefined, { keepHidden: true }).includes('passive')]).toEqual([k, true]);
    }
    expect(all('しゃしんを とっても いいですか。')).toEqual(['te-mo-ii']);
    expect(all('はじめまして。アキです。よろしく おねがいします。')).toEqual(['desu']);
  });

  it('keeps the general frames for counting progress when asked', () => {
    expect(all('この おべんとうは いくらですか。')).not.toContain('ka');
    const p = { text: 'この おべんとうは いくらですか。', kana: 'この おべんとうは いくらですか。' };
    expect(framesOf(p, reader.tokens(p.text), { keepHidden: true })).toEqual(expect.arrayContaining(['ka', 'ikura']));
  });

  it('has one frame per id, and every id the tiered path asks for', () => {
    expect(new Set(ALL_FRAMES.map((f) => f.id)).size).toBe(ALL_FRAMES.length);
    for (const f of ALL_FRAMES) expect(FRAME_BY_ID[f.id]).toBe(f);
    // The ids the tiered path's goals count (agreed with that work); a rename there must land here too.
    const path: Record<'n5' | 'n4' | 'n3', FrameId[]> = {
      n5: ['ikura', 'ji-fun', 'ni-masu', 'youbi', 'gatsu-nichi', 'wa-ni-aru', 'migi-hidari', 'hoshii', 'de-o', 'te-iru', 'no', 'adj-desu', 'kunai', 'kara', 'hou-ga', 'mashou', 'naide-kudasai'],
      n4: ['te-moraeru', 'ageru-kureru', 'te-wa-ikenai', 'nakereba', 'ta-koto', 'te-miru', 'te-shimau', 'potential', 'tara', 'ba', 'toki', 'sou-look', 'to-omou', 'kamo', 'you-to-omou', 'tsumori', 'hou-ga-ii', 'plain', 'n-da', 'o-kudasai', 'te-itadakemasen',
        // The N4 frames the goals left out at first, optional on 4.1, 4.2, 4.3, 4.6 and 4.9 (Ladi, Nov 1).
        'te-hoshii', 'causative', 'sasete-kudasai', 'ba-yokatta', 'tari-tari', 'mitai-you', 'n-desu'],
      // The Limited Express's goals 3.1 to 3.11 (the plan doc's table; the path and Yōkai Court name them). のに,
      // the reason ため and ＿ば よかった count on N3 goals too but are N4 or step-1 frames.
      n3: ['rashii', 'uchi-ni', 'tame-reason', 'mitai-casual', 'suffering-passive', 'saserareru', 'tokoro-deshita', 'sasete-morau', 'sei-de', 'okage-de', 'wake-desu',
        'wari-ni', 'kuse-ni', 'ni-kurabete', 'to-shitara', 'ba-hodo', 'you-to-suru', 'zu-ni', 'koto-ni-shiteiru', 'ta-tsumori', 'wake-dewa-nai', 'beki', 'to-iu-koto',
        'to-shite', 'toori-ni', 'sasete-itadaku', 'de-gozaimasu', 'te-orimasu', 'go-kudasai', 'kashikomarimashita', 'tabi-ni', 'saichuu-ni', 'te-kita', 'you-na-ki',
        'ni-chigainai', 'ni-taishite', 'shika-nai', 'sorenanoni', 'tsumari', 'ppoi', 'nante', 'toka', 'jan', 'kke'],
    };
    // ＿じゃん and ＿っけ count for listening only (the plan's 3.11); every other frame can be said.
    expect(ALL_FRAMES.filter((f) => f.listening).map((f) => f.id)).toEqual(['jan', 'kke']);
    for (const [level, ids] of Object.entries(path)) {
      for (const id of ids) expect([id, FRAME_BY_ID[id]?.level]).toEqual([id, level]);
    }
  });

  // The Japanese and JLPT seats on #146: frames that counted when hidden frames are kept for progress.
  it('counts no hidden frame the line does not have', () => {
    const counted = (k: string) => framesOf({ text: k, kana: k }, reader.tokens(k), { keepHidden: true });
    expect(counted('くつを ぬがなくても いいですか。')).not.toContain('te-mo-ii');
    expect(counted('すこし やすんだら どうですか。')).not.toContain('tara');
    expect(counted('しゅくだいを しないと いけませんか。')).not.toContain('masen-ka');
    expect(counted('ごめんなさいと いったら どうですか。')).not.toContain('to-itte-ita');
    expect(counted('にほんごが できます。')).not.toContain('potential');
  });

  it('leaves out the frames that need part of speech when there are no tokens', () => {
    // Ichidan られる is the passive or "can": only the dictionary (and someone doing it, ねこに) tells them apart.
    expect(framesOf({ text: 'ねこに たべられました。', kana: 'ねこに たべられました。' })).not.toContain('passive');
    expect(all('猫に食べられました。')).toContain('passive');
    // …but with a を object it can't be "can" (that takes が).
    // (It's also the suffering passive, shown over it; counting keeps the passive.)
    expect(framesOf({ text: 'ねこに さかなを たべられました。', kana: 'ねこに さかなを たべられました。' }, undefined, { keepHidden: true })).toContain('passive');
    expect(all('ここに いられます。')).not.toContain('passive');
    // A godan passive is spelled out, so it counts without tokens.
    expect(framesOf({ text: 'ははに しかられました。', kana: 'ははに しかられました。' })).toContain('passive');
    expect(framesOf({ text: 'まどを あけて もらえますか。', kana: 'まどを あけて もらえますか。' })).toContain('te-moraeru');
  });
});
