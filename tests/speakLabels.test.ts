import { describe, expect, it } from 'vitest';
import { levelText } from '../controller/src/components/speakLabels.js';

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
