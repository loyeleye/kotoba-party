// Omiai Matchmaker on the TV: the guest's card, their question in a speech bubble, the anonymous
// charm vote, the manners meters with the guest's reaction to each register, and the finale's
// spotlight as the guest picks who to invite to tea (or, for a Kids guest, to play).

import { h, ruby } from '../../../shared/src/dom.js';
import { guestPic } from '../../../shared/src/art.js';
import type { OmiaiView } from '../../../shared/src/modes/views.js';
import { invitation, type AnswerCard, type CardView } from '../../../shared/src/modes/omiai/omiai.js';
import type { Register } from '../../../shared/src/modes/omiai/manners.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';
import { boothStrip, galleryBubbles } from '../components/mixedRoom.js';

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
    { class: `omi-guest omi-guest-${size}` },
    guestPic(card, 'omi-guest-emoji'),
    h(
      'div',
      { class: 'omi-guest-text' },
      h('p', { class: 'omi-guest-name' }, ruby(card.name)),
      h('p', { class: 'omi-guest-en' }, `${card.name.en} · ${card.job.en}`),
      size === 'big' ? h('p', { class: 'omi-guest-hobbies', lang: 'ja' }, `しゅみ：${card.hobbies.map((x) => x.text).join('、')}`, h('small', {}, ` (${card.hobbies.map((x) => x.en).join(', ')})`)) : null,
      size === 'big' ? h('p', { class: 'omi-guest-quirk' }, card.quirk) : null,
    ),
  );
}

function bubble(game: OmiaiView, compact = false): HTMLElement | null {
  const q = game.question;
  if (!q) return null;
  return h(
    'div',
    { class: `omi-bubble${compact ? ' omi-compact' : ''}` },
    h('p', { class: 'omi-bubble-jp' }, ruby(q)),
    h('p', { class: 'omi-bubble-en' }, q.en),
  );
}

/** The round's go-between: their keigo line once said, or a note that they're about to speak. */
function nakodoLine(view: RoomView, game: OmiaiView): HTMLElement | null {
  const g = game.nakodo;
  if (!g || g.declined) return null;
  const who = nameOf(view, g.playerId);
  if (!g.line) return g.pending ? h('p', { class: 'omi-nakodo-wait' }, `🎎 Matchmaker ${who} is about to speak…`) : null;
  return h(
    'div',
    { class: 'omi-nakodo-s' },
    h('p', { class: 'omi-nakodo-who' }, `🎎 Matchmaker ${who}${g.via === 'speech' ? ' 🎤' : ''} +${g.points}`),
    h('p', { class: 'omi-nakodo-jp' }, ruby(g.line)),
    h('p', { class: 'omi-nakodo-en' }, g.line.en),
  );
}

/** When each booth replay first showed, so it fades after its few seconds even across re-renders. */
const boothShown = new Map<string, number>();

/**
 * The commentary booth: the go-between's landed opening replayed with its keigo word lit and one line of
 * colour (or, in the host stand-in, Nobiko-san's own opening). It fades once its 5–7 s are up.
 */
function boothPanel(view: RoomView, game: OmiaiView): HTMLElement | null {
  const b = game.booth!;
  const key = `${game.round}:${b.playerId ?? 'nobiko'}`;
  if (!boothShown.has(key)) boothShown.set(key, Date.now());
  const left = b.ms - (Date.now() - boothShown.get(key)!);
  const g = game.nakodo;
  return h(
    'div',
    { class: 'omi-nakodo-s omi-booth', style: `animation-delay: ${Math.max(0, left)}ms` },
    g?.line && !b.standIn ? h('p', { class: 'omi-nakodo-who' }, `🎎 Matchmaker ${nameOf(view, g.playerId)}${g.via === 'speech' ? ' 🎤' : ''} +${g.points}`) : null,
    boothStrip(b, b.standIn ? 'Nobiko-san' : nameOf(view, b.playerId), b.holdKey),
    h('p', { class: 'omi-nakodo-en' }, b.en),
  );
}

