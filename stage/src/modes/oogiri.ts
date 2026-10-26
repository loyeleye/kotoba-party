// Oogiri Night on the stage: round cards, the host-read reveal with English subtitles,
// cushions (座布団), the IPPON celebration, the encore, the natural version and Pon's steal.
//
// The stage redraws on every update, so animations are timed from the phase start the server
// sends (`phaseAt`): a redraw resumes an animation where it was instead of replaying it.

import { h } from '../../../shared/src/dom.js';
import { icon } from '../../../shared/src/art.js';
import type { AnswerCard, OogiriView, PromptCard } from '../../../shared/src/modes/oogiri/oogiri.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const ROUND_INFO: Record<string, { title: string; ja: string; how: string }> = {
  'head-to-head': { title: 'Head to Head', ja: 'たいけつ', how: 'Two players per prompt. Everyone else votes. Japanese only!' },
  'photo-caption': { title: 'Photo Caption', ja: 'しゃしん', how: 'Caption the photo. English allowed (no Japanese bonus).' },
  ippon: { title: 'IPPON Round', ja: 'イッポン', how: 'One prompt for everyone. Vote for any answer but your own.' },
};

/** Seconds between answers as the host reads them out. */
const READ_GAP_MS = 1_600;

/** A style that starts an animation `delayMs` after the phase began, resuming it on a redraw. */
function at(game: OogiriView, delayMs: number): string {
  const elapsed = Math.min(120_000, Math.max(0, Date.now() - game.phaseAt));
  return `animation-delay: ${delayMs - elapsed}ms`;
}

function promptCard(p: PromptCard): HTMLElement {
  return h(
    'div',
    { class: 'oo-stage-prompt' },
    p.photo ? h('div', { class: 'oo-photo-card' }, h('span', { class: 'oo-photo-icon' }, '📷'), h('p', {}, p.photo)) : null,
    h('p', { class: 'oo-p-jp', lang: 'ja' }, ruby(p)),
    p.kana !== p.text && !p.furigana ? h('p', { class: 'oo-p-kana', lang: 'ja' }, p.kana) : null,
    h('p', { class: 'oo-p-en' }, p.en),
  );
}

/** Furigana as <ruby>, falling back to the plain text. */
function ruby(p: { text: string; furigana?: [string, string][] }): (Node | string)[] {
  if (!p.furigana?.length) return [p.text];
  return p.furigana.map(([base, reading]) => (reading ? h('ruby', {}, base, h('rt', {}, reading)) : base));
}

function cushions(n: number): HTMLElement {
  return h(
    'span',
    { class: 'oo-cushions', title: `${n} 座布団` },
    Array.from({ length: Math.min(n, 8) }, () => h('span', { class: 'oo-cushion' })),
    h('span', { class: 'oo-cushion-n' }, `${n}枚`),
  );
}

const ENCORE_TEXT: Record<string, string> = { said: '🎤 said it!', typed: '⌨️ encore', host: '🦝 Pon reads it' };

function answerCard(game: OogiriView, a: AnswerCard, i: number, revealed: boolean, maxVotes: number): HTMLElement {
  const cls = ['oo-card', a.hidden ? 'hidden' : '', a.winner ? 'winner' : '', a.ippon ? 'ippon' : '', revealed ? '' : 'reading'].join(' ');
  return h(
    'li',
    { class: cls, style: revealed ? null : at(game, 400 + i * READ_GAP_MS) },
    h('span', { class: `oo-card-jp ${a.english ? 'en' : ''}`, lang: a.english ? 'en' : 'ja' }, a.text),
    a.en ? h('span', { class: 'oo-card-en' }, a.en) : null,
    revealed
      ? h(
          'span',
          { class: 'oo-card-by' },
          h('strong', {}, a.authorName ?? ''),
          cushions(a.votes ?? 0),
          a.points ? h('span', { class: 'oo-points' }, `+${a.points}`) : null,
          a.encore ? h('span', { class: 'oo-encore' }, ENCORE_TEXT[a.encore]) : null,
          a.ippon ? h('span', { class: 'badge' }, 'IPPON!') : a.winner && maxVotes > 0 ? h('span', { class: 'badge win' }, icon('trophy', '🏆', 'oo-trophy')) : null,
        )
      : null,
  );
}

