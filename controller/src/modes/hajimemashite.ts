// はじめまして！ on the phone. One screen per step:
//
//   guest    the guest writes their name in katakana (the first time) and says はじめまして;
//            everyone else answers こちらこそ、よろしく おねがいします.
//   write    in silence: your role (the guest, a tanuki or a detective), the card's frame with its
//            blank, your tiles (the guest sees every tile, a tanuki only their own hand) and a keyboard.
//   intro    the introducer reads one line at a time: Kana players see the whole line, N5 the frame
//            and the word to put in it, N4 only the word (on a verb card, the verb in the dictionary
//            form, to say in the た or て form; the model line follows). 「ポン、たすけて！」 hands a line
//            to Pon. The guest may veto a lie before it's read. Everyone else listens.
//   rank     tap the cards in order, surely true first; argue out loud. The guest picks the lie they
//            wish were true.
//   truth    after the TV's flip: your points; a tanuki claims their lie (ドロン！), the guest refutes
//            each lie and says the truth.
//   おぼえてる？ say (or tap) the true thing about each other guest.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import { flipAt, flipMs, MAX_WORD } from '../../../shared/src/modes/hajimemashite/hajimemashite.js';
import { fillFrame } from '../../../shared/src/modes/hajimemashite/cards.js';
import type { HajimeView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { speakBox } from '../components/speak.js';
import { kanaPad } from '../components/kanaPad.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';
import { n4Up } from '../../../shared/src/level.js';

type Ctx = PhoneContext<HajimeView>;
type Me = NonNullable<HajimeView['me']>;

const nameOf = (ctx: Ctx, id: string | null | undefined): string => ctx.view.players.find((p) => p.id === id)?.name ?? '';

// The flip is timed from when this phone first saw the phase, so results wait for the TV's last card.
let shown = { seq: -1, at: 0 };
function since(view: RoomView): number {
  if (shown.seq !== view.phaseSeq) shown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - shown.at;
}

const send = (ctx: Ctx, move: Record<string, unknown>): Promise<boolean> => ctx.send({ ...move, turn: ctx.game.turn });

/** A line of Japanese with romaji under it for Kana players. */
function line(text: string, level: Me['level'], cls = 'hj-line-p'): HTMLElement {
  return h('div', { class: cls }, h('p', { class: 'hj-ja', lang: 'ja' }, text), level === 'kana' ? h('p', { class: 'hj-romaji' }, toRomaji(text)) : null);
}

/** A plain typing box (no microphone: writing is silent), with the kana pad. */
function typeBox(placeholder: string, onSend: (text: string) => void, padOpen = false, value = ''): HTMLElement {
  const input = h('input', { maxlength: MAX_ANSWER_LENGTH, placeholder, lang: 'ja', enterkeyhint: 'send', autocomplete: 'off', value }) as HTMLInputElement;
  const pad = h('div', {});
  let open = false;
  const toggle = () => {
    open = !open;
    pad.replaceChildren(...(open ? [kanaPad(input)] : []));
  };
  if (padOpen) toggle();
  return h(
    'form',
    {
      class: 'typed hj-type',
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (input.value.trim()) onSend(input.value.trim());
      },
    },
    h('div', { class: 'typed-row' }, input, h('button', { type: 'button', class: 'secondary pad-toggle', onclick: toggle }, 'かな'), h('button', { type: 'submit', class: 'secondary' }, 'OK')),
    pad,
  );
}

// ---- the guest ----

function guestScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game } = ctx;
  if (!me.nameSet)
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, '👋 You’re tonight’s guest!'),
      h('p', {}, 'First, your name in katakana, the way every Japanese class starts. Fix it if it’s off:'),
      typeBox(
        'カタカナ',
        (text) => void send(ctx, { kind: 'name', text }).then(() => ctx.flash('✓')),
        me.level === 'kana',
        me.nameSuggest,
      ),
      me.level === 'kana' ? h('p', { class: 'hint' }, `${me.nameSuggest} · ${toRomaji(me.nameSuggest)}`) : null,
    );
  const greet = `はじめまして。${me.name}です。よろしく おねがいします。`;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '👋 Greet the room'),
    line(greet, me.level),
    h('p', { class: 'hint' }, 'Nice to meet you. I’m …. Please be kind to me. Bow a little as you say it!'),
    me.greeted
      ? h('p', { class: 'hj-ok' }, '✓ The room heard you. Your card is next.')
      : speakBox({ label: 'Hold and say it', placeholder: 'はじめまして…', autoSend: true, kanaPadOpen: me.level === 'kana', onSend: (utterance) => void send(ctx, { kind: 'greet', utterance }) }),
    h('p', { class: 'hint' }, `Your card: ${game.card?.title.text ?? ''} (${game.card?.title.en ?? ''})`),
  );
}

