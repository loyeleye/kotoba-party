// Omiai Matchmaker on the phone: hear the guest's question, say your answer first (N5/N4), then
// build it from tiles where polite and casual endings sit side by side; vote for the most
// charming answer; then your private manners tip and the polite version to say back.

import { h } from '../../../shared/src/dom.js';
import { guestPic } from '../../../shared/src/art.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { OmiaiView } from '../../../shared/src/modes/views.js';
import { invitation, type QuestionView, type TileView, type TipView } from '../../../shared/src/modes/omiai/omiai.js';
import type { Register } from '../../../shared/src/modes/omiai/manners.js';
import { canSpeak, speakBox } from '../components/speak.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { PhoneContext, PhoneMode } from './types.js';
import { roleOffer } from '../components/roleOffer.js';
import { boothGist, galleryTile } from '../components/gallery.js';

type Ctx = PhoneContext<OmiaiView>;

const REGISTER: Record<Register, { label: string; line: string }> = {
  keigo: { label: '🫖 Keigo!', line: 'The family is delighted: polite and with keigo.' },
  polite: { label: '😊 Polite', line: 'Every sentence ended politely.' },
  mixed: { label: '🙂 Nearly', line: 'Some sentences were polite, some casual.' },
  plain: { label: '🤔 Plain', line: 'Plain form: fine with friends, a bit bare for a formal introduction.' },
  casual: { label: '😳 Casual', line: 'Casual words! The teacups rattled a little.' },
  none: { label: '🙃 English', line: 'An English answer: votes still count, but no manners bonus.' },
};

const ROLE_TITLE: Record<TileView['role'], string> = { opener: 'Start', lead: '', fill: 'Answer', ending: 'Ending', closer: 'Finish' };

function questionCard(q: QuestionView, small = false): HTMLElement {
  // Romaji comes only for かな players, so it tells us the level (components/jp.ts).
  return jpView(q, q.romaji ? 'kana' : 'n5', { cls: `omi-q${small ? ' small' : ''}` });
}

function guestLine(game: OmiaiView): HTMLElement | null {
  const c = game.card;
  return c ? h('p', { class: 'omi-guest-p' }, guestPic(c, 'omi-guest-p-emoji'), h('span', { lang: 'ja' }, c.name.text), h('small', {}, ` ${c.name.en}`)) : null;
}

