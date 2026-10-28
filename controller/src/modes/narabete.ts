// Narabete! on the phone: your secret card, saying it, moving it along the line, and the flip.
//
//   Time Line  a picture, a clock and what happens; say the sentence from memory (💡 shows the
//              Japanese, for a little less). Then ◀ ▶ your card and lock it; 🙋 asks someone to say
//              theirs again.
//   Feelings   a secret number (hold to peek), the theme, sentence frames and two swerve words, and
//              a few ready answers to tap or read out. Never say the number.
//   Story      round 3 ends with everyone's answers read out low to high: your turn shows your line.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { NarabeteView } from '../../../shared/src/modes/views.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { speakBox, canSpeak } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<NarabeteView>;
type Me = NonNullable<NarabeteView['me']>;

const nameOf = (ctx: Ctx, id: string | null | undefined): string => ctx.view.players.find((p) => p.id === id)?.name ?? '';

function themeLine(game: NarabeteView, level: Me['level']): HTMLElement | null {
  if (!game.title) return null;
  return jpView(game.title, level, { cls: 'nb-theme' });
}

/** The ends of the line, so the player knows which way is up. */
function ends(game: NarabeteView): HTMLElement | null {
  if (!game.low || !game.high) return null;
  return h('p', { class: 'nb-ends-p' }, h('span', { lang: 'ja' }, `◀ ${game.low.text}`), h('small', {}, ` ${game.low.en} … ${game.high.en} `), h('span', { lang: 'ja' }, `${game.high.text} ▶`));
}

// ---- your card ----

function timeCard(me: Me): HTMLElement | null {
  const t = me.time;
  if (!t) return null;
  return h(
    'div',
    { class: 'nb-mycard' },
    h('span', { class: 'nb-mycard-emoji', 'aria-hidden': 'true' }, t.emoji),
    h('p', { class: 'nb-mycard-clock' }, t.label),
    h('p', { class: 'nb-mycard-en' }, t.en),
    t.jp ? jpView({ ...t.jp, en: null, romaji: t.romaji }, me.level, { cls: 'nb-mycard-jp' }) : null,
  );
}

/** The secret number, hidden until held (so a neighbour glancing over sees nothing). */
function secret(me: Me): HTMLElement | null {
  if (me.secret === null) return null;
  const num = h('span', { class: 'nb-secret-num' }, String(me.secret));
  const b = h('button', { type: 'button', class: 'nb-secret', 'aria-label': `Your secret number: hold to see it` }, h('span', { class: 'nb-secret-cover' }, '🤫 Hold to peek'), num);
  const show = (e: Event) => {
    e.preventDefault();
    b.classList.add('peek');
  };
  const hide = () => b.classList.remove('peek');
  b.addEventListener('pointerdown', show);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) b.addEventListener(ev, hide);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  // Keyboard: Space or Enter shows it while held.
  b.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && b.classList.add('peek'));
  b.addEventListener('keyup', hide);
  return h('div', { class: 'nb-secret-box' }, b, h('p', { class: 'hint' }, '1 = ', h('span', { lang: 'ja' }, '◀'), ' low end · 100 = high end ', h('span', { lang: 'ja' }, '▶')));
}

// ---- saying it ----

function sayTime(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const said = me.said;
  return h(
    'div',
    { class: 'screen' },
    themeLine(game, me.level),
    timeCard(me),
    said?.ok
      ? h('p', { class: 'nb-ok-p' }, '✓ The room heard your card. Listen to the others!')
      : said
        ? h('p', { class: 'nb-warn-p' }, `Heard “${said.text}”, but not the time. Try once more?`)
        : h('p', { class: 'hint' }, canSpeak() ? 'Say what happens, and when, in Japanese. Out loud: the others need to hear it.' : 'Type what happens, and when, in Japanese.'),
    said?.ok
      ? null
      : speakBox({ label: 'Hold and say it', placeholder: 'ごご よじはんに …', maxLength: MAX_ANSWER_LENGTH, kanaPadOpen: me.level === 'kana', onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }) }),
    !me.time?.jp && !said?.ok ? h('button', { type: 'button', class: 'secondary nb-hint', onclick: () => void send({ kind: 'hint', round: game.round }) }, '💡 Show me the Japanese') : null,
  );
}