function welcomeScreen(ctx: Ctx, me: Me): HTMLElement {
  const reply = me.level === 'kana' ? 'こちらこそ！' : 'こちらこそ、よろしく おねがいします！';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, `Tonight’s guest: ${ctx.game.guestName}さん`),
    h('p', {}, 'Answer their greeting:'),
    line(reply, me.level),
    h('p', { class: 'hint' }, me.level === 'kana' ? 'Likewise! (こちらこそ: “the same from me”)' : 'Likewise, nice to meet you. (こちらこそ: “the same from me”)'),
    me.kochira
      ? h('p', { class: 'hj-ok' }, '✓ Said!')
      : !me.greeted
        ? h('p', { class: 'hint' }, `👂 Wait for ${ctx.game.guestName}さん’s はじめまして, then answer.`)
      : h(
          'div',
          {},
          speakBox({ label: 'Hold and say it', speechOnly: true, autoSend: true, onSend: (utterance) => void send(ctx, { kind: 'kochira', utterance }) }),
          h('button', { type: 'button', class: 'secondary', onclick: () => void send(ctx, { kind: 'kochira', utterance: { via: 'tap', text: reply } }) }, 'Tap instead'),
        ),
  );
}

// ---- writing ----

/** A verb card's form, as the phones name it. */
const FORM = { ta: { name: 'た', example: 'のぼる → のぼった' }, te: { name: 'て', example: 'たべる → たべて' } } as const;

const ROLE_COPY = {
  guest: { title: '✍ Write the truth', sub: 'One true thing about you. Something the people who know you could spot!' },
  tanuki: { title: '🦝 You’re a tanuki!', sub: 'Write a lie about the guest that sounds true. In silence: nobody hears it until the reveal.' },
  detective: { title: '🔍 Detective', sub: 'Guess the truth. It’s never shown; if you’re right, しってた！ scores.' },
} as const;

function writeScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game } = ctx;
  const card = game.card;
  const role = me.role ?? 'detective';
  const copy = ROLE_COPY[role];
  // A verb card shows its cue (＿た ことが あります) and the tiles in the dictionary form.
  const frame = role === 'guest' ? (card?.cue ?? card?.first ?? '') : (card?.cueThird ?? card?.third ?? '');
  const [before, after] = frame.split('＿');
  const word = me.written?.dict ?? me.written?.word;
  const form = card?.conj ? FORM[card.conj] : null;
  const write = (move: Record<string, unknown>) =>
    void ctx.send({ ...move, turn: game.turn }).then((ok) => {
      if (ok) ctx.flash('✓');
    });
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, copy.title),
    h('p', { class: 'hint' }, copy.sub),
    card ? h('p', { class: 'hj-cardname' }, h('span', { lang: 'ja' }, card.title.text), ` · ${card.title.en}`) : null,
    h('p', { class: 'hj-frame-p', lang: 'ja' }, before ?? '', h('span', { class: `hj-blank-p${word ? ' on' : ''}` }, word ?? '＿＿'), after ?? ''),
    !n4Up(me.level) && card ? h('p', { class: 'hint' }, role === 'guest' ? card.en : card.enThird) : null,
    me.level === 'kana' && frame ? h('p', { class: 'hj-romaji' }, toRomaji(fillFrame(frame, word ?? '＿', game.guestName))) : null,
    form ? h('p', { class: 'hint' }, `Pick a verb. When it’s said out loud, it goes in the ${form.name} form (${form.example}).`) : null,
    h(
      'div',
      { class: 'hj-tiles' },
      me.hand.map((t) =>
        h(
          'button',
          { type: 'button', class: `option hj-tile${me.written?.tileId === t.id ? ' on' : ''}`, onclick: () => write({ kind: 'write', tileId: t.id }) },
          h('span', { class: 'hj-tile-emoji', 'aria-hidden': 'true' }, t.emoji),
          h('span', { class: `hj-tile-jp${[...(t.dict ?? t.kana)].length >= 7 ? ' long' : ''}`, lang: 'ja' }, t.dict ?? t.kana),
          t.romaji ? h('small', { class: 'hj-romaji' }, toRomaji(t.dict ?? t.kana)) : null,
          t.en ? h('small', {}, t.en) : null,
        ),
      ),
    ),
    me.canType
      ? h(
          'details',
          { class: 'hj-own', open: role === 'guest' && n4Up(me.level) ? true : undefined },
          h('summary', {}, role === 'guest' ? 'Not on the list? Type your own' : 'Or type your own'),
          typeBox(
            form ? `In the ${form.name} form: ${form.example.split(' → ')[1]}` : `${MAX_WORD} characters at most`,
            (text) =>
              void ctx.send({ kind: 'write', utterance: { via: 'typed', text }, turn: game.turn }).then((ok) => {
                if (ok) ctx.flash('✓');
              }),
            me.level === 'kana',
          ),
        )
      : null,
    word ? h('p', { class: 'hj-ok' }, `✓ Your card: `, h('strong', { lang: 'ja' }, word), '. You can still change it.') : null,
    h('p', { class: 'hint' }, '🤫 Don’t say it out loud!'),
  );
}

