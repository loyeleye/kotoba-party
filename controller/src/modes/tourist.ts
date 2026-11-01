// Who's the Tourist? on the phone. Your secret card (the place and your role, or "you're the
// tourist"); on your turn, pick someone and ask out loud (hold to talk, or take a question tile and
// say it; N4 and up get cues instead: the English and the frame, with the Japanese behind a peek);
// when asked, answer out loud (or take an answer tile). Anyone can call a vote; the tourist can
// guess the place at any time.

import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { h } from '../../../shared/src/dom.js';
import { placePic } from '../../../shared/src/art.js';
import type { TouristView } from '../../../shared/src/modes/views.js';
import type { CueCard, LineCard, PlaceCard, SaidView } from '../../../shared/src/modes/tourist/tourist.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { holdButton, waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { Level } from '../../../content/src/types.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<TouristView>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';

/** Choices made on this phone only, kept across redraws within one phase. */
let tile: { seq: number; id: string } | null = null;
let guessPick: { seq: number; id: string } | null = null;

/** This phone's level, set on each render: every Japanese line follows it (components/jp.ts). */
let level: Level | null = null;

function line(p: { text: string; kana: string | null; en: string | null; romaji?: string }, cls = ''): HTMLElement {
  return jpView(p, level, { cls: `tou-line ${cls}` });
}

const saidLine = (x: SaidView, cls = '') => line({ text: x.text, kana: x.kana, en: x.en ? `${x.approx ? 'Something like: ' : ''}${x.en}` : '(own words)', ...(x.romaji ? { romaji: x.romaji } : {}) }, cls);

function placeName(p: PlaceCard): HTMLElement {
  return h('span', { class: 'tou-pn' }, placePic(p, 'tou-pn-emoji'), h('span', { lang: 'ja' }, p.text), p.kana !== p.text ? h('small', { lang: 'ja' }, ` ${p.kana}`) : null, h('small', {}, ` · ${p.romaji ? `${p.romaji} · ` : ''}${p.en}`));
}

function myCard(game: TouristView, open: boolean): HTMLElement | null {
  const me = game.me!;
  const body = me.card
    ? h(
        'div',
        { class: 'tou-card local' },
        h('p', { class: 'tou-card-label' }, '📍 We are at'),
        h('p', { class: 'tou-card-place' }, placeName(me.card.place)),
        h('p', { class: 'tou-card-label' }, 'You are'),
        h('p', { class: 'tou-card-role', lang: 'ja' }, me.card.role.text, h('small', {}, ` ${me.card.role.kana !== me.card.role.text ? `${me.card.role.kana} · ` : ''}${toRomaji(me.card.role.kana)} · ${me.card.role.en}`)),
      )
    : h(
        'div',
        { class: 'tou-card tourist' },
        h('p', { class: 'tou-card-place' }, '🧳 You’re the tourist!'),
        h('p', {}, 'You don’t know where you are. Listen to the answers, blend in, and guess the place before they catch you.'),
      );
  if (open) return body;
  return h('details', { class: 'tou-peek' }, h('summary', {}, '🃏 My card (keep it hidden)'), body);
}

function bluffs(game: TouristView): HTMLElement | null {
  const b = game.me?.bluffs;
  if (!b?.length) return null;
  return h(
    'details',
    { class: 'tou-peek' },
    h('summary', {}, '🧳 Tourist phrases (safe answers)'),
    h('div', { class: 'tou-bluffs' }, b.map((x) => line({ ...x, en: x.en }, 'small'))),
  );
}

function placeList(game: TouristView): HTMLElement {
  return h('details', { class: 'tou-peek' }, h('summary', {}, `🗺️ The ${game.places.length} possible places`), h('ul', { class: 'tou-plist' }, game.places.map((p) => h('li', {}, placeName(p)))));
}

