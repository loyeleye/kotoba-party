// Narabete! on the phone: your secret card, saying it, moving it along the line, and the flip.
//
//   Time Line  a picture, a clock and what happens; say the sentence from memory (💡 shows the
//              Japanese, for a little less). Then ◀ ▶ your card and lock it; 🙋 asks someone to say
//              theirs again.
//   Feelings   a secret number (hold to peek), the theme, sentence frames and two swerve words, and
//              a few ready answers to tap or read out. Never say the number.
//   Story      round 3 ends with everyone's answers read out low to high: your turn shows your line.
//   N4         rank and defend: one N4 player a round is told during the line-up that they'll say why
//              their card goes where it is (「＿ので、これが いちばん さきです。」), with "Not this time".
//              Their turn shows the frame and two model lines to read out.
//              Once it lands, Kana and N5 phones show the gist of it (kana, English, the card).
//              While it's on, everyone else gets a Gallery tile: a reaction, or once a game the curveball.
//   Stand-in   a room of one or two with nobody at N4: Kana and N5 phones show the gist of Nobiko-san's
//              own model defence, in the line-up she gives it.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { NarabeteView } from '../../../shared/src/modes/views.js';
import { flipMs, joiner } from '../../../shared/src/modes/narabete/narabete.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { speakBox, canSpeak } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import { roleOffer } from '../components/roleOffer.js';
import { boothGist, galleryTile } from '../components/gallery.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<NarabeteView>;
type Me = NonNullable<NarabeteView['me']>;

const nameOf = (ctx: Ctx, id: string | null | undefined): string => ctx.view.players.find((p) => p.id === id)?.name ?? '';

/** What to type, by the round's unit: a pattern, never one card's answer. */
const PLACEHOLDER: Record<string, string> = { time: '〜じに 〜ます。', price: '〜は 〜えんです。', date: '〜がつ 〜かに 〜ます。' };

// The flip is timed from when this phone first saw the phase, so the result waits for the TV's last card.
let shown = { seq: -1, at: 0 };
function since(view: RoomView): number {
  if (shown.seq !== view.phaseSeq) shown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - shown.at;
}