// ---- the introduction ----

function introducerScreen(ctx: Ctx, me: Me): HTMLElement {
  const script = me.script ?? [];
  const at = me.scriptAt;
  const cur = script[at];
  if (!cur) return waiting('🎤 Nicely introduced!', 'Look at the TV.');
  const cardNo = script.slice(0, at).filter((l) => l.kind === 'card').length + 1;
  const total = script.filter((l) => l.kind === 'card').length;
  let prompt: HTMLElement;
  if (cur.kind !== 'card' || me.level === 'kana') prompt = line(cur.text, me.level, 'hj-script-p');
  else if (me.level === 'n5') {
    const [before, after] = cur.frame.split('＿');
    prompt = h('div', { class: 'hj-script-p' }, h('p', { class: 'hj-ja', lang: 'ja' }, before ?? '', h('strong', { class: 'hj-blank-p on' }, cur.word), after ?? ''), h('p', { class: 'hint' }, `Say it about ${ctx.game.guestName}さん.`));
  } else if (cur.dict && cur.cue && ctx.game.card?.conj) {
    // A verb card: the verb in the dictionary form; the introducer says it in the card's form.
    const form = FORM[ctx.game.card.conj];
    prompt = h(
      'div',
      { class: 'hj-script-p' },
      h('p', { class: 'hj-ja big', lang: 'ja' }, cur.dict),
      h('p', { class: 'hint' }, `Make the sentence about ${ctx.game.guestName}さん yourself, with the verb in the ${form.name} form (${form.example}): `, h('span', { lang: 'ja' }, cur.cue)),
    );
  } else prompt = h('div', { class: 'hj-script-p' }, h('p', { class: 'hj-ja big', lang: 'ja' }, cur.word), h('p', { class: 'hint' }, `Make the sentence about ${ctx.game.guestName}さん yourself: ${ctx.game.card?.title.text ?? ''}.`));
  // After a verb card's line: the model, so the form can be checked.
  const prev = script[at - 1];
  const model =
    prev?.dict && n4Up(me.level)
      ? h('p', { class: `hj-model${prev.read === 'said' ? ' ok' : ''}` }, prev.read === 'said' ? '✓ ' : 'The line: ', h('span', { lang: 'ja' }, prev.text))
      : null;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎤 You’re introducing!'),
    h('p', { class: 'hj-steps-p' }, cur.kind === 'open' ? 'Opening line' : cur.kind === 'close' ? 'Closing line' : `Card ${cardNo} of ${total}`),
    model,
    prompt,
    h('p', { class: 'hint' }, 'The card goes up on the TV when you’ve read it. After 12 seconds Pon reads it for you. Read every card the same way: you don’t know which is true either!'),
    h('button', { type: 'button', class: 'linkish hj-help', onclick: () => void send(ctx, { kind: 'read', pon: true }) }, '🐾 ', h('span', { lang: 'ja' }, 'ポン、たすけて！'), ' Pon reads this one (no points for it)'),
    speakBox({ label: 'Hold and read it', placeholder: 'Type it', autoSend: true, kanaPadOpen: me.level === 'kana', draftKey: `hj-read-${ctx.game.turn}-${at}`, onSend: (utterance) => void send(ctx, { kind: 'read', utterance }) }),
  );
}