/** Tiles to pick from, then say the picked one (or send it as a tap). `onPick` hears whether one is picked. */
function tiles(ctx: Ctx, list: LineCard[], label: string, send: (move: { utterance: { via: 'speech' | 'typed' | 'tap'; text: string }; lineId?: string }) => void, onPick?: (picked: boolean) => void): HTMLElement {
  const { view } = ctx;
  const holder = h('div', { class: 'tou-tiles-wrap' });
  const draw = () => {
    const sel = tile && tile.seq === view.phaseSeq ? list.find((x) => x.id === tile!.id) : undefined;
    onPick?.(!!sel);
    if (sel) {
      holder.replaceChildren(
        h('p', { class: 'tou-step' }, 'Now say it out loud:'),
        line(sel, 'picked'),
        speakBox({ label: 'Hold and say it', placeholder: 'Type it (kana)', onSend: (utterance) => send({ utterance, lineId: sel.id }) }),
        h(
          'div',
          { class: 'tou-row' },
          h('button', { type: 'button', class: 'secondary', onclick: () => send({ utterance: { via: 'tap', text: sel.text }, lineId: sel.id }) }, 'Send without speaking'),
          h('button', { type: 'button', class: 'linkish', onclick: () => ((tile = null), draw()) }, 'Other tiles'),
        ),
      );
      return;
    }
    holder.replaceChildren(
      h('p', { class: 'tou-step' }, label),
      h(
        'div',
        { class: 'tou-tiles' },
        list.map((x) =>
          h(
            'button',
            { type: 'button', class: 'tou-tile', onclick: () => ((tile = { seq: view.phaseSeq, id: x.id }), draw()) },
            h('span', { class: 'tou-tile-jp', lang: 'ja' }, x.text),
            h('span', { class: 'tou-tile-en' }, x.romaji ?? x.en),
            x.romaji ? h('span', { class: 'tou-tile-en' }, x.en) : null,
          ),
        ),
      ),
    );
  };
  draw();
  return holder;
}

const frameChip = (f: NonNullable<CueCard['frame']>) => h('span', { class: 'frame-chip' }, h('span', { class: 'frame-ja', lang: 'ja' }, f.ja), h('small', {}, f.en));

/** N4 and up: cues to pick from (what to ask, and its frame), then ask it from memory; the Japanese is a peek away. */
function cues(ctx: Ctx, list: CueCard[], send: (move: { utterance: { via: 'speech' | 'typed' | 'tap'; text: string }; lineId?: string }) => void, onPick?: (picked: boolean) => void): HTMLElement {
  const { view, game } = ctx;
  const t = game.turn!;
  const holder = h('div', { class: 'tou-tiles-wrap' });
  const draw = () => {
    const sel = tile && tile.seq === view.phaseSeq ? list.find((x) => x.id === tile!.id) : undefined;
    onPick?.(!!sel);
    if (sel) {
      // A refused peek (the turn moved on, say) closes the panel and says so, rather than "Opening…" for ever.
      const peekErr = h('p', { class: 'hint', hidden: true }, 'Couldn’t open the Japanese. Ask it from memory, or try again.');
      holder.replaceChildren(
        h('p', { class: 'tou-step' }, sel.jp ? 'Now say it out loud:' : 'Ask it in Japanese, from memory:'),
        h('div', { class: 'tou-cue picked' }, h('p', { class: 'tou-cue-en' }, sel.en), sel.frame ? frameChip(sel.frame) : null),
        sel.jp
          ? line(sel.jp, 'picked')
          : h(
              'details',
              {
                class: 'tou-peek',
                // Opening it tells the server: asked off this cue, the question counts as read.
                ontoggle: (e: Event) => {
                  const box = e.target as HTMLDetailsElement;
                  if (!box.open) return;
                  peekErr.hidden = true;
                  void ctx.send({ kind: 'peek', lineId: sel.id, round: game.round, turn: t.seq }).then((ok) => {
                    if (!ok) {
                      box.open = false;
                      peekErr.hidden = false;
                    }
                  });
                },
              },
              h('summary', {}, '👀 Peek at the Japanese (half points)'),
              h('p', { class: 'hint' }, 'Opening…'),
            ),
        peekErr,
        speakBox({ label: 'Hold and ask it', placeholder: 'Type your question', onSend: (utterance) => send({ utterance, lineId: sel.id }) }),
        h(
          'div',
          { class: 'tou-row' },
          h('button', { type: 'button', class: 'secondary', onclick: () => send({ utterance: { via: 'tap', text: sel.jp?.text ?? sel.en }, lineId: sel.id }) }, 'Send without speaking'),
          h('button', { type: 'button', class: 'linkish', onclick: () => ((tile = null), draw()) }, 'Other questions'),
        ),
      );
      return;
    }
    holder.replaceChildren(
      h('p', { class: 'tou-step' }, 'Need an idea? Pick a question to ask in Japanese:'),
      h(
        'div',
        { class: 'tou-tiles' },
        list.map((x) =>
          h(
            'button',
            { type: 'button', class: 'tou-tile tou-cue-tile', onclick: () => ((tile = { seq: view.phaseSeq, id: x.id }), draw()) },
            h('span', { class: 'tou-cue-en' }, x.en),
            x.frame ? frameChip(x.frame) : null,
          ),
        ),
      ),
    );
  };
  draw();
  return holder;
}

function askScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const t = game.turn!;
  const me = game.me!;
  const open = view.players.filter((p) => p.id !== ctx.me.id && p.id !== t.noAskBack && p.connected);
  const options = open.length ? open : view.players.filter((p) => p.id !== ctx.me.id && p.id !== t.noAskBack);
  const others = options.filter((p) => p.id !== t.targetId);
  if (!t.targetId) {
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, '🎤 Your turn to ask!'),
      h('p', { class: 'hint' }, t.noAskBack ? `Who do you ask? (Not ${nameOf(view, t.noAskBack)}: no asking straight back.)` : 'Who do you ask?'),
      h('div', { class: 'tou-who' }, options.map((p) => h('button', { type: 'button', class: 'option tou-who-btn', onclick: () => void send({ kind: 'pick', targetId: p.id, round: game.round, turn: t.seq }) }, p.name))),
      myCard(game, false),
    );
  }
  const target = nameOf(view, t.targetId);
  const ask = (m: { utterance: { via: 'speech' | 'typed' | 'tap'; text: string }; lineId?: string }) => {
    tile = null;
    void send({ kind: 'ask', ...m, round: game.round, turn: t.seq });
  };
  // One place to speak: once a tile or cue is picked, its own speak box takes over from this one.
  const top = h('div', {}, speakBox({ label: `Hold and ask ${target}`, placeholder: 'Type your question', onSend: (utterance) => ask({ utterance }) }));
  const onPick = (picked: boolean) => (top.hidden = picked);
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, `Ask ${target}!`),
    h('p', { class: 'hint' }, 'Ask out loud, in Japanese, and into your phone. Your own words score the most.'),
    top,
    me.questions?.length ? tiles(ctx, me.questions, 'Need an idea? Take a question:', ask, onPick) : null,
    me.cues?.length ? cues(ctx, me.cues, ask, onPick) : null,
    others.length
      ? h(
          'details',
          { class: 'tou-peek' },
          h('summary', {}, 'Ask someone else'),
          h('div', { class: 'tou-who' }, others.map((p) => h('button', { type: 'button', class: 'option tou-who-btn', onclick: () => void send({ kind: 'pick', targetId: p.id, round: game.round, turn: t.seq }) }, p.name))),
        )
      : null,
    myCard(game, false),
  );
}

function answerScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const t = game.turn!;
  const me = game.me!;
  const reply = (m: { utterance: { via: 'speech' | 'typed' | 'tap'; text: string }; lineId?: string }) => {
    tile = null;
    void send({ kind: 'reply', ...m, round: game.round, turn: t.seq });
  };
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, `${nameOf(view, t.askerId)} asks you:`),
    t.question ? saidLine(t.question, 'question') : null,
    h('p', { class: 'hint' }, me.tourist ? 'Answer out loud. Stay vague, but sound sure!' : 'Answer out loud. Show you’re a local, but don’t give the place away!'),
    speakBox({ label: 'Hold and answer', placeholder: 'Type your answer', onSend: (utterance) => reply({ utterance }) }),
    me.answers?.length ? tiles(ctx, me.answers, 'Or take an answer:', reply) : null,
    myCard(game, false),
  );
}