function meterBar(value: number): HTMLElement {
  return h('div', { class: 'omi-meter-p', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': 'Manners meter' }, h('span', { style: `width: ${value}%` }), h('b', {}, `${value}`));
}

// ---- the go-between (なこうど, N4 hard role) ----

/** The round's go-between script: take it and say or type it, or "not this time" (Nobiko-san takes it back). */
function nakodoCard(ctx: Ctx): HTMLElement | null {
  const g = ctx.game.me?.nakodo;
  if (!g || !g.slot) return null;
  if (g.status === 'declined' || g.status === 'timeout') return h('p', { class: 'hint omi-nakodo' }, '🎎 Nobiko-san has the matchmaker’s lines this round.');
  // The line has passed without a try (the question was read, or the opening never tried): nothing to show.
  if (!g.ok && !g.canSay && !g.heard) return null;
  const what = g.slot === 'open' ? 'Introduce the guest' : 'Close the round';
  if (g.ok)
    return h('div', { class: 'omi-nakodo' }, h('p', {}, h('strong', {}, `🎎 Beautifully said! +${g.points}`)), h('p', { lang: 'ja' }, g.line?.text ?? ''), g.meter !== null ? meterBar(g.meter) : null);
  const speak = g.canSay
    ? speakBox({
        label: 'Hold and say it',
        placeholder: 'Type the line (kana)',
        maxLength: MAX_ANSWER_LENGTH,
        onSend: (utterance) => void ctx.send({ kind: 'nakodo', utterance, round: ctx.game.round }),
      })
    : null;
  // The shared offer card; saying the line straight away counts as taking it.
  if (g.canSay && g.status === 'offered')
    return h(
      'div',
      { class: 'omi-nakodo' },
      roleOffer({
        kicker: '🎎 Nobiko-san hands you her fan.',
        role: { text: 'なこうど', kana: 'なこうど', en: 'Matchmaker' },
        pitch: `Speak for the matchmaker this round. ${what}, in keigo:`,
        onTake: () => void ctx.send({ kind: 'nakodo', accept: true, round: ctx.game.round }),
        onDecline: () => void ctx.send({ kind: 'nakodo', accept: false, round: ctx.game.round }),
        extra: [g.line ? jpView(g.line, 'n4', { cls: 'omi-nakodo-line' }) : null, speak],
      }),
    );
  return h(
    'div',
    { class: 'omi-nakodo' },
    h('p', {}, h('strong', {}, `🎎 You’re the matchmaker (なこうど) this round. ${what}, in keigo:`), g.n3 ? h('span', { class: 'omi-n3' }, ' N3') : null),
    g.line ? jpView(g.line, 'n4', { cls: 'omi-nakodo-line' }) : null,
    // Green Car: the N3 form, an optional stretch (either is accepted).
    g.stretch
      ? h('details', { class: 'omi-stretch' }, h('summary', {}, h('span', { class: 'omi-n3' }, 'N3'), ' Stretch: or say it this way'), jpView(g.stretch, 'n4', { cls: 'omi-nakodo-line' }))
      : null,
    g.heard
      ? h(
          'p',
          { class: 'hint' },
          `Heard “${g.heard}”. Say the whole line as written: the keigo words (おつきに なりました, いらっしゃいます, まいります) are what counts. ${g.triesLeft} ${g.triesLeft === 1 ? 'try' : 'tries'} left.`,
        )
      : null,
    speak,
  );
}

// ---- answering ----

function sayFirst(ctx: Ctx, q: QuestionView, ms: number): HTMLElement {
  const { game, send } = ctx;
  const countdown = h('p', { class: 'omi-count' }, `Tiles in ${Math.round(ms / 1000)}…`);
  const el = h(
    'div',
    { class: 'screen' },
    guestLine(game),
    questionCard(q),
    h('p', { class: 'big omi-sayfirst' }, canSpeak() ? 'Say it first! 🎤' : 'From memory first! ⌨️'),
    h('p', { class: 'hint' }, canSpeak() ? 'Answer from memory, politely: end with です or ます. Saying it now earns the most.' : 'Type your answer from memory, politely: end with です or ます. That earns the most.'),
    speakBox({ label: 'Hold and answer the guest', placeholder: 'Type your answer', maxLength: MAX_ANSWER_LENGTH, onSend: (utterance) => void send({ kind: 'answer', utterance, round: game.round }) }),
    countdown,
  );
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (!el.isConnected) return clearInterval(timer);
    const left = ms - (Date.now() - startedAt);
    if (left > 0) countdown.textContent = `Tiles in ${Math.ceil(left / 1000)}…`;
    else {
      clearInterval(timer);
      countdown.textContent = 'Here come the tiles…';
      void send({ kind: 'tiles', round: game.round });
    }
  }, 200);
  return el;
}

function builder(ctx: Ctx, q: QuestionView, tiles: TileView[]): HTMLElement {
  const { game, send, me } = ctx;
  const picked: string[] = [];
  const preview = h('p', { class: 'omi-preview', lang: 'ja' });
  const groups = h('div', { class: 'omi-groups' });
  const sendBtn = h('button', { type: 'button', class: 'primary', disabled: true, onclick: () => picked.length && void send({ kind: 'answer', tiles: [...picked], round: game.round }) }, 'Send my answer') as HTMLButtonElement;
  const textOf = () =>
    picked
      .map((k) => tiles.find((t) => t.key === k)!)
      .map((t, i, all) => t.text + (t.role === 'lead' && i < all.length - 1 ? ' ' : ''))
      .join('');
  const draw = () => {
    const text = textOf();
    preview.textContent = text || 'Tap tiles to build your answer';
    preview.classList.toggle('empty', !text);
    sendBtn.disabled = !picked.length;
    const roles = [...new Set(tiles.map((t) => t.role))];
    groups.replaceChildren(
      ...roles.map((role) =>
        h(
          'div',
          { class: 'omi-group' },
          ROLE_TITLE[role] ? h('p', { class: 'omi-group-title' }, ROLE_TITLE[role]) : null,
          h(
            'div',
            { class: 'omi-tiles' },
            tiles
              .filter((t) => t.role === role)
              .map((t) => {
                const on = picked.includes(t.key);
                return h(
                  'button',
                  {
                    type: 'button',
                    class: `omi-tile${on ? ' on' : ''}`,
                    'aria-pressed': on ? 'true' : 'false',
                    onclick: () => {
                      if (on) picked.splice(picked.indexOf(t.key), 1);
                      else if (picked.length < 6) {
                        // One tile per part, except openers: tapping another ending swaps it.
                        if (role !== 'opener') {
                          const same = picked.findIndex((k) => tiles.find((x) => x.key === k)?.role === role);
                          if (same >= 0) picked.splice(same, 1);
                        }
                        picked.push(t.key);
                      }
                      draw();
                    },
                  },
                  h('span', { class: 'omi-tile-jp', lang: 'ja' }, t.text),
                  t.romaji ? h('small', { class: 'omi-tile-romaji' }, t.romaji) : null,
                  h('small', {}, t.en),
                );
              }),
          ),
        ),
      ),
    );
  };
  draw();
  return h(
    'div',
    { class: 'screen' },
    guestLine(game),
    questionCard(q, true),
    preview,
    groups,
    sendBtn,
    h('p', { class: 'hint' }, 'Even better: read your answer out loud to send it.'),
    speakBox({ label: 'Hold and say your answer', placeholder: 'Or type it', maxLength: MAX_ANSWER_LENGTH, kanaPadOpen: me.level === 'kana', onSend: (utterance) => void send({ kind: 'answer', utterance, round: game.round }) }),
  );
}