function listenScreen(ctx: Ctx, me: Me): HTMLElement {
  const read = ctx.game.facts.filter((f) => f.word);
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '👂 Listen!'),
    h('p', {}, ctx.game.introducerId ? `${nameOf(ctx, ctx.game.introducerId)} is introducing ${ctx.game.guestName}さん.` : `Pon is introducing ${ctx.game.guestName}さん.`),
    read.length ? h('ul', { class: 'hj-heard' }, read.map((f) => h('li', {}, h('span', { class: 'hj-lab' }, f.label), h('span', { lang: 'ja' }, f.word ?? '')))) : null,
    me.vetoable.length
      ? h(
          'details',
          { class: 'hj-veto', open: true },
          h('summary', {}, '🙅 A lie about you that you don’t want read out?'),
          h('p', { class: 'hint' }, 'Only you see this. Pon swaps it for one of his own.'),
          me.vetoable.map((v) => h('button', { type: 'button', class: 'secondary', onclick: () => void send(ctx, { kind: 'veto', factId: v.id }) }, '🙅 ', h('span', { lang: 'ja' }, v.word))),
        )
      : null,
  );
}

// ---- ranking ----

const ARGUE_N5 = ['たぶん ほんとう！', 'あやしい！', 'ぜったい うそ！', 'え、ほんとう？'];
const ARGUE_N4 = ['ほんとうだと おもう', 'まさか！'];

function argueBox(ctx: Ctx, me: Me): HTMLElement {
  const phrases = n4Up(me.level) ? [...ARGUE_N5, ...ARGUE_N4, `${ctx.game.guestName}さんらしい！`] : ARGUE_N5;
  return h(
    'details',
    { class: 'hj-argue', open: true },
    h('summary', {}, '🗣 Argue out loud'),
    h('div', { class: 'hj-argue-row' }, phrases.map((p) => h('button', { type: 'button', class: 'chip', onclick: () => void send(ctx, { kind: 'argue', utterance: { via: 'tap', text: p } }) }, h('span', { lang: 'ja' }, p), me.level === 'kana' ? h('small', {}, ` ${toRomaji(p)}`) : null))),
    speakBox({ label: 'Hold and say it', speechOnly: true, autoSend: true, onSend: (utterance) => void send(ctx, { kind: 'argue', utterance }) }),
  );
}

/** The order being tapped, kept across redraws (an argue bubble redraws the screen) until the phase ends. */
let rankDraft: { seq: number; picks: string[] } = { seq: -1, picks: [] };

function rankScreen(ctx: Ctx, me: Me): HTMLElement {
  const cards = me.rankable;
  const seq = ctx.view.phaseSeq;
  if (rankDraft.seq !== seq) rankDraft = { seq, picks: me.ballot ? [...me.ballot] : [] };
  let picks = rankDraft.picks;
  const list = h('ol', { class: 'hj-rank' });
  const status = h('div', { class: 'hj-status' });
  const draw = () => {
    list.replaceChildren(
      ...cards.map((c) => {
        const at = picks.indexOf(c.id);
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `option hj-rank-opt${at >= 0 ? ' on' : ''}`,
              onclick: () => {
                picks = at >= 0 ? picks.slice(0, at) : [...picks, c.id];
                if (picks.length === cards.length - 1) picks.push(cards.find((x) => !picks.includes(x.id))!.id);
                rankDraft.picks = picks;
                draw();
              },
            },
            h('span', { class: 'hj-rank-n' }, at >= 0 ? String(at + 1) : '·'),
            h('span', { class: 'hj-lab' }, c.label),
            h('span', { class: 'hj-tile-jp', lang: 'ja' }, c.word),
            me.level === 'kana' ? h('small', { class: 'hj-romaji' }, toRomaji(c.word)) : null,
          ),
        );
      }),
    );
    const full = picks.length === cards.length;
    const locked = full && !!me.ballot && me.ballot.join() === picks.join();
    status.replaceChildren(
      locked
        ? h('p', { class: 'hj-ok' }, '🔒 Locked in. Tap a card to change from there.')
        : full
          ? h('button', { type: 'button', class: 'primary', onclick: () => void send(ctx, { kind: 'rank', order: picks }) }, h('span', { lang: 'ja' }, 'きめた！'), ' Lock it in')
          : h('p', { class: 'hint' }, picks.length ? `Next: your #${picks.length + 1}` : 'Tap the card you’re surest is TRUE first.'),
    );
  };
  draw();
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '📱 Rank them'),
    h('p', { class: 'hj-ends' }, h('span', { lang: 'ja' }, '1 ぜったい ほんとう'), ' → ', h('span', { lang: 'ja' }, 'ぜったい うそ')),
    ctx.game.facts.length > cards.length ? h('p', { class: 'hint' }, 'Your own tanuki isn’t on your list.') : null,
    list,
    status,
    argueBox(ctx, me),
  );
}