const buzz = (ms = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

function themeLine(game: NarabeteView, level: Me['level']): HTMLElement | null {
  if (!game.title) return null;
  return jpView(game.title, level, { cls: 'nb-theme' });
}

/** The ends of the line, so the player knows which way is up. */
function ends(game: NarabeteView): HTMLElement | null {
  if (!game.low || !game.high) return null;
  const feel = game.unit === 'feel';
  return h(
    'div',
    { class: 'nb-ends-p' },
    h('p', { class: 'nb-end' }, h('span', { lang: 'ja' }, `◀ ${game.low.text}`), h('small', {}, `${feel ? '1 · ' : ''}${game.low.en}`)),
    h('p', { class: 'nb-end hi' }, h('span', { lang: 'ja' }, `${game.high.text} ▶`), h('small', {}, `${game.high.en}${feel ? ' · 100' : ''}`)),
  );
}

/** The line as it stands, names only, with your card marked: where you are among the others. */
function miniLine(ctx: Ctx): HTMLElement {
  return h(
    'ol',
    { class: 'nb-mini', 'aria-label': 'The line, low end first' },
    ctx.game.line.map((c) => h('li', { class: `${c.mine ? 'me' : ''}${c.locked ? ' locked' : ''}` }, c.mine ? 'YOU' : nameOf(ctx, c.ownerId), c.locked ? ' 🔒' : '')),
  );
}

// ---- your card ----

/** A ready answer's pixel picture at 1× (64 px), or its emoji if the picture can't load. */
function offerPicture(src: string, emoji: string): HTMLElement {
  const img = h('img', { class: 'nb-offer-pic', src, alt: '', draggable: 'false' }) as HTMLImageElement;
  img.onerror = () => img.replaceWith(emoji);
  return img;
}
/** Your card's pixel picture, or its emoji if the picture can't load. */
function picture(src: string, emoji: string): HTMLElement {
  const box = h('span', { class: 'nb-mycard-emoji', 'aria-hidden': 'true' });
  box.append(h('img', { class: 'nb-mycard-pic', src, alt: '', draggable: 'false', onerror: () => box.replaceChildren(emoji) }));
  return box;
}

function timeCard(me: Me, compact = false): HTMLElement | null {
  const t = me.time;
  if (!t) return null;
  return h(
    'div',
    { class: `nb-mycard${compact ? ' compact' : ''}` },
    picture(t.picture, t.emoji),
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
      : speakBox({ label: 'Hold and say it', placeholder: PLACEHOLDER[game.unit ?? ''] ?? '〜ます。', maxLength: MAX_ANSWER_LENGTH, kanaPadOpen: me.level === 'kana', onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }) }),
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
    me.frames.length ? h('div', { class: 'nb-frames' }, h('span', { class: 'nb-frames-label' }, 'Patterns:'), me.frames.map((f) => h('span', { class: 'nb-frame', lang: 'ja' }, f, romaji ? h('small', {}, toRomaji(f)) : null))) : null,
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
              h('span', { class: 'nb-offer-emoji', 'aria-hidden': 'true' }, offerPicture(o.picture, o.emoji)),
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
  const move = (dir: -1 | 1) => () => {
    buzz(30);
    void send({ kind: 'move', dir, round: game.round });
  };
  const before = game.line[me.position - 1];
  if (me.againFrom.length) buzz(80);
  return h(
    'div',
    { class: 'screen' },
    me.againFrom.length
      ? h(
          'div',
          { class: 'nb-again-p' },
          h('p', {}, `🙋 ${me.againFrom.join(', ')} asked to hear yours again`),
          speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }) }),
        )
      : null,
    hardOffer(ctx, me),
    boothGist(me.standIn),
    // Experiment standInCurveball: a Gallery tile on Nobiko-san's defence (or the once-a-game curveball).
    gallery(ctx, me),
    ends(game),
    timeCard(me, true) ?? (me.secret !== null ? secret(me) : null),
    me.said && game.kind !== 'time' ? h('p', { class: 'hint' }, 'Your answer: ', h('span', { lang: 'ja' }, me.said.text)) : null,
    miniLine(ctx),
    h('p', { class: 'nb-pos' }, `Your card: ${me.position + 1} of ${n}`, before ? ` · after ${nameOf(ctx, before.ownerId)}` : ' · at the low end'),
    h(
      'div',
      { class: 'nb-arrows' },
      h('button', { type: 'button', class: 'nb-arrow', disabled: !me.canMove.left, 'aria-label': 'Move my card towards the low end', onclick: move(-1) }, '◀'),
      h('button', { type: 'button', class: 'nb-arrow', disabled: !me.canMove.right, 'aria-label': 'Move my card towards the high end', onclick: move(1) }, '▶'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: `primary nb-lock${me.locked ? ' on' : ''}`,
        'aria-pressed': me.locked ? 'true' : 'false',
        onclick: () => {
          buzz(40);
          void send({ kind: 'lock', locked: !me.locked, round: game.round });
        },
      },
      me.locked ? h('span', {}, '🔒 ', h('span', { lang: 'ja' }, 'きめた！'), ' (tap to unlock)') : h('span', {}, h('span', { lang: 'ja' }, 'きめた！'), ' Happy with my spot'),
    ),
    h('p', { class: 'hint' }, 'Talk it over out loud. Moving a card unlocks it and its neighbour.'),
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
  // Nothing here until the TV's last card is over: the phone mustn't spoil the flip.
  const left = f ? flipMs(f.steps) - since(ctx.view) : 0;
  const voted = game.line.find((c) => c.id === me.votedFor);
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, 'Look at the TV! 🪢'),
    // Experiment standInCurveball: the stand-in's Gallery, carried on from a line-up that ended while she spoke.
    gallery(ctx, me),
    left > 0 ? h('p', { class: 'nb-turning', style: `--d: ${Math.round(left)}ms` }, 'Nobiko-san is turning the cards over…') : null,
    h(
      'div',
      { class: 'nb-after', style: `--d: ${Math.round(Math.max(0, left))}ms` },
    f ? h('p', { class: 'nb-points' }, `+${f.teamPoints} team`, me.bonus ? h('span', {}, ` · +${me.bonus} for saying it`) : null) : null,
    me.canVote
      ? h(
          'div',
          { class: 'nb-vote' },
          h('p', { class: 'nb-vote-title' }, '❤ The funniest answer?'),
          others.map((c) =>
            h(
              'button',
              { type: 'button', class: 'option nb-vote-opt', onclick: () => void send({ kind: 'vote', cardId: c.id, round: game.round }) },
              h('span', { lang: 'ja' }, '❤ ', c.text ?? ''),
              me.level === 'kana' && c.text ? h('small', { class: 'nb-offer-romaji' }, toRomaji(c.text)) : null,
              h('small', {}, nameOf(ctx, c.ownerId)),
            ),
          ),
        )
      : voted
        ? h('p', { class: 'hint' }, `❤ Sent: ${nameOf(ctx, voted.ownerId)}’s answer`)
        : null,
    game.more ? h('p', { class: 'nb-phrase' }, 'Arguing tip: ', h('span', { lang: 'ja' }, `Aさんの ほうが ${game.more.text}！`), h('small', {}, ` A’s is ${game.more.en}!`)) : null,
    ),
    isVip && game.kind !== 'time' ? vipHide(ctx) : null,
  );
}