// ---- after the vote ----

function tipBlock(t: TipView, compact = false): HTMLElement {
  const reg = REGISTER[t.register];
  return h(
    'div',
    { class: 'omi-tip' },
    h('div', { class: 'omi-tip-head' }, h('span', { class: `omi-chip omi-chip-${t.register}` }, reg.label), meterBar(t.meter)),
    h('p', { class: 'hint' }, reg.line),
    t.good.length ? h('p', { class: 'omi-good' }, '✓ ', t.good.join(' · ')) : null,
    t.casual.length && !compact ? h('ul', { class: 'omi-casual' }, t.casual.map((c) => h('li', {}, h('span', { lang: 'ja' }, `${c.text} → ${c.polite}`), h('small', {}, c.note)))) : null,
  );
}

function targetBlock(t: TipView['target'], label: string, note?: string): HTMLElement {
  return h(
    'div',
    { class: 'omi-target' },
    h('p', { class: 'omi-target-label' }, label),
    jpView({ ...t, en: null }, t.romaji ? 'kana' : 'n5'),
    note ? h('p', { class: 'omi-target-note' }, note) : null,
  );
}

const TARGET_LABEL: Record<TipView['kind'], string> = {
  rewrite: 'More polite:',
  upgrade: 'One step up (keigo):',
  perfect: 'Say it once more:',
  stock: 'A polite answer:',
};

function encoreScreen(ctx: Ctx): HTMLElement {
  const { game, send } = ctx;
  const mine = game.me!;
  const e = mine.encore!;
  const t = mine.tip!;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, e.winner ? '💐 Your answer won the vote!' : 'Your manners meter'),
    tipBlock(t),
    targetBlock(e.target, TARGET_LABEL[t.kind], t.note),
    e.ok
      ? h('p', { class: 'omi-heard ok' }, '🙇 Beautiful. The guest bows back.')
      : e.canEncore
        ? h(
            'div',
            { class: 'omi-encore' },
            e.heard ? h('p', { class: 'omi-heard' }, `Heard “${e.heard}”. ${e.triesLeft} more ${e.triesLeft === 1 ? 'try' : 'tries'}.`) : h('p', { class: 'hint' }, 'Say it out loud (with a little bow) for a bonus.'),
            speakBox({ label: 'Hold and say it politely', placeholder: 'Type it', onSend: (utterance) => void send({ kind: 'encore', utterance, round: game.round }) }),
            h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'encore', pass: true, round: game.round }) }, 'Skip this time'),
          )
        : h('p', { class: 'hint' }, 'Say it out loud anyway!'),
  );
}

function scoreScreen(ctx: Ctx): HTMLElement {
  const { game } = ctx;
  const t = game.me?.tip;
  if (!t) return waiting('Look at the TV!', game.round < game.totalRounds ? 'Next question coming up…' : 'The guest is deciding…');
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, t.points ? `+${t.points} this round` : 'Round over'),
    t.votes ? h('p', { class: 'omi-hearts' }, `${'❤'.repeat(Math.min(t.votes, 8))} ${t.votes} ${t.votes === 1 ? 'vote' : 'votes'}`) : null,
    h('p', { class: 'hint' }, 'You said: ', h('span', { lang: 'ja' }, t.mine)),
    tipBlock(t, true),
    t.kind === 'rewrite' || t.kind === 'upgrade' ? targetBlock(t.target, TARGET_LABEL[t.kind], t.note) : null,
    t.next ? h('p', { class: 'omi-next' }, 'Next level: ', h('span', { lang: 'ja' }, t.next.text), h('small', {}, ` ${t.next.note}`)) : null,
    h('div', { class: 'omi-example' }, h('p', { class: 'omi-target-label' }, 'The textbook answer:'), h('p', { lang: 'ja' }, t.example.text), h('small', {}, t.example.en)),
    t.keigo
      ? h(
          'div',
          { class: 'omi-keigo' },
          h('p', { class: 'omi-target-label' }, `Keigo corner: ${t.keigo.en}`),
          h(
            'table',
            {},
            h('tr', {}, h('th', {}, 'polite'), h('td', { lang: 'ja' }, t.keigo.polite)),
            h('tr', {}, h('th', {}, 'about them'), h('td', { lang: 'ja' }, t.keigo.honorific)),
            h('tr', {}, h('th', {}, 'about you'), h('td', { lang: 'ja' }, t.keigo.humble)),
          ),
        )
      : null,
  );
}