function wishScreen(ctx: Ctx, me: Me): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '💭 Which lie do you wish were true?'),
    h('p', { class: 'hj-ja', lang: 'ja' }, n4Up(me.level) ? 'ほんとうだったら いいな！' : 'これが いい！'),
    me.wishable.map((w) => h('button', { type: 'button', class: `option hj-rank-opt${me.wish === w.id ? ' on' : ''}`, onclick: () => void send(ctx, { kind: 'wish', factId: w.id }) }, h('span', { class: 'hj-lab' }, w.label), h('span', { class: 'hj-tile-jp', lang: 'ja' }, w.word))),
    h('p', { class: 'hint' }, 'Its tanuki scores. Keep a straight face while the room argues!'),
  );
}

// ---- the truth ----

function sayOrTap(label: string, text: string, done: boolean, level: Me['level'], onSay: (u: { via: 'speech' | 'tap'; text: string }) => void, tapText = text): HTMLElement {
  return h(
    'div',
    { class: `hj-say${done ? ' done' : ''}` },
    line(text, level),
    done
      ? h('p', { class: 'hj-ok' }, '✓')
      : h('div', {}, speakBox({ label, speechOnly: true, autoSend: true, onSend: (u) => onSay(u as { via: 'speech'; text: string }) }), h('button', { type: 'button', class: 'linkish', onclick: () => onSay({ via: 'tap', text: tapText }) }, 'Tap instead')),
  );
}

function truthScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game } = ctx;
  const left = game.result ? flipMs(game.result.steps) - since(ctx.view) : 0;
  const total = me.points.reduce((a, p) => a + p.pts, 0);
  // One line at a time, so there is only ever one talk button: claim your tanuki; or, as the guest,
  // wave away each lie and then say the truth.
  // Each line comes up as its card turns on the TV (a beat after the flip starts).
  const elapsed = since(ctx.view);
  const turnsAt = (factId: string | undefined): number => {
    const f = game.facts.find((x) => x.id === factId);
    return f?.flip === undefined ? 0 : flipAt(f.flip, game.facts.length) + 700;
  };
  type Step = { label: string; line: string; tap?: string; at: number; move: (u: Utterance) => Record<string, unknown> };
  const truthId = game.facts.find((f) => f.kind === 'truth')?.id;
  const steps: Step[] = [
    ...(me.claim && !me.claim.done ? [{ label: 'Your tanuki is out! Claim it:', line: 'ドロン！　わたしでした！', at: turnsAt(me.claim.factId), move: (u: Utterance) => ({ kind: 'claim', utterance: u }) }] : []),
    ...me.refute
      .filter((r) => !r.done)
      .map((r) => ({ label: 'That one’s not you! Wave it away:', line: `${r.word}？　ちがいます！`, at: turnsAt(r.factId), move: (u: Utterance) => ({ kind: 'refute', factId: r.factId, utterance: u }) })),
    ...(me.truth && !me.truth.done
      ? [
          me.truth.cue && me.truth.conj
            ? // A verb card: the guest says the form themselves; tapping sends the model line.
              { label: `Now tell them the truth, with the verb in the ${FORM[me.truth.conj].name} form:`, line: me.truth.cue, tap: me.truth.line, at: turnsAt(truthId), move: (u: Utterance) => ({ kind: 'truth', utterance: u }) }
            : { label: 'Now tell them the truth:', line: me.truth.line, at: turnsAt(truthId), move: (u: Utterance) => ({ kind: 'truth', utterance: u }) },
        ]
      : []),
  ].sort((a, b) => a.at - b.at);
  const next = steps[0];
  const said = !!me.claim?.done || !!me.truth?.done;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, 'Look at the TV! 🦝'),
    left > 0 ? h('p', { class: 'hj-turning', style: `--d: ${Math.round(left)}ms` }, 'Pon is turning the cards over…') : null,
    h(
      'div',
      { class: 'hj-after', style: `--d: ${Math.round(Math.max(0, left))}ms` },
      me.points.length ? h('ul', { class: 'hj-points' }, me.points.map((p) => h('li', {}, `+${p.pts} `, p.label)), h('li', { class: 'hj-total' }, `+${total} this turn`)) : h('p', { class: 'hint' }, 'No points this turn. Next one!'),
    ),
    next
      ? h(
          'div',
          { class: 'hj-after', style: `--d: ${Math.round(Math.max(0, next.at - elapsed))}ms` },
          h('p', {}, next.label),
          sayOrTap('Hold and say it', next.line, false, me.level, (utterance) => void send(ctx, next.move(utterance)), next.tap),
          // A verb card tried but not heard in the form yet: the model line, to try again.
          next.tap && me.truth?.said === 'tried' ? h('p', { class: 'hj-model' }, 'The line: ', h('span', { lang: 'ja' }, next.tap)) : null,
        )
      : said
        ? h('div', {}, h('p', { class: 'hj-ok' }, '✓ Said!'), me.truth?.cue ? h('p', { class: 'hj-model ok' }, h('span', { lang: 'ja' }, me.truth.line)) : null)
        : null,
  );
}