function header(game: OogiriView): HTMLElement {
  const m = game.matchup!;
  const info = game.kind ? ROUND_INFO[game.kind] : undefined;
  return h(
    'p',
    { class: 'oo-head' },
    `${info?.title ?? ''}`,
    game.kind !== 'ippon' ? ` · ${m.index + 1} / ${m.count}` : '',
    game.multiplier > 1 ? h('span', { class: 'oo-x2' }, ` ×${game.multiplier}`) : null,
  );
}

function intro(game: OogiriView): HTMLElement {
  return h(
    'div',
    { class: 'card oo-intro' },
    h('p', { class: 'oo-title', lang: 'ja' }, '大喜利ナイト！'),
    h('p', { class: 'hint' }, 'Oogiri Night with Pon: fill in the blank, vote for the funniest, say the winner out loud.'),
    h(
      'div',
      { class: 'oo-demo' },
      h('p', { class: 'oo-p-jp', lang: 'ja' }, 'ねこの ひみつの しごとは ＿＿＿です。'),
      h('p', { class: 'oo-p-en' }, "The cat's secret job is ___."),
      h(
        'ol',
        { class: 'oo-cards' },
        h('li', { class: 'oo-card reading', style: at(game, 1500) }, h('span', { class: 'oo-card-jp', lang: 'ja' }, 'すしや'), h('span', { class: 'oo-card-en' }, "The cat's secret job is running a sushi bar.")),
        h('li', { class: 'oo-card reading winner', style: at(game, 3000) }, h('span', { class: 'oo-card-jp', lang: 'ja' }, 'ポンの せんせい'), h('span', { class: 'oo-card-en' }, "The cat's secret job is being Pon's teacher."), h('span', { class: 'oo-card-by' }, cushions(3))),
      ),
    ),
    h(
      'ol',
      { class: 'oo-rounds' },
      Object.values(ROUND_INFO).map((r, i) => h('li', {}, h('strong', {}, `${i + 1}. ${r.title} `), h('span', { lang: 'ja' }, r.ja), ` · ${r.how}`)),
    ),
    h('p', { class: 'hint' }, 'Say your answer into your phone to send it. Every vote is a 座布団 (cushion). IPPON = every other voter picks you!'),
    game.placeholder ? h('p', { class: 'oo-placeholder' }, 'Using placeholder prompts (no topic pack loaded).') : null,
  );
}

function reveal(view: RoomView, game: OogiriView): HTMLElement {
  const m = game.matchup!;
  return h(
    'div',
    { class: 'card oo-reveal' },
    header(game),
    promptCard(m.prompt),
    h('ol', { class: 'oo-cards' }, m.answers.map((a, i) => answerCard(game, a, i, false, 0))),
    h('p', { class: 'hint' }, `${m.voted.length} / ${m.voters.length} votes in`, view.phase === 'reveal' ? ' · vote on your phone' : ''),
  );
}

function encore(game: OogiriView): HTMLElement {
  const m = game.matchup!;
  const max = Math.max(0, ...m.answers.map((a) => a.votes ?? 0));
  const ordered = game.kind === 'ippon' ? [...m.answers].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : m.answers;
  const winners = m.answers.filter((a) => a.winner && max > 0);
  return h(
    'div',
    { class: 'card oo-reveal' },
    header(game),
    promptCard(m.prompt),
    h('ol', { class: 'oo-cards' }, ordered.map((a, i) => answerCard(game, a, i, true, max))),
    winners.length
      ? h('p', { class: 'oo-invite' }, `🎤 Encore! ${winners.map((w) => w.authorName).join(' & ')}, say it from memory!`)
      : h('p', { class: 'hint' }, 'No votes this time. Pon is speechless.'),
    m.ippon
      ? h(
          'div',
          { class: 'oo-ippon', style: at(game, 200) },
          h('span', { class: 'oo-ippon-word' }, 'IPPON'),
          h('span', { class: 'oo-ippon-ja', lang: 'ja' }, '一本！'),
          h('span', { class: 'oo-ippon-name' }, m.answers.find((a) => a.ippon)?.authorName ?? ''),
        )
      : null,
  );
}

