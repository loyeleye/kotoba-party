import { describe, expect, it } from 'vitest';
import { duelStats, scoreComment, type TakeView } from '../shared/src/modes/karaokeDuel/karaokeDuel.js';

const take = (o: Partial<TakeView>): TakeView => ({ turnNo: 0, line: 0, playerId: 'a', via: 'speech', quality: 80, pron: 0.8, pitch: 0.7, timing: 0.9, pitchUsed: true, points: 80, missed: false, ...o });

describe('Karaoke Duel result stats', () => {
  it('averages each part over the takes that measured it', () => {
    const s = duelStats(
      [
        take({ pron: 0.9, pitch: 0.6, timing: 1, quality: 90 }),
        take({ pron: 0.7, pitch: null, pitchUsed: false, timing: 0.8, quality: 70 }),
        take({ via: 'typed', pron: 0.5, pitch: null, pitchUsed: false, timing: null, quality: 25 }),
        take({ playerId: 'b', pron: 0, pitch: 0, timing: 0, quality: 0 }),
      ],
      'a',
    );
    expect(s).toEqual({ words: 70, pitch: 60, timing: 90, average: 62, takes: 3 });
  });

  it('counts a missed line as zero words, and measures nothing for "I sang it"', () => {
    const s = duelStats([take({ missed: true, via: null, pron: 0, pitch: null, pitchUsed: false, timing: null, quality: 0 }), take({ via: 'tap', pron: 0, pitch: null, pitchUsed: false, timing: null, quality: 30 })], 'a');
    expect(s).toEqual({ words: 0, pitch: null, timing: null, average: 15, takes: 2 });
    expect(duelStats([], 'a')).toEqual({ words: null, pitch: null, timing: null, average: 0, takes: 0 });
  });

  it('picks the host comment by score band, with readings for its kanji', () => {
    expect(scoreComment(95, 6).en).toBe('Amazing! Like a pro!');
    expect(scoreComment(82, 6)).toMatchObject({ text: 'とても 上手！', kana: 'とても じょうず！' });
    expect(scoreComment(55, 6).furigana).toContainEqual(['調子', 'ちょうし']);
    expect(scoreComment(10, 6).text).toBe('次は がんばろう！');
    expect(scoreComment(0, 0).text).toBe('声が きこえなかった よ');
    for (const avg of [0, 10, 35, 55, 75, 85, 95]) {
      const c = scoreComment(avg, 6);
      expect(c.furigana!.map(([base]) => base).join('')).toBe(c.text);
    }
  });
});