const JOIN_EN: Record<string, string> = { 'そして…': 'and then', 'それから…': 'after that', 'しかも…': 'on top of that', 'さいごに…': 'and finally' };

function storyScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const st = game.story;
  if (!me.performing) {
    const cur = st?.current ? game.line.find((c) => c.id === st.current) : undefined;
    if (!cur) return waiting('Listen to the story 📖');
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, 'Listen to the story 📖'),
      h('p', {}, `${nameOf(ctx, cur.ownerId)} is reading:`),
      h('p', { class: 'nb-story-p', lang: 'ja' }, joiner(st!.index, st!.order.length), h('strong', {}, cur.text ?? '')),
    );
  }
  const first = st?.index === 0;
  const join = st ? joiner(st.index, st.order.length).trim() : '';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎤 Your line!'),
    h('p', { class: 'nb-story-p', lang: 'ja' }, first ? '' : `${join} `, h('strong', {}, me.performing.text)),
    h('p', { class: 'hint' }, first ? 'You start the story. Read it out with feeling!' : `Start with ${join.replace('…', '')} (${JOIN_EN[join] ?? 'and then'}…), and read it out with feeling.`),
    speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'perform', utterance, round: game.round }) }),
    h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'perform', pass: true, round: game.round }) }, 'Skip my line'),
  );
}

/** The N4 defence, offered during the line-up: the shared offer card (Take it before the line-up ends, or not). */
function hardOffer(ctx: Ctx, me: Me): HTMLElement | null {
  const hard = me.hard;
  if (!hard) return null;
  const send = (accept: boolean) => void ctx.send({ kind: 'hard', accept, round: ctx.game.round });
  if (hard.answer === 'accepted') return h('div', { class: 'nb-hard' }, h('p', {}, '🎙 After the line-up, say why your card goes where it is, with ', h('span', { lang: 'ja' }, '〜ので'), '.'), h('button', { type: 'button', class: 'linkish', onclick: () => send(false) }, 'Not this time after all'));
  return roleOffer({
    kicker: '🎙 Nobiko-san wants to hear your reason.',
    pitch: 'After the line-up, say why your card goes where it is, with 〜ので.',
    onTake: () => send(true),
    onDecline: () => send(false),
    extra: [h('p', { class: 'hint' }, 'Answer before the line-up ends, or the chance passes.')],
  });
}