export const omiaiPhone: PhoneMode<OmiaiView> = {
  key: (view, game) => [view.phaseSeq, JSON.stringify(game.me), view.phase === 'reveal' ? game.answers.map((a) => a.id + a.hidden).join(',') : ''].join('|'),

  render(ctx) {
    const { view, game, send, isVip } = ctx;
    const mine = game.me;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'おみあい マッチメーカー'),
          guestLine(game),
          game.card ? h('p', { class: 'hint' }, game.card.quirk) : null,
          h('p', {}, '🙇 The guest asks everyone a question. Answer in Japanese, as politely as you can: です / ます, はじめまして, よろしく おねがいします.'),
          h('p', {}, `❤ Then vote for the most charming answer. At the end, the guest invites one of you ${invitation(game.card).to}.`),
          h('p', { class: 'hint' }, 'Casual answers never lose points. You just get a tip for next time.'),
        );
      case 'prompt':
        return h(
          'div',
          { class: 'screen' },
          guestLine(game),
          nakodoCard(ctx),
          // Players without the go-between's seat: a reaction tile (or the curveball); Kana and N5 phones get the gist.
          galleryTile(mine?.gallery ?? null, (pick, utterance) => void send({ kind: 'gallery', pick, utterance, round: game.round })),
          boothGist(mine?.gist ?? null),
          game.question ? questionCard(game.question) : null,
          // Not while you're the one speaking: the answer screen waits for you.
          mine?.nakodo?.canSay ? null : h('p', { class: 'hint' }, 'Listen… your answer screen opens in a moment.'),
        );
      case 'answer': {
        if (!mine) return waiting('Look at the TV!');
        if (mine.answer !== null) return waiting('Answer sent 💌', `“${mine.answer}”. Waiting for the others…`);
        const slot = mine.slot;
        if (!slot) return waiting('Look at the TV!');
        return slot.sayFirst && mine.level !== 'kana' ? sayFirst(ctx, slot.question, slot.sayFirstMs) : builder(ctx, slot.question, slot.tiles);
      }
      case 'reveal': {
        if (!mine) return waiting('Look at the TV!');
        const others = game.answers.filter((a) => !a.mine && !a.hidden);
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, mine.votedFor ? 'Vote in ❤' : 'Which answer is the most charming?'),
          mine.canVote
            ? others.map((a) =>
                h(
                  'button',
                  { type: 'button', class: 'option omi-vote', onclick: () => void send({ kind: 'vote', answerId: a.id, round: game.round }) },
                  h('span', { lang: 'ja' }, '❤ ', a.text),
                  mine.level === 'kana' ? h('small', { class: 'omi-vote-romaji' }, toRomaji(a.text)) : null,
                ),
              )
            : h('p', { class: 'hint' }, mine.votedFor ? 'Waiting for the other votes…' : 'Listen to the answers on the TV.'),
          isVip && game.answers.length
            ? h(
                'details',
                { class: 'omi-vip' },
                h('summary', {}, 'VIP: hide an answer'),
                game.answers.filter((a) => !a.hidden).map((a) => h('button', { type: 'button', class: 'vip-hide', onclick: () => void send({ kind: 'hide', answerId: a.id, round: game.round }) }, '🚫 Hide ', h('span', { lang: 'ja' }, `“${a.text}”`))),
              )
            : null,
        );
      }
      case 'encore':
        if (mine?.encore && mine.tip) return encoreScreen(ctx);
        return waiting('Look at the TV!', 'The manners meter is up.');
      case 'score': {
        const g = nakodoCard(ctx);
        return g ? h('div', { class: 'screen' }, g, scoreScreen(ctx)) : scoreScreen(ctx);
      }
      case 'finale':
        return mine?.accepted
          ? h('div', { class: 'screen omi-accepted' }, h('p', { class: 'omi-accept-big' }, invitation(game.card).emoji), h('p', { class: 'big' }, invitation(game.card).you), game.finale?.line ? h('p', { lang: 'ja' }, game.finale.line.text) : null, h('p', { class: 'hint' }, 'Say it: ありがとう ございます！'))
          : waiting('The guest has chosen…', game.finale?.accepted ? 'Thank you for coming. おつかれさまでした！' : invitation(game.card).all);
      default:
        return waiting('Look at the TV!');
    }
  },
};
