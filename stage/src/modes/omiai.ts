// Omiai Matchmaker on the TV: the guest's card, their question in a speech bubble, the anonymous
// charm vote, the manners meters with the guest's reaction to each register, and the finale's
// spotlight as the guest picks who to invite to tea.

import { h } from '../../../shared/src/dom.js';
import type { OmiaiView } from '../../../shared/src/modes/views.js';
import type { AnswerCard, CardView } from '../../../shared/src/modes/omiai/omiai.js';
import type { Register } from '../../../shared/src/modes/omiai/manners.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';

const REGISTER_LABEL: Record<Register, string> = {
  keigo: 'けいご · keigo',
  polite: 'ていねい · polite',
  mixed: 'ちょっと · nearly',
  plain: 'ふつう · plain',
  casual: 'カジュアル · casual',
  none: 'English',
};

const KIND_LABEL = { intro: 'Self-introduction', question: 'The guest asks', appeal: 'Closing appeal' } as const;

function guest(card: CardView, size: 'big' | 'small' = 'small'): HTMLElement {
  return h(
    'div',
    { class: `om-guest om-guest-${size}` },
    h('span', { class: 'om-guest-emoji', 'aria-hidden': 'true' }, card.emoji),
    h(
      'div',
      { class: 'om-guest-text' },
      h('p', { class: 'om-guest-name', lang: 'ja' }, card.name.text),
      h('p', { class: 'om-guest-en' }, `${card.name.en} · ${card.job.en}`),
      size === 'big' ? h('p', { class: 'om-guest-hobbies', lang: 'ja' }, `しゅみ: ${card.hobbies.map((x) => x.text).join('、')}`, h('small', {}, ` (${card.hobbies.map((x) => x.en).join(', ')})`)) : null,
      size === 'big' ? h('p', { class: 'om-guest-quirk' }, card.quirk) : null,
    ),
  );
}

function bubble(game: OmiaiView, compact = false): HTMLElement | null {
  const q = game.question;
  if (!q) return null;
  return h(
    'div',
    { class: `om-bubble${compact ? ' om-compact' : ''}` },
    h('p', { class: 'om-bubble-jp', lang: 'ja' }, q.text),
    h('p', { class: 'om-bubble-en' }, q.en),
  );
}

function roundTag(game: OmiaiView): HTMLElement | null {
  if (!game.roundKind) return null;
  return h('p', { class: 'om-roundtag' }, `${KIND_LABEL[game.roundKind]} · round ${game.round} of ${game.totalRounds}`, game.multiplier > 1 ? h('span', { class: 'om-double' }, '×2') : null);
}

function meter(value: number): HTMLElement {
  return h('div', { class: 'om-meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': 'Manners meter' }, h('span', { class: 'om-meter-fill', style: `width: ${value}%` }), h('span', { class: 'om-meter-num' }, `${value}`));
}

function answerCard(view: RoomView, a: AnswerCard, i: number): HTMLElement {
  const shown = a.authorId !== undefined;
  return h(
    'li',
    { class: `om-answer${a.winner ? ' om-win' : ''}${a.hidden ? ' om-hidden' : ''}`, style: `animation-delay: ${Math.min(i, 8) * 120}ms` },
    h('p', { class: 'om-answer-jp', lang: 'ja' }, a.text),
    shown
      ? h(
          'div',
          { class: 'om-answer-meta' },
          h('p', { class: 'om-author' }, a.winner ? '💐 ' : '', a.authorName ?? '', a.votes ? h('span', { class: 'om-votes' }, ` · ${'❤'.repeat(Math.min(a.votes, 8))}`) : null),
          a.meter !== undefined ? meter(a.meter) : null,
          a.register ? h('span', { class: `om-reg om-reg-${a.register}` }, REGISTER_LABEL[a.register]) : null,
          a.reaction ? h('p', { class: 'om-react', lang: 'ja' }, `${a.reaction.emoji} ${a.reaction.jp.text}`, h('small', {}, a.reaction.jp.en)) : null,
          a.encore === 'said' ? h('p', { class: 'om-bowed' }, '🙇 said it politely') : a.encore === 'typed' ? h('p', { class: 'om-bowed' }, '✍️ wrote it politely') : null,
        )
      : null,
  );
}

function answersList(view: RoomView, game: OmiaiView): HTMLElement {
  return h('ol', { class: `om-answers om-n${Math.min(game.answers.length, 8)}` }, game.answers.map((a, i) => answerCard(view, a, i)));
}

function points(view: RoomView, game: OmiaiView): HTMLElement | null {
  const rows = game.answers.filter((a) => a.points).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  if (!rows.length) return null;
  return h('ol', { class: 'om-points' }, rows.map((a) => h('li', {}, h('span', {}, a.authorName ?? ''), h('strong', {}, `+${a.points}`))));
}