// ---- おぼえてる？ ----

function recallScreen(ctx: Ctx, me: Me): HTMLElement {
  const todo = me.recall.find((r) => !r.done);
  const done = me.recall.filter((r) => r.done);
  if (!todo)
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, '✓ All remembered!'),
      h('ul', { class: 'hj-points' }, done.map((r) => h('li', {}, r.done === 'tried' ? '✕ ' : '✓ ', r.name))),
    );
  const [before, after] = todo.frame.split('＿');
  let tapping = false;
  const options = h('div', { class: 'hj-tiles' });
  const showOptions = () => {
    if (tapping) return;
    tapping = true;
    options.replaceChildren(...todo.options.map((o) => h('button', { type: 'button', class: 'option hj-tile', onclick: () => void ctx.send({ kind: 'recall', turn: todo.turn, factId: o.id }) }, h('span', { class: 'hj-tile-jp', lang: 'ja' }, o.word))));
  };
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big', lang: 'ja' }, 'おぼえてる？'),
    h('p', {}, `What’s true about ${todo.name}さん? Say the whole sentence:`),
    h('p', { class: 'hj-frame-p', lang: 'ja' }, before ?? '', h('span', { class: 'hj-blank-p' }, '＿＿'), after ?? ''),
    me.level === 'kana' ? h('p', { class: 'hj-romaji' }, toRomaji(todo.frame.replace('＿', '___'))) : null,
    speakBox({ label: 'Hold and say it', speechOnly: true, autoSend: true, onSend: (utterance) => void ctx.send({ kind: 'recall', turn: todo.turn, utterance }) }),
    h('button', { type: 'button', class: 'secondary', onclick: showOptions }, 'Can’t say it? Pick it'),
    options,
    h('p', { class: 'hint' }, `${done.length} of ${me.recall.length} done`),
  );
}

export const hajimemashitePhone: PhoneMode<HajimeView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      JSON.stringify(game.me),
      view.phase === 'reveal' ? game.facts.map((f) => f.word ?? '').join(',') : '',
      game.card?.third ?? '',
    ].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'はじめまして！'),
          h('p', {}, '👋 Each turn, one of you is the guest and writes one true thing about themselves.'),
          h('p', {}, '🦝 Everyone else writes a lie about them, in silence. The last guest reads all the cards aloud.'),
          h('p', {}, '📱 Rank them from surely true to surely a lie. Lies above the truth score for their tanuki.'),
        );
      case 'prompt':
        if (!me) return waiting('Look at the TV!');
        return me.role === 'guest' ? guestScreen(ctx, me) : welcomeScreen(ctx, me);
      case 'answer':
        if (!me?.role) return waiting('Look at the TV!');
        return writeScreen(ctx, me);
      case 'reveal':
        if (!me) return waiting('👂 Listen!');
        return me.script ? introducerScreen(ctx, me) : listenScreen(ctx, me);
      case 'encore':
        if (!me) return waiting('Look at the TV!');
        if (me.role === 'guest') return wishScreen(ctx, me);
        return me.rankable.length ? rankScreen(ctx, me) : waiting('Look at the TV!');
      case 'score':
        return me ? truthScreen(ctx, me) : waiting('Look at the TV!');
      case 'finale':
        return me ? recallScreen(ctx, me) : waiting('Look at the TV!');
      default:
        return waiting('Look at the TV!');
    }
  },
};