/** Kana and N5 phones, during the N4 defence's replay: what was said, at their level (never a correction), and the card. */
function gistScreen(ctx: Ctx, me: Me): HTMLElement {
  const g = me.gist!;
  return h(
    'div',
    { class: 'screen nb-gist' },
    g.picture ? h('img', { class: 'nb-gist-pic', src: g.picture, alt: '' }) : null,
    boothGist({ ...g, emoji: g.picture ? null : g.emoji }),
    gallery(ctx, me),
  );
}

/** My Gallery tile while someone else gives the N4 defence. */
function gallery(ctx: Ctx, me: Me): HTMLElement | null {
  return galleryTile(me.gallery, (pick, utterance) => void ctx.send({ kind: 'gallery', pick, utterance, round: ctx.game.round }));
}

/** The N4 defence: the ので frame for where the card ended up, and two model lines to read out. */
function hardDefence(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const script = me.hard!.script!;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎤 Defend your card!'),
    h('p', {}, 'Say why it goes where it is.'),
    me.said ? h('p', { class: 'hint' }, 'Your card: ', h('span', { lang: 'ja' }, me.said.text)) : null,
    timeCard(me, true) ?? secret(me),
    h('p', { class: 'nb-pos' }, defenceSpot(ctx, me)),
    h('p', { class: 'nb-frame', lang: 'ja' }, script.frame.text, h('small', {}, ` ${script.frame.en}`)),
    h('p', { class: 'nb-hard-label' }, 'Read one out, or say your own:'),
    h(
      'div',
      { class: 'nb-hard-lines' },
      script.lines.map((l) => jpView(l, me.level, { cls: 'nb-hard-line' })),
    ),
    speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'defend', utterance, round: game.round }) }),
    h('p', { class: 'hint' }, 'Say it out loud for the bonus: a typed defence doesn’t score.'),
    h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'defend', pass: true, round: game.round }) }, 'Not this time after all'),
  );
}

function defenceSpot(ctx: Ctx, me: Me): string {
  const line = ctx.game.line;
  const i = line.findIndex((c) => c.mine);
  const l = line[i - 1];
  const r = line[i + 1];
  return l && r ? `Between ${nameOf(ctx, l.ownerId)} and ${nameOf(ctx, r.ownerId)}` : l ? `At the high end, after ${nameOf(ctx, l.ownerId)}` : r ? `At the low end, before ${nameOf(ctx, r.ownerId)}` : '';
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
        if (me?.defending && me.hard?.script) return hardDefence(ctx, me);
        if (me?.defending)
          return h(
            'div',
            { class: 'screen' },
            h('p', { class: 'big' }, '🎤 Defend your card!'),
            h('p', {}, 'It moved the most. Say why it belongs there.'),
            me.said ? h('p', { class: 'hint' }, 'Your answer: ', h('span', { lang: 'ja' }, me.said.text)) : null,
            secret(me),
            h('p', { class: 'nb-pos' }, defenceSpot(ctx, me)),
            h('p', { class: 'nb-frame', lang: 'ja' }, '〜からです。', h('small', {}, ' It’s because …')),
            speakBox({ label: 'Hold and say it', placeholder: 'Type it', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'defend', utterance, round: game.round }) }),
            h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'defend', pass: true, round: game.round }) }, 'Pass'),
          );
        if (me?.gist) return gistScreen(ctx, me);
        if (me?.gallery) return h('div', { class: 'screen' }, h('p', { class: 'big' }, 'Look at the TV!'), game.defence ? h('p', {}, `${nameOf(ctx, game.defence.playerId)} is defending their card…`) : null, gallery(ctx, me));
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