function finale(view: RoomView, game: OmiaiView): HTMLElement {
  const f = game.finale;
  const card = game.card!;
  const contestants = view.players.filter((p) => game.hearts[p.id] !== undefined);
  return h(
    'div',
    { class: 'om-stage om-finale' },
    h('p', { class: 'om-callout' }, `${card.emoji} ${card.name.en} has made a decision…`),
    h(
      'ul',
      { class: 'om-lineup' },
      contestants.map((p, i) =>
        h(
          'li',
          { class: `om-contestant${f?.accepted === p.id ? ' om-chosen' : ''}`, style: `--i: ${i}; --n: ${contestants.length}` },
          h('span', { class: 'om-contestant-name' }, p.name),
          h('span', { class: 'om-contestant-hearts' }, `❤ ${game.hearts[p.id] ?? 0}`),
        ),
      ),
    ),
    f?.accepted
      ? h(
          'div',
          { class: 'om-invite' },
          h('p', { class: 'om-invite-title' }, '🍵 ', h('strong', {}, nameOf(view, f.accepted)), ', will you come to tea?'),
          f.line ? h('p', { class: 'om-invite-jp', lang: 'ja' }, f.line.text) : null,
          f.line ? h('p', { class: 'om-invite-en' }, f.line.en) : null,
        )
      : h('div', { class: 'om-invite' }, h('p', { class: 'om-invite-title' }, '🍵 Tea for everyone! The guest enjoyed meeting you all.')),
  );
}

export const omiaiStage: StageMode<OmiaiView> = {
  badge(game, playerId) {
    if (game.answered.includes(playerId)) return '✓';
    const hearts = game.hearts[playerId] ?? 0;
    return hearts ? `❤ ${hearts}` : '';
  },

  render(view, game) {
    const card = game.card;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'om-stage om-intro' },
          h('p', { class: 'om-title', lang: 'ja' }, 'おみあい マッチメーカー'),
          h('p', { class: 'om-subtitle' }, 'Omiai Matchmaker: a very formal introduction show'),
          card ? guest(card, 'big') : null,
          game.greeting ? h('p', { class: 'om-greeting', lang: 'ja' }, `「${game.greeting.text}」`, h('small', {}, game.greeting.en)) : null,
          h(
            'ol',
            { class: 'om-steps' },
            h('li', {}, h('strong', {}, '🙇 Our guest asks a question.'), ' Answer in Japanese on your phone: say it, type it, or build it from tiles.'),
            h('li', {}, h('strong', {}, '🍵 Manners matter.'), ' です / ます, はじめまして, keigo: the family notices every one.'),
            h('li', {}, h('strong', {}, '❤ Vote'), ' for the most charming answer (not your own).'),
            h('li', {}, h('strong', {}, '💐 At the end,'), ' the guest invites one contestant to tea.'),
          ),
        );
      case 'prompt':
      case 'answer':
        return h(
          'div',
          { class: 'om-stage' },
          roundTag(game),
          h('div', { class: 'om-ask' }, card ? guest(card) : null, bubble(game)),
          view.phase === 'answer'
            ? h(
                'p',
                { class: 'om-progress' },
                `Answers in: ${game.answered.length} of ${view.players.length}`,
                h('small', {}, game.roundKind === 'intro' ? ' · Tip: はじめまして、〜です。よろしく おねがいします。' : ' · Tip: end with です or ます'),
              )
            : h('p', { class: 'hint' }, 'Listen to the guest… then answer on your phone.'),
        );
      case 'reveal':
        return h(
          'div',
          { class: 'om-stage' },
          h('div', { class: 'om-ask' }, card ? guest(card) : null, bubble(game, true)),
          h('p', { class: 'om-callout' }, '❤ Which answer is the most charming?'),
          answersList(view, game),
          h('p', { class: 'hint' }, `Votes: ${game.voted.length} of ${game.voters.length}`),
        );
      case 'encore':
        return h(
          'div',
          { class: 'om-stage' },
          h('p', { class: 'om-callout' }, `${card?.emoji ?? ''} The manners meter!`, h('small', {}, ' Say your polite version on your phone for a bonus.')),
          answersList(view, game),
        );
      case 'score': {
        const n = game.natural;
        return h(
          'div',
          { class: 'om-stage om-score' },
          n
            ? h(
                'div',
                { class: 'om-natural' },
                h('p', { class: 'om-natural-label' }, n.from ? `💐 ${nameOf(view, n.from)}’s answer, said politely` : 'A polite way to answer'),
                h('p', { class: 'om-natural-jp', lang: 'ja' }, n.text),
                n.kana !== n.text ? h('p', { class: 'om-natural-kana', lang: 'ja' }, n.kana) : null,
                n.en ? h('p', { class: 'om-natural-en' }, n.en) : null,
                h('p', { class: 'om-natural-call' }, 'Everyone, say it with a bow! 🙇'),
              )
            : null,
          points(view, game) ?? h('p', { class: 'muted' }, 'No points this round.'),
        );
      }
      case 'finale':
        return finale(view, game);
      default:
        return h('div', { class: 'om-stage' }, card ? guest(card) : null);
    }
  },
};
