// Word Gauntlet on the stage: the obscure word and its fakes, the telephone's drift, and the
// shiritori chain. Nothing private is drawn: fakes stay hidden until the reveal, authors until
// the score, telephone steps until the end.

import { h, ruby } from '../../../shared/src/dom.js';
import type { JpText } from '../../../content/src/types.js';
import type { WordGauntletView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const nameOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? '(left)';

// The stage redraws on every update, so staggered reveals are timed from when this phase
// first showed: an element whose moment has passed appears at once instead of replaying.
let phaseShown = { seq: -1, at: 0 };
function delay(view: RoomView, ms: number): string {
  if (phaseShown.seq !== view.phaseSeq) phaseShown = { seq: view.phaseSeq, at: performance.now() };
  return `animation-delay:${Math.round(ms - (performance.now() - phaseShown.at))}ms`;
}

export const wordGauntletStage: StageMode<WordGauntletView> = {
  badge(game, id) {
    const f = game.fake;
    if (f) return f.options ? (f.picked.includes(id) ? '✓' : '') : f.submitted.includes(id) ? '✎' : '';
    const t = game.telephone;
    if (t) {
      const i = t.order.findIndex((o) => o.playerId === id);
      if (t.reveal) return t.voted.includes(id) ? '✓' : '';
      if (i === t.current) return '▶';
      return t.order[i]?.done ? '✓' : '';
    }
    const sh = game.shiritori;
    if (sh) {
      if (sh.winnerId === id) return '★';
      if (sh.turn === id) return '▶';
      if (!sh.alive.includes(id)) return '✗';
      return '';
    }
    return '';
  },

  render(view, game) {
    if (view.phase === 'intro' || !game.segment) return intro(view);
    if (game.segment === 'fake') return fake(view, game);
    if (game.segment === 'telephone') return telephone(view, game);
    return shiritori(view, game);
  },
};

function intro(view: RoomView): HTMLElement {
  const step = (n: number, title: string, ja: string, blurb: string) =>
    h('li', { class: 'wg-round', style: delay(view, (n - 1) * 1200) }, h('span', { class: 'wg-num' }, String(n)), h('div', {}, h('p', { class: 'wg-round-title' }, title, ' ', h('span', { lang: 'ja' }, ja)), h('p', { class: 'hint' }, blurb)));
  return h(
    'div',
    { class: 'card wg' },
    h('p', { class: 'big', lang: 'ja' }, 'ことばの関門'),
    h('p', { class: 'subtitle' }, 'Word Gauntlet: three rounds, one champion'),
    h(
      'ol',
      { class: 'wg-rounds' },
      step(1, 'Kanji Bluff', 'ほんもの？ うそ？', 'A real but obscure word: invent a meaning for it, then find the true one.'),
      step(2, 'Lost in Translation', 'でんごん', 'One sentence, passed around in Japanese and English. Double points.'),
      step(3, 'Shiritori Showdown', 'しりとり', 'Say a word from the last kana. ん and you’re out. Last one standing wins.'),
    ),
  );
}

function tag(text: string): HTMLElement {
  return h('p', { class: 'wg-tag' }, text);
}

/** The word with its reading over the right characters (木[こ]漏[も]れ日[び], never spread evenly). */
function bigWord(jp: { text: string; kana: string; furigana?: JpText['furigana'] }, en?: string): HTMLElement {
  const furigana = jp.furigana ?? (jp.kana !== jp.text ? [[jp.text, jp.kana] as [string, string]] : undefined);
  return h('div', { class: 'wg-word' }, ruby({ text: jp.text, furigana }, { class: 'wg-kanji' }), en ? h('p', { class: 'wg-meaning' }, en) : null);
}

// ---- Round 1 ----

function fake(view: RoomView, game: WordGauntletView): HTMLElement {
  const f = game.fake!;
  const label = tag(`Round 1 · Kanji Bluff · word ${f.index} of ${f.total}`);
  switch (view.phase) {
    case 'prompt':
    case 'answer':
      return h(
        'div',
        { class: 'card wg' },
        label,
        bigWord(f.word),
        h('p', { class: 'prompt small' }, 'What does it mean? Make up a meaning that sounds real.'),
        view.phase === 'answer' ? h('p', { class: 'hint' }, `${f.submitted.length} / ${view.players.length} fakes in`) : null,
      );
    case 'reveal':
      return h(
        'div',
        { class: 'card wg compact' },
        label,
        bigWord(f.word),
        h('p', { class: 'prompt small' }, 'One of these is real. Which one?'),
        h('ol', { class: 'answers wg-options wg-results' }, (f.options ?? []).map((o) => h('li', {}, o.text))),
        h('p', { class: 'hint' }, `${f.picked.length} / ${view.players.length} picks in`),
      );
    default: {
      const results = [...(f.results ?? [])].sort((a, b) => Number(b.real) - Number(a.real) || b.pickedBy.length - a.pickedBy.length);
      return h(
        'div',
        { class: 'card wg compact' },
        label,
        f.golden ? h('div', { class: 'wg-golden' }, h('p', { class: 'wg-golden-tag' }, 'Golden word · everyone, say it!'), bigWord(f.golden.jp, f.golden.jp.en), f.golden.literal ? h('p', { class: 'hint' }, `Literally: ${f.golden.literal}`) : null) : null,
        h(
          'ol',
          { class: 'answers results wg-results' },
          results.map((r) =>
            h(
              'li',
              { class: r.real ? 'winner' : '' },
              h('span', { class: 'text' }, r.text),
              h(
                'span',
                { class: 'by' },
                r.real ? 'REAL' : `by ${r.authors.map((a) => a.name).join(' & ') || '?'}`,
                r.pickedBy.length ? ` · picked by ${r.pickedBy.map((p) => p.name).join(', ')}` : ' · nobody fell for it',
              ),
            ),
          ),
        ),
        f.said.length ? h('p', { class: 'hint' }, `Said it: ${f.said.map((id) => nameOf(view, id)).join(', ')}`) : null,
      );
    }
  }
}

// ---- Round 2 ----

function telephone(view: RoomView, game: WordGauntletView): HTMLElement {
  const t = game.telephone!;
  const label = tag('Round 2 · Lost in Translation · double points');
  const lang = (to: 'en' | 'jp') => (to === 'en' ? 'EN' : 'JP');
  if (view.phase === 'prompt' || view.phase === 'answer') {
    return h(
      'div',
      { class: 'card wg' },
      label,
      h('p', { class: 'prompt small' }, 'A secret sentence travels around the room. Each player sees only the step before theirs.'),
      h(
        'ol',
        { class: 'wg-relay' },
        h('li', { class: 'wg-hop start' }, h('span', { class: 'wg-hop-name' }, 'ポン'), h('span', { class: 'wg-flag' }, 'JP')),
        t.order.map((o, i) =>
          h(
            'li',
            { class: `wg-hop ${i === t.current && view.phase === 'answer' ? 'live' : ''} ${o.done ? 'done' : ''} ${o.skipped ? 'skipped' : ''}` },
            h('span', { class: 'wg-hop-name' }, nameOf(view, o.playerId)),
            h('span', { class: 'wg-flag' }, o.skipped ? '–' : lang(o.to)),
          ),
        ),
      ),
      view.phase === 'answer' && t.order[t.current]
        ? h('p', { class: 'hint' }, `${nameOf(view, t.order[t.current]!.playerId)} is turning it into ${t.order[t.current]!.to === 'en' ? 'English' : 'Japanese'}…`)
        : null,
    );
  }
  const reveal = t.reveal!;
  const scored = view.phase === 'score' && t.votes;
  const best = scored ? Math.max(0, ...t.votes!) : 0;
  return h(
    'div',
    { class: `card wg ${reveal.steps.length >= 3 ? 'compact' : ''}` },
    label,
    h(
      'ol',
      { class: 'wg-drift' },
      h('li', { class: 'wg-drift-step start' }, h('span', { class: 'wg-flag' }, 'JP'), h('div', {}, h('p', { class: 'wg-drift-text', lang: 'ja' }, reveal.starter.text), h('p', { class: 'hint' }, `Start · ${reveal.starter.en}`))),
      reveal.steps.map((st, i) =>
        h(
          'li',
          {
            class: `wg-drift-step ${st.skipped ? 'skipped' : ''} ${scored && t.votes![i]! > 0 && t.votes![i] === best ? 'winner' : ''}`,
            style: view.phase === 'reveal' ? delay(view, (i + 1) * t.revealStepMs) : null,
          },
          h('span', { class: 'wg-flag' }, lang(st.to)),
          h(
            'div',
            {},
            h('p', { class: 'wg-drift-text', lang: st.to === 'jp' ? 'ja' : 'en' }, st.skipped ? '(lost in the post)' : (st.text ?? '')),
            h('p', { class: 'hint' }, nameOf(view, st.playerId), st.reading && st.reading !== st.text ? ` · ${st.reading}` : '', scored ? ` · ${t.votes![i]} vote${t.votes![i] === 1 ? '' : 's'}` : ''),
          ),
        ),
      ),
    ),
    view.phase === 'reveal' ? h('p', { class: 'hint' }, `Vote for your favourite step on your phone · ${t.voted.length} in`) : null,
  );
}

// ---- Round 3 ----

function shiritori(view: RoomView, game: WordGauntletView): HTMLElement {
  const sh = game.shiritori!;
  const label = tag('Round 3 · Shiritori Showdown');
  if (view.phase === 'prompt') {
    return h(
      'div',
      { class: 'card wg' },
      label,
      h('p', { class: 'big', lang: 'ja' }, 'しりとり → り'),
      h(
        'ul',
        { class: 'wg-rules' },
        h('li', {}, 'Start your word with the last kana of the one before: りんご → ごりら → らっぱ'),
        h('li', {}, 'End on ん and you’re out. No repeats. The timer shrinks every lap.'),
        h('li', { lang: 'ja' }, 'ー → the kana before it (コーヒー → ひ) · small kana count big (きしゃ → や) · か = が'),
        h('li', {}, 'Earlier points became time and hint tokens. Knocked-out players judge odd words.'),
      ),
    );
  }
  const chain = sh.chain.slice(-7);
  const chainEl = h(
    'ol',
    { class: 'wg-chain' },
    chain.map((w, i) => h('li', i === chain.length - 1 ? { class: 'latest', style: delay(view, 0) } : {}, h('span', { lang: 'ja' }, w.text), h('small', {}, w.playerId ? nameOf(view, w.playerId) : 'ポン'))),
  );
  const players = h(
    'ul',
    { class: 'wg-alive' },
    view.players.map((p) => {
      const out = sh.out.find((o) => o.playerId === p.id);
      return h(
        'li',
        { class: `${sh.turn === p.id ? 'live' : ''} ${out ? 'out' : ''} ${sh.winnerId === p.id ? 'winner' : ''}` },
        p.name,
        out ? h('small', {}, out.reason === 'n' ? ` ✗ ${out.word ?? ''} (ん)` : out.reason === 'timeout' ? ' ✗ time' : out.reason === 'rejected' ? ` ✗ ${out.word ?? ''}` : ' ✗') : null,
      );
    }),
  );
  if (view.phase === 'reveal' && sh.challenge) {
    const c = sh.challenge;
    return h(
      'div',
      { class: 'card wg' },
      label,
      chainEl,
      h('p', { class: 'prompt' }, `${nameOf(view, c.playerId)} says `, h('span', { class: 'wg-challenged', lang: 'ja' }, c.text)),
      h('p', { class: 'prompt small' }, 'Is that a word? The judges decide · a tie lets it through'),
      h('p', { class: 'hint' }, `Judges: ${c.voters.map((id) => nameOf(view, id)).join(', ') || 'nobody'} · ${c.voted.length} / ${c.voters.length} voted`),
    );
  }
  if (view.phase === 'score') {
    const words = sh.chain.filter((w) => w.playerId === sh.winnerId).length;
    return h(
      'div',
      { class: 'card wg' },
      label,
      sh.winnerId ? h('p', { class: 'big wg-crown' }, `しりとり王 · ${nameOf(view, sh.winnerId)}`) : h('p', { class: 'big' }, 'Nobody left standing!'),
      sh.winnerId ? h('p', { class: 'hint' }, `${words} word${words === 1 ? '' : 's'} · +${sh.crown} for the crown`) : null,
      chainEl,
      h('p', { class: 'hint' }, `${sh.chain.length - 1} words in the chain`),
    );
  }
  return h(
    'div',
    { class: 'card wg' },
    label,
    chainEl,
    h('p', { class: 'wg-need-line' }, sh.turn ? `${nameOf(view, sh.turn)}, a word starting with ` : 'Next: ', h('span', { class: 'wg-need', lang: 'ja' }, sh.needOptions.join(' / '))),
    lastEvent(view, sh),
    players,
  );
}

function lastEvent(view: RoomView, sh: NonNullable<WordGauntletView['shiritori']>): HTMLElement | null {
  const e = sh.last;
  if (!e) return null;
  const who = nameOf(view, e.playerId);
  if (e.kind === 'out') {
    const why = e.reason === 'n' ? `“${e.text}” ends in ん` : e.reason === 'timeout' ? 'ran out of time' : e.reason === 'rejected' ? `“${e.text}” was ruled out` : 'left';
    return h('p', { class: 'hint wg-event out' }, `${who} is out: ${why}`);
  }
  if (e.kind === 'challenge') return h('p', { class: 'hint wg-event' }, `The judges ${e.result === 'rejected' ? 'rejected' : 'accepted'} “${e.text}”`);
  return null;
}