function roundTag(game: OmiaiView): HTMLElement | null {
  if (!game.roundKind) return null;
  return h('p', { class: 'omi-roundtag' }, `${KIND_LABEL[game.roundKind]} · round ${game.round} of ${game.totalRounds}`, game.multiplier > 1 ? h('span', { class: 'omi-double' }, '×2') : null);
}

function meter(value: number): HTMLElement {
  return h('div', { class: 'omi-meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': 'Manners meter' }, h('span', { class: 'omi-meter-fill', style: `width: ${value}%` }), h('span', { class: 'omi-meter-num' }, `${value}`));
}

function answerCard(view: RoomView, a: AnswerCard, i: number): HTMLElement {
  const shown = a.authorId !== undefined;
  return h(
    'li',
    { class: `omi-answer${a.winner ? ' omi-win' : ''}${a.winner || a.tease ? ' host-target' : ''}${a.hidden ? ' omi-hidden' : ''}`, style: `animation-delay: ${Math.min(i, 8) * 120}ms` },
    h('p', { class: 'omi-answer-jp', lang: 'ja' }, a.text),
    shown
      ? h(
          'div',
          { class: 'omi-answer-meta' },
          h('p', { class: 'omi-author' }, a.winner ? '💐 ' : '', a.authorName ?? '', a.votes ? h('span', { class: 'omi-votes' }, ` · ${'❤'.repeat(Math.min(a.votes, 8))}`) : null),
          a.meter !== undefined ? meter(a.meter) : null,
          a.register ? h('span', { class: `omi-reg omi-reg-${a.register}` }, REGISTER_LABEL[a.register]) : null,
          a.reaction ? h('p', { class: 'omi-react', lang: 'ja' }, `${a.reaction.emoji} ${a.reaction.jp.text}`, h('small', {}, a.reaction.jp.en)) : null,
          a.encore === 'said' ? h('p', { class: 'omi-bowed' }, '🙇 said it politely') : a.encore === 'typed' ? h('p', { class: 'omi-bowed' }, '✍️ wrote it politely') : null,
        )
      : null,
  );
}

function answersList(view: RoomView, game: OmiaiView): HTMLElement {
  return h('ol', { class: `omi-answers omi-n${Math.min(game.answers.length, 8)}` }, game.answers.map((a, i) => answerCard(view, a, i)));
}

function points(view: RoomView, game: OmiaiView): HTMLElement | null {
  const rows = game.answers.filter((a) => a.points).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  if (!rows.length) return null;
  return h('ol', { class: 'omi-points' }, rows.map((a) => h('li', {}, h('span', {}, a.authorName ?? ''), h('strong', {}, `+${a.points}`))));
}