function guessPanel(ctx: Ctx, lastChance: boolean): HTMLElement {
  const { view, game, send } = ctx;
  const holder = h('div', { class: 'tou-guess' });
  const draw = () => {
    const sel = guessPick && guessPick.seq === view.phaseSeq ? game.places.find((p) => p.id === guessPick!.id) : undefined;
    const go = (utterance?: { via: 'speech' | 'typed' | 'tap'; text: string }) => {
      guessPick = null;
      void send({ kind: 'guess', placeId: sel!.id, ...(utterance ? { utterance } : {}), round: game.round });
    };
    if (sel) {
      holder.replaceChildren(
        h('p', { class: 'tou-step' }, 'Say it out loud:'),
        line({ text: `ここは ${sel.kana}ですか？`, kana: null, en: `Is this the ${sel.en}?`, ...(sel.romaji ? { romaji: `koko wa ${sel.romaji} desu ka?` } : {}) }, 'picked'),
        speakBox({ label: 'Hold and say it', placeholder: 'ここは …ですか', onSend: (u) => go(u) }),
        h(
          'div',
          { class: 'tou-row' },
          h('button', { type: 'button', class: 'secondary', onclick: () => go() }, `Guess ${sel.emoji} without speaking`),
          h('button', { type: 'button', class: 'linkish', onclick: () => ((guessPick = null), draw()) }, 'Back'),
        ),
        h('p', { class: 'hint' }, lastChance ? 'Right: you still score.' : 'One guess only. Right: you win the round. Wrong: the locals win.'),
      );
      return;
    }
    holder.replaceChildren(
      h('p', { class: 'tou-step' }, lastChance ? 'Last chance! Where are we?' : 'Where are we?'),
      h(
        'div',
        { class: 'tou-gplaces' },
        game.places.map((p) =>
          h(
            'button',
            { type: 'button', class: 'tou-gplace', onclick: () => ((guessPick = { seq: view.phaseSeq, id: p.id }), draw()) },
            placePic(p, 'tou-gplace-emoji'),
            h('span', { class: 'tou-gplace-jp', lang: 'ja' }, p.kana),
            h('span', { class: 'tou-gplace-en' }, p.romaji ?? p.en),
          ),
        ),
      ),
    );
  };
  draw();
  return holder;
}

function actions(ctx: Ctx): HTMLElement | null {
  const { view, game, send } = ctx;
  const me = game.me!;
  const parts: (HTMLElement | null)[] = [];
  if (me.canGuess) {
    parts.push(h('details', { class: 'tou-peek tou-guess-box' }, h('summary', {}, '🧳 I know where we are!'), guessPanel(ctx, false)));
  }
  // Calling a vote can't be taken back: it sits at the bottom, behind a one-second hold.
  if (me.canCall) parts.push(holdButton('🗳️ Call a vote (once per round)', 'secondary tou-call', () => void send({ kind: 'call', round: game.round })));
  return parts.length ? h('div', { class: 'tou-actions' }, parts) : null;
}

function watchScreen(ctx: Ctx): HTMLElement {
  const { view, game } = ctx;
  const t = game.turn;
  const me = game.me!;
  return h(
    'div',
    { class: 'screen' },
    t ? h('p', { class: 'big' }, `${nameOf(view, t.askerId)}${t.targetId ? ` → ${nameOf(view, t.targetId)}` : ''}`) : h('p', { class: 'big' }, 'Listen!'),
    t?.question ? saidLine(t.question, 'question') : h('p', { class: 'hint' }, t?.targetId ? 'Listen to the question…' : 'Who will they ask?'),
    t?.answer ? saidLine(t.answer, 'answer') : null,
    t?.askerId === ctx.me.id && t.question ? h('p', { class: 'hint' }, `Asked! Waiting for ${nameOf(view, t.targetId)}’s answer.`) : null,
    game.failedVote ? h('p', { class: 'tou-note' }, 'No majority in the vote. Keep asking!') : null,
    myCard(game, false),
    me.tourist ? bluffs(game) : null,
    placeList(game),
    actions(ctx),
  );
}

function voteScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const me = game.me!;
  const v = game.vote;
  if (!v || !v.voters.includes(ctx.me.id)) return waiting('Vote in progress…');
  if (me.myVote) return waiting(`You voted for ${nameOf(view, me.myVote)}.`, 'Waiting for the others…');
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🗳️ Who’s the tourist?'),
    h('p', { class: 'hint' }, me.tourist ? 'You’re the tourist: vote for someone else to blend in!' : v.kind === 'called' ? 'A majority is needed to catch someone.' : 'Final vote: most votes is out.'),
    h(
      'div',
      { class: 'tou-who' },
      view.players.filter((p) => p.id !== ctx.me.id).map((p) => h('button', { type: 'button', class: 'option tou-who-btn', onclick: () => void send({ kind: 'vote', suspectId: p.id, round: game.round }) }, p.name)),
    ),
    myCard(game, false),
  );
}

function scoreScreen(ctx: Ctx): HTMLElement {
  const { view, game } = ctx;
  const me = game.me!;
  const o = game.outcome;
  const pts = me.points ?? 0;
  const won = !!o && (me.tourist ? ['escaped', 'wrong-person', 'guessed'].includes(o.how) || !!o.lastChance?.right : ['caught', 'wrong-guess'].includes(o.how));
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, o?.how === 'left' ? 'Round over' : won ? (pts ? `🎉 +${pts} this round` : '🎉 You won the round') : pts ? `+${pts} this round` : 'Not this time!'),
    o ? h('p', {}, me.tourist ? 'You were the tourist 🧳' : o.how === 'left' ? 'The tourist left the game.' : `The tourist was ${nameOf(view, o.touristId)}.`) : null,
    o?.place ? h('p', { class: 'tou-card-place' }, 'We were at ', placeName(o.place)) : null,
    h('p', { class: 'hint' }, game.round < game.totalRounds ? 'Next round coming up…' : 'That’s the last round!'),
  );
}

export const touristPhone: PhoneMode<TouristView> = {
  key: (view, game) => [view.phaseSeq, JSON.stringify(game.me), JSON.stringify(game.turn), game.log.length, JSON.stringify(game.outcome), JSON.stringify(game.vote?.voters ?? null), game.failedVote ? 1 : 0].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    level = ctx.me.level;
    if (view.phase === 'intro') {
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big', lang: 'ja' }, 'かんこうきゃくは だれ？'),
        h('p', {}, 'Your phone will show where you are: a station, a hot spring, a konbini… One of you, the 🧳 tourist, won’t know.'),
        h('p', {}, '🎤 Take turns asking someone a question out loud in simple Japanese. They answer out loud. Your phone has question and answer tiles if you need them.'),
        h('p', {}, '🗳️ Anyone can call a vote. The tourist can guess the place at any time.'),
        h('p', { class: 'hint' }, 'Keep your phone to yourself!'),
      );
    }
    const me = game.me;
    if (!me) return waiting('Look at the TV!');
    switch (view.phase) {
      case 'prompt':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, '🤫 Your secret card'),
          myCard(game, true),
          me.tourist ? h('p', { class: 'hint' }, 'It’s one of these. Listen for clues:') : h('p', { class: 'hint' }, 'Answer like someone who’s really here, but never say the place’s name!'),
          me.tourist ? h('ul', { class: 'tou-plist' }, game.places.map((p) => h('li', {}, placeName(p)))) : null,
          me.tourist ? bluffs(game) : null,
          me.ready
            ? h('p', { class: 'hint tou-ok' }, '✓ Got it. Waiting for the others…')
            : h('button', { type: 'button', class: 'primary', onclick: () => void ctx.send({ kind: 'ready', round: game.round }) }, 'Got it'),
        );
      case 'answer': {
        const t = game.turn;
        if (t && t.askerId === ctx.me.id && !t.question) return askScreen(ctx);
        if (t && t.targetId === ctx.me.id && t.question && !t.answer) return answerScreen(ctx);
        return watchScreen(ctx);
      }
      case 'reveal':
        return voteScreen(ctx);
      case 'encore':
        if (me.canGuess) return h('div', { class: 'screen' }, h('p', { class: 'big' }, '🧳 They caught you!'), guessPanel(ctx, true));
        return waiting(`${nameOf(view, game.outcome?.touristId)} was the tourist!`, 'They get one last guess at the place…');
      case 'score':
        return scoreScreen(ctx);
      default:
        return waiting('Look at the TV!');
    }
  },
};