function sayFeel(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const said = me.said;
  const romaji = me.level === 'kana';
  return h(
    'div',
    { class: 'screen' },
    themeLine(game, me.level),
    ends(game),
    secret(me),
    said
      ? h(
          'div',
          { class: 'nb-said-p' },
          h('p', {}, 'Your answer: ', h('strong', { lang: 'ja' }, said.text)),
          said.warn ? h('p', { class: 'nb-warn-p' }, '🤫 That sounds like a number! Say it another way?') : h('p', { class: 'nb-ok-p' }, '✓ Sent. You can still change it.'),
        )
      : h('p', { class: 'hint' }, 'Say something that fits your number. Never the number itself!'),
    me.frames.length ? h('div', { class: 'nb-frames' }, me.frames.map((f) => h('span', { class: 'nb-frame', lang: 'ja' }, f, romaji ? h('small', {}, toRomaji(f)) : null))) : null,
    me.swerve.length ? h('p', { class: 'nb-swerve' }, 'Or try: ', ...me.swerve.map((w) => h('span', { class: 'nb-swerve-word' }, h('span', { lang: 'ja' }, w.text), h('small', {}, ` ${w.en}`)))) : null,
    speakBox({ label: 'Hold and say your answer', placeholder: 'Type your answer', maxLength: MAX_ANSWER_LENGTH, kanaPadOpen: romaji, onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }) }),
    me.offers.length
      ? h(
          'details',
          { class: 'nb-ready', open: romaji || undefined },
          h('summary', {}, 'Stuck? Pick a ready answer'),
          h('p', { class: 'hint' }, 'Reading one out loud earns more than tapping it.'),
          me.offers.map((o) =>
            h(
              'button',
              { type: 'button', class: 'option nb-offer', onclick: () => void send({ kind: 'ready', key: o.key, round: game.round }) },
              h('span', { class: 'nb-offer-emoji', 'aria-hidden': 'true' }, o.emoji),
              h('span', { class: 'nb-offer-jp', lang: 'ja' }, o.text),
              o.romaji ? h('small', { class: 'nb-offer-romaji' }, o.romaji) : null,
              h('small', {}, o.en),
            ),
          ),
        )
      : null,
  );
}

// ---- ordering ----

function ordering(ctx: Ctx, me: Me): HTMLElement {
  const { game, send, isVip } = ctx;
  const n = game.line.length;
  const others = game.line.filter((c) => !c.mine);
  const move = (dir: -1 | 1) => () => void send({ kind: 'move', dir, round: game.round });
  return h(
    'div',
    { class: 'screen' },
    ends(game),
    timeCard(me) ?? (me.secret !== null ? secret(me) : null),
    me.said && game.kind !== 'time' ? h('p', { class: 'hint' }, 'Your answer: ', h('span', { lang: 'ja' }, me.said.text)) : null,
    h('p', { class: 'nb-pos' }, `Your card is ${me.position + 1} of ${n}`),
    h(
      'div',
      { class: 'nb-arrows' },
      h('button', { type: 'button', class: 'nb-arrow', disabled: !me.canMove.left, 'aria-label': 'Move my card towards the low end', onclick: move(-1) }, '◀'),
      h('button', { type: 'button', class: 'nb-arrow', disabled: !me.canMove.right, 'aria-label': 'Move my card towards the high end', onclick: move(1) }, '▶'),
    ),
    h(
      'button',
      { type: 'button', class: `primary nb-lock${me.locked ? ' on' : ''}`, 'aria-pressed': me.locked ? 'true' : 'false', onclick: () => void send({ kind: 'lock', locked: !me.locked, round: game.round }) },
      me.locked ? h('span', {}, '🔒 ', h('span', { lang: 'ja' }, 'きめた！'), ' (tap to unlock)') : h('span', {}, h('span', { lang: 'ja' }, 'きめた！'), ' Happy with my spot'),
    ),
    h('p', { class: 'hint' }, 'Talk it over out loud. Moving a card unlocks it and its neighbour.'),
    me.againFrom.length
      ? h(
          'div',
          { class: 'nb-again-p' },
          h('p', {}, `🙋 ${me.againFrom.join(', ')} asked to hear yours again`),
          speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }) }),
        )
      : null,
    game.kind === 'time' && others.length
      ? h(
          'details',
          { class: 'nb-ask' },
          h('summary', {}, '🙋 Ask someone to say theirs again'),
          others.map((c) =>
            h('button', { type: 'button', class: 'option', onclick: () => void send({ kind: 'again', cardId: c.id, round: game.round }) }, `${c.emoji ?? ''} ${nameOf(ctx, c.ownerId)}: `, h('span', { lang: 'ja' }, 'もう いちど おねがいします')),
          ),
        )
      : null,
    isVip && game.kind !== 'time' ? vipHide(ctx) : null,
  );
}

function vipHide(ctx: Ctx): HTMLElement | null {
  const { game, send } = ctx;
  const shown = game.line.filter((c) => c.text && !c.hidden);
  if (!shown.length) return null;
  return h(
    'details',
    { class: 'nb-vip' },
    h('summary', {}, 'VIP: hide an answer'),
    shown.map((c) => h('button', { type: 'button', class: 'vip-hide', onclick: () => void send({ kind: 'hide', cardId: c.id, round: game.round }) }, '🚫 Hide ', h('span', { lang: 'ja' }, `“${c.text}”`))),
  );
}