function finale(view: RoomView, game: OmiaiView): HTMLElement {
  const f = game.finale;
  const card = game.card!;
  const invite = invitation(card);
  const contestants = view.players.filter((p) => game.hearts[p.id] !== undefined);
  return h(
    'div',
    { class: 'omi-stage omi-finale' },
    h('p', { class: 'omi-callout' }, `${card.emoji} ${card.name.en} has made a decision…`),
    h(
      'ul',
      { class: 'omi-lineup' },
      contestants.map((p, i) =>
        h(
          'li',
          { class: `omi-contestant${f?.accepted === p.id ? ' omi-chosen' : ''}`, style: `--i: ${i}; --n: ${contestants.length}` },
          h('span', { class: 'omi-contestant-name' }, p.name),
          h('span', { class: 'omi-contestant-hearts' }, `❤ ${game.hearts[p.id] ?? 0}`),
        ),
      ),
    ),
    f?.accepted
      ? h(
          'div',
          { class: 'omi-invite' },
          h('p', { class: 'omi-invite-title' }, `${invite.emoji} `, h('strong', {}, nameOf(view, f.accepted)), `, ${invite.ask}`),
          f.line ? h('p', { class: 'omi-invite-jp' }, ruby(f.line)) : null,
          f.line ? h('p', { class: 'omi-invite-en' }, f.line.en) : null,
        )
      : h('div', { class: 'omi-invite' }, h('p', { class: 'omi-invite-title' }, `${invite.emoji} ${invite.all}`)),
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
          { class: 'omi-stage omi-intro' },
          h('p', { class: 'omi-title', lang: 'ja' }, 'おみあい マッチメーカー'),
          h('p', { class: 'omi-subtitle' }, 'Omiai Matchmaker: a very formal introduction show'),
          card ? guest(card, 'big') : null,
          game.greeting ? h('p', { class: 'omi-greeting', lang: 'ja' }, `「${game.greeting.text}」`, h('small', {}, game.greeting.en)) : null,
          h(
            'ol',
            { class: 'omi-steps' },
            h('li', {}, h('strong', {}, '🙇 Our guest asks a question.'), ' Answer in Japanese on your phone: say it, type it, or build it from tiles.'),
            h('li', {}, h('strong', {}, '🍵 Manners matter.'), ' です / ます, はじめまして, keigo: the family notices every one.'),
            h('li', {}, h('strong', {}, '❤ Vote'), ' for the most charming answer (not your own).'),
            h('li', {}, h('strong', {}, '💐 At the end,'), ` the guest invites one contestant ${invitation(card).to}.`),
          ),
        );
      case 'prompt':
      case 'answer':
        return h(
          'div',
          { class: 'omi-stage' },
          roundTag(game),
          view.phase === 'prompt' ? (game.booth ? boothPanel(view, game) : nakodoLine(view, game)) : null,
          view.phase === 'prompt' ? galleryBubbles(game.bubbles) : null,
          h('div', { class: 'omi-ask' }, card ? guest(card) : null, bubble(game)),
          view.phase === 'answer'
            ? h(
                'p',
                { class: 'omi-progress' },
                `Answers in: ${game.answered.length} of ${view.players.length}`,
                h('small', {}, game.roundKind === 'intro' ? ' · Tip: はじめまして、〜です。よろしく おねがいします。' : ' · Tip: end with です or ます'),
              )
            : h('p', { class: 'hint' }, 'Listen to the guest… then answer on your phone.'),
        );
      case 'reveal':
        return h(
          'div',
          { class: 'omi-stage' },
          h('div', { class: 'omi-ask' }, card ? guest(card) : null, bubble(game, true)),
          h('p', { class: 'omi-callout' }, '❤ Which answer is the most charming?'),
          answersList(view, game),
          h('p', { class: 'hint' }, `Votes: ${game.voted.length} of ${game.voters.length}`),
        );
      case 'encore':
        return h(
          'div',
          { class: 'omi-stage' },
          h('p', { class: 'omi-callout' }, `${card?.emoji ?? ''} The manners meter!`, h('small', {}, ' Say your polite version on your phone for a bonus.')),
          answersList(view, game),
        );
      case 'score': {
        const n = game.natural;
        return h(
          'div',
          { class: 'omi-stage omi-score' },
          nakodoLine(view, game),
          n
            ? h(
                'div',
                { class: 'omi-natural' },
                h('p', { class: 'omi-natural-label' }, n.from ? `💐 ${nameOf(view, n.from)}’s answer, said politely` : 'A polite way to answer'),
                h('p', { class: 'omi-natural-jp' }, ruby(n)),
                n.kana !== n.text ? h('p', { class: 'omi-natural-kana', lang: 'ja' }, n.kana) : null,
                n.en ? h('p', { class: 'omi-natural-en' }, n.en) : null,
                h('p', { class: 'omi-natural-call' }, 'Everyone, say it with a bow! 🙇'),
              )
            : null,
          points(view, game) ?? h('p', { class: 'muted' }, 'No points this round.'),
        );
      }
      case 'finale':
        return finale(view, game);
      default:
        return h('div', { class: 'omi-stage' }, card ? guest(card) : null);
    }
  },
};
