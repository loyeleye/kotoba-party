import { describe, expect, it } from 'vitest';
import {
  differsOnlyInLength,
  expandLongMarks,
  isSpeakableKana,
  looseKana,
  nameToKana,
  normalizeKana,
  numberToKana,
  readNumbers,
  toHiragana,
} from '../kana.js';

describe('kana helpers', () => {
  it('converts katakana and expands long marks', () => {
    expect(toHiragana('コーヒー')).toBe('こーひー');
    expect(expandLongMarks('こーひー')).toBe('こおひい');
    expect(normalizeKana('コーヒー、ください！')).toBe('こおひいください');
  });

  it('reads numbers aloud', () => {
    expect(numberToKana(350)).toBe('さんびゃくごじゅう');
    expect(numberToKana(1000)).toBe('せん');
    expect(numberToKana(3800)).toBe('さんぜんはっぴゃく');
    expect(numberToKana(600)).toBe('ろっぴゃく');
    expect(numberToKana(12000)).toBe('いちまんにせん');
    expect(readNumbers('三百五十円')).toBe('さんびゃくごじゅうえん');
    expect(readNumbers('350円')).toBe('さんびゃくごじゅうえん');
    expect(readNumbers('4円')).toBe('よえん');
    expect(readNumbers('9時')).toBe('くじ');
    expect(readNumbers('3分')).toBe('さんぷん');
    expect(readNumbers('2人')).toBe('ふたり');
    expect(readNumbers('一緒')).toBe('一緒');
  });

  it('folds particle spellings and long-vowel spellings in the loose form', () => {
    expect(looseKana('わたしわ がくせいです')).toBe(looseKana('わたしは がくせいです'));
    expect(looseKana('とおきょう')).toBe(looseKana('とうきょう'));
    expect(looseKana('すしお たべます')).toBe(looseKana('すしを たべます'));
  });

  it('spots length and small っ differences', () => {
    expect(differsOnlyInLength('おばさん', 'おばあさん')).toBe(true);
    expect(differsOnlyInLength('きて', 'きって')).toBe(true);
    expect(differsOnlyInLength('びる', 'びいる')).toBe(true);
    expect(differsOnlyInLength('ねこ', 'いぬ')).toBe(false);
  });

  it('accepts only kana as speakable', () => {
    expect(isSpeakableKana('いっぽん！すごい！')).toBe(true);
    expect(isSpeakableKana('一本！')).toBe(false);
    expect(isSpeakableKana('ippon')).toBe(false);
    expect(isSpeakableKana('100えん')).toBe(false);
  });

  it('guesses how a nickname sounds', () => {
    expect(nameToKana('Ladi')).toBe('ラディ');
    expect(nameToKana('Ken')).toBe('ケン');
    expect(nameToKana('Sakura')).toBe('サクラ');
    expect(nameToKana('ゆき')).toBe('ゆき');
  });
});
