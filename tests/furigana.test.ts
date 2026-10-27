import { describe, expect, it } from 'vitest';
import { LYRIC_SETS } from '../shared/src/modes/karaokeDuel/lyrics/index.js';
import { SONGS } from '../shared/src/modes/karaokeDuel/songs.js';
import { autoFurigana } from '../shared/src/japanese/furigana.js';
import { hasKanji } from '../shared/src/japanese/kana.js';

const read = (text: string, kana: string) => autoFurigana(text, kana)?.filter(([, r]) => r);

describe('autoFurigana', () => {
  it('lines kanji up with their kana', () => {
    expect(autoFurigana('お会計、お願いします', 'おかいけい、おねがいします')).toEqual([['お', ''], ['会計', 'かいけい'], ['、お', ''], ['願', 'ねが'], ['いします', '']]);
  });

  it('skips punctuation the reading leaves out', () => {
    expect(read('「お弁当 忘れたよ！」', 'おべんとう わすれたよ')).toEqual([['弁当', 'べんとう'], ['忘', 'わす']]);
    expect(read('あれ？ この 道', 'あれ この みち')).toEqual([['道', 'みち']]);
  });

  it('keeps each kanji word inside its own word of the reading', () => {
    expect(read('一人 泣くの', 'ひとり なくの')).toEqual([['一人', 'ひとり'], ['泣', 'な']]);
    expect(read('火曜日 水曜日', 'かようび すいようび')).toEqual([['火曜日', 'かようび'], ['水曜日', 'すいようび']]);
    expect(read('一 二 三 四 五', 'いち に さん し ご')).toEqual([['一', 'いち'], ['二', 'に'], ['三', 'さん'], ['四', 'し'], ['五', 'ご']]);
  });

  it('splits evenly when nothing else anchors the reading', () => {
    expect(read('「次は池袋、池袋。」', 'つぎは いけぶくろ、いけぶくろ')).toEqual([['次', 'つぎ'], ['池袋', 'いけぶくろ'], ['池袋', 'いけぶくろ']]);
    expect(read('祖母は 八十さい', 'そぼは はちじゅっさい')).toEqual([['祖母', 'そぼ'], ['八十', 'はちじゅっ']]);
  });

  it('gives up on a reading that is not the text’s', () => {
    expect(autoFurigana('東京へ', 'おおさかに')).toBeNull();
  });

  it('reads every Karaoke Duel line and title that has kanji', () => {
    for (const song of SONGS) {
      const lines = [song.title, ...song.lines, ...(LYRIC_SETS[song.id] ?? []).flatMap((set) => set.lines)];
      for (const line of lines) if (hasKanji(line.text)) expect(autoFurigana(line.text, line.kana), line.text).not.toBeNull();
    }
  });
});