// ---- after the flip ----

function scoreScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send, isVip } = ctx;
  const f = game.flip;
  const others = game.line.filter((c) => !c.mine && c.text && !c.hidden);
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, 'Look at the TV! 🪢'),
    f ? h('p', { class: 'nb-points' }, `+${f.teamPoints} team`, me.bonus ? h('span', {}, ` · +${me.bonus} for saying it`) : null) : null,
    me.canVote
      ? h(
          'div',
          { class: 'nb-vote' },
          h('p', { class: 'nb-vote-title' }, '❤ The funniest answer?'),
          others.map((c) =>
            h('button', { type: 'button', class: 'option', onclick: () => void send({ kind: 'vote', cardId: c.id, round: game.round }) }, '❤ ', h('span', { lang: 'ja' }, c.text ?? ''), me.level === 'kana' && c.text ? h('small', { class: 'nb-offer-romaji' }, ` ${toRomaji(c.text)}`) : null),
          ),
        )
      : me.votedFor
        ? h('p', { class: 'hint' }, 'Vote in ❤')
        : null,
    game.kind !== 'time' ? h('p', { class: 'nb-phrase' }, 'Arguing tip: ', h('span', { lang: 'ja' }, 'Aさんの ほうが ひどい！'), h('small', {}, ' A’s is worse!')) : null,
    isVip && game.kind !== 'time' ? vipHide(ctx) : null,
  );
}

function storyScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  if (!me.performing) return waiting('Listen to the story 📖', game.story?.current ? `${nameOf(ctx, game.line.find((c) => c.id === game.story!.current)?.ownerId)} is reading…` : '');
  const first = game.story?.index === 0;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎤 Your line!'),
    h('p', { class: 'nb-story-p', lang: 'ja' }, first ? '' : 'そして… ', h('strong', {}, me.performing.text)),
    h('p', { class: 'hint' }, first ? 'You start the story. Read it out with feeling!' : 'Start with そして (“and then…”), and read it out with feeling.'),
    speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'perform', utterance, round: game.round }) }),
    h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'perform', pass: true, round: game.round }) }, 'Skip my line'),
  );
}

export const narabetePhone: PhoneMode<NarabeteView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      JSON.stringify(game.me),
      view.phase === 'reveal' || view.phase === 'score' ? game.line.map((c) => `${c.id}${c.hidden ? 'h' : ''}`).join(',') : '',
      game.story ? `${game.story.index}` : '',
    ].join('|'),

  render(ctx) {
    const { view, game, send } = ctx;
    const me = game.me;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'ならべて！'),
          h('p', {}, '🤫 You get a secret card. 🔊 Say it out loud and listen to everyone else.'),
          h('p', {}, '◀ ▶ Then move your own card along the line, low to high. Talk it over!'),
          h('p', { class: 'hint' }, 'Every pair in order scores for the whole team. Saying yours out loud adds a bonus.'),
        );
      case 'prompt':
        if (!me?.cardId) return waiting('Look at the TV!', 'You’re watching this round.');
        return h('div', { class: 'screen' }, h('p', { class: 'big' }, '🤫 Your secret card'), themeLine(game, me.level), game.kind === 'time' ? timeCard(me) : secret(me), h('p', { class: 'hint' }, 'Don’t show anyone!'));
      case 'answer':
        if (!me?.cardId) return waiting('Look at the TV!', 'Listen to the cards.');
        return game.kind === 'time' ? sayTime(ctx, me) : sayFeel(ctx, me);
      case 'reveal':
        if (!me?.cardId) return waiting('Line them up!', 'Watch the TV.');
        return ordering(ctx, me);
      case 'encore':
        if (me?.defending)
          return h(
            'div',
            { class: 'screen' },
            h('p', { class: 'big' }, '🎤 Defend your card!'),
            h('p', {}, 'It moved the most. Say why it belongs there.'),
            h('p', { class: 'nb-frame', lang: 'ja' }, '〜から です。', h('small', {}, ' It’s because …')),
            speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'defend', utterance, round: game.round }) }),
            h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'defend', pass: true, round: game.round }) }, 'Pass'),
          );
        return waiting('Look at the TV!', game.defence ? `${nameOf(ctx, game.defence.playerId)} is defending their card…` : '');
      case 'score':
        return me ? scoreScreen(ctx, me) : waiting('Look at the TV!');
      case 'finale':
        return me ? storyScreen(ctx, me) : waiting('Listen to the story 📖');
      default:
        return waiting('Look at the TV!');
    }
  },
};