function score(game: OogiriView): HTMLElement {
  const m = game.matchup!;
  const n = m.natural;
  const max = Math.max(0, ...m.answers.map((a) => a.votes ?? 0));
  const best = m.answers.filter((a) => a.winner && max > 0);
  return h(
    'div',
    { class: 'card oo-score' },
    header(game),
    best.length ? h('p', { class: 'oo-best' }, '🏆 ', h('span', { lang: best[0]!.english ? 'en' : 'ja' }, best.map((b) => b.text).join(' / ')), h('small', {}, ` · ${best.map((b) => b.authorName).join(' & ')}`)) : null,
    n
      ? h(
          'div',
          { class: 'oo-natural' },
          h('p', { class: 'oo-label' }, 'Natural version · shout it back!'),
          h('p', { class: 'oo-n-jp', lang: 'ja' }, ruby(n)),
          n.kana !== n.text ? h('p', { class: 'oo-p-kana', lang: 'ja' }, n.kana) : null,
          h('p', { class: 'oo-p-en' }, n.en),
          m.pattern ? h('p', { class: 'oo-pattern' }, '💡 ', m.pattern) : null,
        )
      : null,
    h(
      'ul',
      { class: 'oo-points-list' },
      m.answers.filter((a) => !a.hidden).map((a) => h('li', {}, h('strong', {}, a.authorName ?? ''), cushions(a.votes ?? 0), h('span', { class: 'oo-points' }, `+${a.points ?? 0}`))),
    ),
  );
}

export const oogiriStage: StageMode<OogiriView> = {
  badge(game, playerId) {
    const done = game.answered.includes(playerId) ? '✎ ' : game.matchup?.voted.includes(playerId) ? '✓ ' : '';
    const c = game.cushions[playerId] ?? 0;
    return `${done}${c ? `${c}枚` : ''}`.trim();
  },

  render(view, game) {
    const info = game.kind ? ROUND_INFO[game.kind] : undefined;
    switch (view.phase) {
      case 'intro':
        return intro(game);
      case 'prompt':
        return h(
          'div',
          { class: 'card oo-round' },
          h('p', { class: 'oo-round-n' }, `Round ${game.round} / ${game.totalRounds}`),
          h('p', { class: 'oo-title' }, info?.title ?? '', ' ', h('span', { lang: 'ja' }, info?.ja ?? '')),
          h('p', { class: 'hint' }, info?.how ?? ''),
          game.multiplier > 1 ? h('p', { class: 'oo-x2 big' }, `Points ×${game.multiplier} · Japanese bonus ×2`) : null,
          game.prompt ? promptCard(game.prompt) : null,
        );
      case 'answer': {
        const total = view.players.length;
        return h(
          'div',
          { class: 'card oo-answering' },
          h('p', { class: 'oo-head' }, `Round ${game.round} · ${info?.title ?? ''}`),
          game.prompt ? promptCard(game.prompt) : h('p', { class: 'big' }, 'Answer on your phones!'),
          h('p', { class: 'oo-sayfirst' }, '🎤 Say it first: from memory, before the tiles come!'),
          h('p', { class: 'hint' }, `${game.answered.length} / ${total} players done`),
          h('div', { class: 'oo-done-row' }, view.players.map((p) => h('span', { class: `oo-done-chip ${game.answered.includes(p.id) ? 'on' : ''}` }, p.name))),
        );
      }
      case 'reveal':
        return game.matchup ? reveal(view, game) : h('div', { class: 'card' });
      case 'encore':
        return game.matchup ? encore(game) : h('div', { class: 'card' });
      case 'score':
        return game.matchup ? score(game) : h('div', { class: 'card' });
      case 'penalty':
        return h(
          'div',
          { class: 'card oo-steal' },
          h('p', { class: 'oo-steal-tanuki', style: at(game, 0) }, '🦝'),
          h('p', { class: 'oo-title' }, 'Pon steals a cushion!'),
          h('p', { class: 'big' }, game.steal ? `Sorry, ${game.steal.name}… −1 座布団` : ''),
          h('p', { class: 'hint' }, 'Once a game, a runaway leader loses one. Shōten rules!'),
        );
      default:
        return h('div', { class: 'card' });
    }
  },
};
