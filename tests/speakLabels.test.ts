import { describe, expect, it } from 'vitest';
import { createReader } from '../server/src/reading.js';
import { heardRomaji, levelText, tapWording } from '../controller/src/components/speakLabels.js';

describe('speaking prompt wording by level', () => {
  it('stays English at kana level, with romaji instead of kana', () => {
    expect(levelText('Hold and say it 🎤', 'kana')).toEqual({ main: 'Hold and say it 🎤', ja: false });
    expect(levelText('Hold and say こんにちは', 'kana').main).toBe('Hold and say “konnichiwa”');
    expect(levelText('Hold and say ラーメン', 'kana').main).toBe('Hold and say “rāmen”');
    expect(levelText('Hold and say a word starting with しゃ', 'kana').main).toBe('Hold and say a word starting with “sha”');
  });

  it('leads with spaced hiragana at N5 and plain Japanese at N4', () => {
    expect(levelText('Hold and say your answer', 'n5')).toEqual({ main: 'おしながら こたえを いって', sub: 'Hold and say your answer', ja: true });
    expect(levelText('Hold and say your answer', 'n4')).toEqual({ main: '押しながら答えを言って', ja: true });
  });

  it('fills in the word to say and keeps a trailing emoji', () => {
    expect(levelText('Hold and say こんにちは', 'n5').main).toBe('おしながら「こんにちは」と いって');
    expect(levelText('Hold and say a word starting with ん', 'n4').main).toBe('押しながら「ん」で始まる言葉を言って');
    expect(levelText('Hold and say it 🎤', 'n4').main).toBe('押しながら言って 🎤');
  });

  it('leaves unknown labels alone', () => {
    expect(levelText('Hold and say Tokyo', 'n4')).toEqual({ main: 'Hold and say Tokyo', ja: false });
  });
});

describe('romaji after "Heard:" for かな players', () => {
  it('reads kana straight, with greetings said as they sound', () => {
    expect(heardRomaji({ text: 'こんにちは' })).toBe('konnichiwa');
    expect(heardRomaji({ text: 'こんばんは。' })).toBe('Konbanwa.');
    expect(heardRomaji({ text: 'ラーメン' })).toBe('rāmen');
  });

  it('uses the server word split, so kanji get read and words get spaced', async () => {
    const reader = (await createReader())!;
    const romaji = (text: string) => heardRomaji({ text, tokens: reader.tokens(text) });
    expect(romaji('こんにちは。')).toBe('Konnichiwa.');
    expect(romaji('私は学生です。')).toBe('Watashi wa gakusei desu.');
    expect(romaji('昨日すしを食べました')).toBe('kinō sushi o tabemashita');
    expect(romaji('ありがとうございます')).toBe('arigatō gozaimasu');
    expect(romaji('行ってきます')).toBe('itte kimasu');
  }, 20_000);

  it('leaves it out when kanji are left that nothing read', () => {
    expect(heardRomaji({ text: '学生です' })).toBeUndefined();
    expect(heardRomaji({ text: '...' })).toBeUndefined();
  });
});

describe('tap-to-talk wording', () => {
  it('swaps holding for tapping at every level', () => {
    expect(tapWording(levelText('Hold and say it 🎤', 'kana')).main).toBe('Tap and say it 🎤');
    expect(tapWording(levelText('Hold and say your answer', 'n5'))).toEqual({ main: 'タップして こたえを いって', sub: 'Tap and say your answer', ja: true });
    expect(tapWording(levelText('Hold and say こんにちは', 'n4')).main).toBe('タップして「こんにちは」と言って');
  });
  it('leaves labels without a hold alone', () => {
    expect(tapWording(levelText('Send', 'n5'))).toEqual(levelText('Send', 'n5'));
    expect(tapWording(levelText('Holder', 'kana')).main).toBe('Holder');
  });
});
