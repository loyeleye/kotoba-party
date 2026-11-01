// Ghost Advice Hotline (おばけの おなやみ相談室) on the TV: Nobiko-san's late-night advice line.
//
//   (all)   the host row: Nobiko-san at the left the whole game, the caller's card (the yōkai, who is playing
//           it, what they're doing, "said it" with the pixel mic) at the right, on the line all call long.
//   ring    ☎ RING RING on the caller's card, and the problem line in kanji with furigana, English under it.
//   plan    the holding loop: an adviser card each with a plan ring that turns ✓, the gallery's bet chips.
//           Never what anyone picked.
//   record  ● REC with level bars on each adviser still recording, ✓ Sent on the rest. No words, no sound.
//   play    only who is talking and a playhead. Never a picture or words while spoken advice plays (that
//           would answer the caller's listening); a Kana tile shows as it plays; a mic pass shows
//           Nobiko-san reading it.
//   react   the caller's chip pops (ちがう ✗ sky blue, おしい ≈ gold, それだ ◎ vermilion, each in a fixed
//           place), then the words and the picture wipe in. Rows stack in play order.
//   secret  the secret card flips over, the rows that match it glow, "Ken was fair" when every それだ！ did.
//   vote    picture cards and "4 of 5 voted": lock-ins only, never choices.
//   points  laugh tokens drop, the top laugh's trophy (or the 大ウケ！ +100 stamp on a sweep), then points.
//   booth   the commentary booth: the line, its chunk lit, one line of colour, the station tag.
//
// The stage redraws on every update; clips run outside the render (dubAudio.ts), keyed per call and index.

import { icon } from '../../../shared/src/art.js';
import { h, LEVEL_LABELS, ruby, seatShape } from '../../../shared/src/dom.js';
import { NOBIKO_PLAY_MS, PLAN_MS, POINTS, REACT_LOCK_MS, RING_MS, TYPED_PLAY_MS, VOTE_MS, type AdviceRow, type HotlineView, type LedgerEntry, type Reaction, type TileView } from '../../../shared/src/modes/ghostHotline/hotline.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { sfx } from '../music/sfx.js';
import { clipLeft, clipsHere, playClip, serverNow } from './dubAudio.js';
import type { StageMode } from './types.js';

const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);
const nameOf = (view: RoomView, id: string | null | undefined): string => playerOf(view, id)?.name ?? '';
const seatVar = (view: RoomView, id: string | null | undefined): string | null => {
  const seat = playerOf(view, id)?.seat;
  return seat ? `--seat: var(--seat-${seat})` : null;
};

/** A seat chip and name: the shape and number, so seats never rely on colour alone. */
function seat(view: RoomView, id: string | null | undefined, cls = 'gh-chip'): HTMLElement {
  const s = playerOf(view, id)?.seat ?? 0;
  return h('span', { class: cls, style: seatVar(view, id) }, h('span', { class: 'gh-seat' }, `${seatShape(s)}${s}`), h('span', { class: 'gh-name' }, nameOf(view, id)));
}

// ---- pictures ----

const ART = (picture: string): string => `/stage/assets/hotline/${picture}.png`;
/** Pictures that failed to load: drawn as their emoji from then on, so a redraw doesn't fetch them again. */
const missing = new Set<string>();

function pic(t: { picture: string; emoji: string }, cls = ''): HTMLElement {
  const emoji = () => h('span', { class: 'gh-emoji', 'aria-hidden': 'true' }, t.emoji);
  if (!t.picture || missing.has(t.picture)) return h('span', { class: `gh-pic ${cls}`, 'data-key': `e:${t.picture}` }, emoji());
  return h(
    'span',
    { class: `gh-pic ${cls}`, 'data-key': `i:${t.picture}` },
    h('img', {
      src: ART(t.picture),
      alt: '',
      draggable: 'false',
      onerror: (e: Event) => {
        missing.add(t.picture);
        (e.target as HTMLElement).replaceWith(emoji());
      },
    }),
  );
}

function tile(t: TileView, cls = ''): HTMLElement {
  return h('div', { class: `gh-tile ${cls}`, 'data-key': t.id }, pic(t), h('span', { class: 'gh-tile-ja', lang: 'ja' }, t.word.text), h('span', { class: 'gh-tile-en' }, t.word.en));
}

// ---- reactions: shape, colour and place ----

const REACTIONS: Record<Reaction, { ja: string; en: string }> = {
  chigau: { ja: 'ちがう！', en: 'nope' },
  oshii: { ja: 'おしい！', en: 'so close' },
  soreda: { ja: 'それだ！', en: 'that’s it' },
};

/** ✗, ≈ or ◎, drawn in CSS (emoji marks render in odd colours on some TVs). */
const mark = (r: Reaction): HTMLElement =>
  h('span', { class: `gh-mark gh-mark-${r}`, 'aria-hidden': 'true' }, r === 'oshii' ? [h('span', { class: 'gh-wave1' }), h('span', { class: 'gh-wave2' })] : null);

function chip(r: Reaction, cls = ''): HTMLElement {
  return h('span', { class: `gh-react gh-react-${r} ${cls}`, 'data-key': r, title: REACTIONS[r].en }, mark(r), h('span', { lang: 'ja' }, REACTIONS[r].ja));
}

// ---- timing ----

function bar(ms: number, at: number, cls = 'gh-bar'): HTMLElement {
  const gone = Math.max(0, serverNow() - at);
  // Keyed by its timer, so a bar reused across beats (play → deciding) restarts instead of keeping the old start.
  return h('div', { class: cls, 'data-key': `bar:${at}:${ms}` }, h('div', { class: 'gh-bar-fill', style: `animation-duration: ${ms}ms; animation-delay: -${Math.min(gone, ms)}ms` }));
}

/** A countdown ring (SVG, so older TV browsers animate it): it empties over `ms` from `at`. */
function ring(ms: number, at: number, label: string): HTMLElement {
  const gone = Math.max(0, serverNow() - at);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'gh-ring-svg');
  svg.innerHTML = `<circle class="gh-ring-bg" cx="50" cy="50" r="42"/><circle class="gh-ring-arc" cx="50" cy="50" r="42" pathLength="100" style="animation-duration:${ms}ms;animation-delay:-${Math.min(gone, ms)}ms"/>`;
  return h('span', { class: 'gh-ring' }, svg, h('span', { class: 'gh-ring-label' }, label));
}

// One-shot sounds per moment: a redraw mustn't play them twice.
const once = new Set<string>();
const onceFor = (key: string, f: () => void) => {
  if (once.has(key)) return;
  once.add(key);
  f();
};

/**
 * Who is being reacted to. The view drops `play` when the clip ends, but the react beat still needs the
 * speaker until the caller taps: remembered from the play beat, per call and index.
 */
let lastPlay: { round: number; index: number; total: number; playerId: string } | null = null;

// ---- the frame ----

const callerName = (view: RoomView, game: HotlineView): string => (game.call?.caller ? nameOf(view, game.call.caller) : (game.call?.who.name.en ?? 'the yōkai'));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const step = (icon: string | HTMLElement, ...text: (string | HTMLElement)[]): HTMLElement => h('li', {}, h('span', { class: 'gh-step-icon', 'aria-hidden': 'true' }, icon), h('span', {}, ...text));

function intro(game: HotlineView): HTMLElement {
  return h(
    'div',
    { class: 'gh-stage gh-intro' },
    h('p', { class: 'gh-logo', lang: 'ja' }, 'おばけの おなやみ', ruby({ text: '相談室', kana: 'そうだんしつ' })),
    h('p', { class: 'gh-subtitle' }, 'Ghost Advice Hotline · Nobiko-san’s late-night advice line'),
    game.scripted ? h('p', { class: 'gh-coop' }, 'Two of you: a yōkai phones in, and you both give advice.') : null,
    h(
      'ol',
      { class: 'gh-steps' },
      step('☎', game.scripted ? 'A yōkai calls with a problem. Only it knows what would really help.' : 'A yōkai calls with a problem. Only the caller knows what would really help.'),
      step('🤫', game.scripted ? 'You both plan your advice in private, then record it at the same time.' : 'Advisers plan in private and record at the same time. Everyone else bets on the cure.'),
      step(
        h('span', { class: 'gh-step-marks' }, mark('chigau'), mark('oshii'), mark('soreda')),
        'The advice plays in a random order. The caller answers ',
        h('span', { lang: 'ja', class: 'nw' }, 'ちがう！'),
        ' ',
        h('span', { lang: 'ja', class: 'nw' }, 'おしい！'),
        ' or ',
        h('span', { lang: 'ja', class: 'nw' }, 'それだ！'),
      ),
      step('😂', game.scripted ? 'Then the secret comes out. Advice that really helps scores most.' : 'Then the secret comes out, and you vote for the idea that made you laugh.'),
    ),
  );
}

// ---- ring ----

/**
 * What the caller is doing, beat by beat: Japanese first (kana a beginner can read), English small under
 * it (art panel, 1 Nov 2026). From the vote on, the English says what the caller is staying for.
 */
const LINE_STATE: Record<string, { ja: string; en: string }> = {
  ring: { ja: 'もしもし…', en: 'calling in' },
  plan: { ja: 'まって います', en: 'on hold' },
  record: { ja: 'まって います', en: 'on hold' },
  play: { ja: 'きいて います', en: 'listening' },
  react: { ja: 'こたえて います', en: 'answering' },
  secret: { ja: 'ひみつを おしえます', en: 'the secret' },
  vote: { ja: 'まだ きいて います', en: 'still on' },
  points: { ja: 'まだ きいて います', en: 'still on' },
  booth: { ja: 'まだ きいて います', en: 'still on' },
};

/** How long a call rings (the card's buzz and the set's call light): three rings, one a second. */
const RING_FLASH_MS = 3_000;
/** The ring waits out the curtain wipe that opens the beat (560 ms), so its first flash is seen (art panel, 1 Nov 2026). */
const RING_WAIT_MS = 600;

/** The card's call lamp, matching the set's red call light: dark before a call, flashing as it rings, then lit. */
const lamp = (state: 'off' | 'ring' | 'on'): HTMLElement => h('span', { class: `gh-lamp gh-lamp-${state}`, 'aria-hidden': 'true' });

/**
 * The caller, on the line all call long: their card sits in the host row across from Nobiko-san, so the
 * room always sees who is phoning in (Ladi, 1 Nov 2026). It rings for 3 s (ジリリリン！, the lamp and a
 * buzz, in step with the set's call light), then holds still. Before the first call the lines are open.
 */
function onTheLine(view: RoomView, game: HotlineView): HTMLElement {
  const c = game.call;
  if (!c || !game.step)
    return h(
      'div',
      { class: 'gh-line gh-line-open', 'data-key': 'line:open' },
      h('span', { class: 'gh-line-picwrap' }, icon('hl-phone', '☎', 'gh-line-phone')),
      h(
        'div',
        { class: 'gh-line-text' },
        h('p', { class: 'gh-line-tag', lang: 'ja' }, lamp('off'), ruby({ text: 'お電話 まってます', kana: 'おでんわ まってます' })),
        h('p', { class: 'gh-line-en' }, 'Lines open'),
        h('p', { class: 'gh-line-en' }, 'Waiting for the first call'),
      ),
    );
  const gone = Math.max(0, serverNow() - game.stepAt);
  const ringing = game.step === 'ring' && gone < RING_WAIT_MS + RING_FLASH_MS;
  // One delay for the lamp, the buzz and ジリリリン！: positive while the wipe plays, negative when the TV joins mid-ring.
  const delay = RING_WAIT_MS - Math.min(gone, RING_WAIT_MS + RING_FLASH_MS);
  const state = LINE_STATE[game.step] ?? { ja: 'でんわちゅう', en: 'on the line' };
  return h(
    'div',
    { class: `gh-line${game.step === 'ring' ? ' gh-line-ring' : ''}`, style: `${seatVar(view, c.caller) ?? ''}; --ring-delay: ${delay}ms`, 'data-key': `line:${game.round}` },
    // Keyed by the call, so the ring runs once; started part-way in when the TV joins mid-ring.
    h('span', { class: 'gh-line-picwrap', 'data-key': `pic:${game.round}` }, pic(c.who, `gh-line-pic${ringing ? ' gh-ringing' : ''}`)),
    h(
      'div',
      { class: 'gh-line-text' },
      h(
        'p',
        { class: 'gh-line-tag', lang: 'ja' },
        lamp(ringing ? 'ring' : 'on'),
        game.step === 'ring' ? h('span', { class: 'gh-ring-pill' }, 'ジリリリン！') : ruby({ text: '電話中', kana: 'でんわちゅう' }),
        h('small', { lang: 'en' }, game.step === 'ring' ? ' ringing' : ' on the line'),
        c.said ? h('span', { class: 'gh-said gh-pop', lang: 'en' }, icon('hl-mic', '🎤', 'gh-said-mic'), 'said it') : null,
      ),
      h('p', { class: 'gh-yokai' }, h('span', { lang: 'ja' }, ruby(c.who.name)), h('small', {}, ` ${c.who.name.en}`)),
      h(
        'p',
        { class: 'gh-line-who' },
        c.caller ? seat(view, c.caller) : h('span', { class: 'gh-chip' }, h('span', { class: 'gh-seat' }, icon('hl-phone', '☎', 'gh-seat-phone')), h('span', { class: 'gh-name' }, 'the house')),
        h('span', { class: 'gh-state' }, h('span', { lang: 'ja' }, state.ja), h('small', {}, state.en)),
      ),
    ),
  );
}

function problem(game: HotlineView, slim = false, face = false): HTMLElement | null {
  const c = game.call;
  if (!c) return null;
  return h(
    'div',
    { class: `gh-problem${slim ? ' gh-problem-slim' : ''}${face ? ' gh-problem-face' : ''}` },
    face ? pic(c.who, 'gh-problem-pic') : null,
    h('p', { class: 'gh-problem-tag' }, 'THE PROBLEM'),
    h('p', { class: 'gh-problem-ja' }, ruby(c.line)),
    h('p', { class: 'gh-problem-en' }, `“${c.line.en}”`),
  );
}

function ringBeat(view: RoomView, game: HotlineView): HTMLElement {
  onceFor(`ring:${game.round}`, () => sfx('ring'));
  // The caller rings in the host row (onTheLine); the beat itself is the problem, big, with the caller's face.
  return h('div', { class: 'gh-center gh-ringbeat' }, problem(game, false, true), bar(RING_MS, game.stepAt));
}

// ---- plan and record ----

function adviserCard(view: RoomView, game: HotlineView, id: string): HTMLElement {
  const level = playerOf(view, id)?.level ?? 'n5';
  const ready = game.locked.ready.includes(id);
  const sent = game.locked.sent.includes(id);
  const recording = game.step === 'record';
  let mark: HTMLElement;
  let state: string;
  if (recording) {
    mark = sent ? h('span', { class: 'gh-done' }, '✓') : h('span', { class: 'gh-levels', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, (_, i) => h('span', { style: `--i: ${i}` })));
    state = sent ? '✓ Sent · advice is in' : '● REC';
  } else {
    mark = ready ? h('span', { class: 'gh-done' }, '✓') : ring(PLAN_MS, game.stepAt, 'PLAN');
    state = ready ? (level === 'kana' ? '✓ Tile picked' : '✓ Ready') : 'Planning…';
  }
  return h(
    'div',
    { class: `gh-adviser${(recording ? sent : ready) ? ' gh-in' : ''}${recording && !sent ? ' gh-rec-on' : ''}`, style: seatVar(view, id), 'data-key': id },
    h('span', { class: 'gh-adviser-mark' }, mark),
    h('div', { class: 'gh-adviser-text' }, seat(view, id), h('p', { class: 'gh-adviser-level' }, `${LEVEL_LABELS[level] ?? level} · adviser`), h('p', { class: 'gh-adviser-state' }, state)),
  );
}

function galleryBets(view: RoomView, game: HotlineView): HTMLElement | null {
  const g = game.cast?.gallery ?? [];
  if (!g.length) return null;
  return h(
    'div',
    { class: 'gh-bets' },
    h('span', { class: 'gh-label' }, 'Gallery bets on the cure'),
    ...g.map((id) => h('span', { class: `gh-bet${game.locked.bets.includes(id) ? ' gh-in' : ''}`, 'data-key': id }, seat(view, id), game.locked.bets.includes(id) ? h('span', { class: 'gh-lock' }, '✓') : h('span', { class: 'gh-wait' }, '…'))),
  );
}

function planBeat(view: RoomView, game: HotlineView): HTMLElement {
  const advisers = game.cast?.advisers ?? [];
  return h(
    'div',
    { class: 'gh-center gh-planbeat' },
    problem(game, true),
    h('div', { class: 'gh-advisers' }, ...advisers.map((id) => adviserCard(view, game, id))),
    h('p', { class: 'gh-caption' }, 'Advisers plan in private. Nobody sees anyone’s advice until all of it is in.', game.cast?.gallery.length ? h('span', { class: 'gh-muted' }, ' The gallery bets on the cure.') : null),
    galleryBets(view, game),
  );
}

function recordBeat(view: RoomView, game: HotlineView): HTMLElement {
  const advisers = game.cast?.advisers ?? [];
  const left = advisers.filter((id) => !game.locked.sent.includes(id)).length;
  return h(
    'div',
    { class: 'gh-center gh-recordbeat' },
    problem(game, true),
    left ? h('p', { class: 'gh-rec' }, h('span', { class: 'gh-rec-dot' }), 'REC') : h('p', { class: 'gh-big' }, '✓ All the advice is in'),
    h('div', { class: 'gh-advisers' }, ...advisers.map((id) => adviserCard(view, game, id))),
    h('p', { class: 'gh-caption' }, 'Everyone records at once. Then the advice plays in a random order. No sound and no words yet.'),
    bar(Math.max(1, view.deadline ? view.deadline - game.stepAt : 9_000), game.stepAt),
  );
}

// ---- the reveal: rows, play, react ----

function adviceWords(row: AdviceRow): HTMLElement {
  const text = row.subtitle ?? row.tile?.word.text ?? null;
  return h(
    'span',
    { class: 'gh-row-words' },
    text ? h('span', { class: 'gh-row-ja', lang: 'ja' }, text) : h('span', { class: 'gh-muted' }, 'No words caught'),
    row.tile ? h('span', { class: 'gh-row-en' }, row.tile.word.en) : null,
  );
}

function rowEl(view: RoomView, game: HotlineView, row: AdviceRow, i: number, opts: { big?: boolean; glow?: boolean } = {}): HTMLElement {
  const total = game.play?.total ?? Math.max(game.rows.length, lastPlay?.round === game.round ? lastPlay.total : 0);
  return h(
    'div',
    { class: `gh-row${opts.big ? ' gh-row-big' : ''}${opts.glow ? ' gh-glow' : ''}${row.reaction === 'soreda' ? ' gh-row-soreda' : ''}`, style: seatVar(view, row.playerId), 'data-key': row.playerId },
    h('span', { class: 'gh-row-who' }, seat(view, row.playerId), h('span', { class: 'gh-row-n' }, `${i + 1}/${total}`)),
    row.tile ? h('span', { class: 'gh-row-pic gh-wipe' }, pic(row.tile)) : null,
    h('span', { class: 'gh-row-main gh-wipe' }, adviceWords(row), row.pass ? h('span', { class: 'gh-row-note' }, '🎙 Nobiko-san read it') : null),
    h('span', { class: 'gh-row-react' }, row.reaction ? chip(row.reaction, 'gh-chip-pop') : null, row.auto && row.reaction ? h('span', { class: 'gh-row-note' }, 'marked by the game') : null),
  );
}

function rows(view: RoomView, game: HotlineView, bigLast: boolean): HTMLElement {
  const glow = game.secret ? game.secret.cure.id : null;
  return h('div', { class: 'gh-rows' }, ...game.rows.map((r, i) => rowEl(view, game, r, i, { big: bigLast && i === game.rows.length - 1, glow: !!glow && r.tile?.id === glow })));
}

function playBeat(view: RoomView, game: HotlineView): HTMLElement | null {
  const p = game.play;
  if (!p) return null;
  lastPlay = { round: game.round, index: p.index, total: p.total, playerId: p.playerId };
  const name = nameOf(view, p.playerId);
  const level = playerOf(view, p.playerId)?.level ?? 'n5';
  const caller = callerName(view, game);
  if (p.kind === 'clip' && p.clipId && !p.local && p.at) playClip(p.clipId, `hotline:${game.round}:${p.index}`, serverNow() - p.at);
  const hidden = p.kind === 'nobiko' && !p.pass;
  let body: (HTMLElement | null)[];
  if (hidden) body = [h('p', { class: 'gh-big' }, '🙈 Nobiko-san covers the phone.')];
  else if (p.kind === 'tile' && p.tile) body = [h('div', { class: 'gh-pop' }, tile(p.tile, 'gh-tile-play'))];
  else if (p.kind === 'typed' && p.text) {
    // Typed advice has no sound, so its words show as it plays (player text: plain text only).
    const words = h('p', { class: 'gh-big gh-typed-line', lang: 'ja' });
    words.textContent = p.text;
    body = [words, bar(TYPED_PLAY_MS, p.at || serverNow(), 'gh-bar gh-playhead'), h('p', { class: 'gh-small' }, `⌨ Typed advice · ${caller}, read it and react`)];
  }
  else
    body = [
      h('div', { class: 'gh-wave', 'aria-hidden': 'true' }, ...Array.from({ length: 28 }, (_, i) => h('span', { style: `--i: ${i}` }))),
      bar(p.kind === 'clip' ? p.durMs : p.kind === 'nobiko' ? NOBIKO_PLAY_MS : TYPED_PLAY_MS, p.at || serverNow(), 'gh-bar gh-playhead'),
      h(
        'p',
        { class: 'gh-small' },
        p.kind === 'clip' && p.local ? `🔊 Playing on ${name}’s phone · ` : p.kind === 'clip' && !clipsHere() ? '🔇 It plays on the main TV · ' : p.kind === 'typed' ? '⌨ Typed advice · ' : '',
        `Words appear after ${caller} reacts`,
      ),
    ];
  return h(
    'div',
    { class: 'gh-center gh-playbeat' },
    problem(game, true),
    rows(view, game, false),
    h(
      'div',
      { class: 'gh-now', style: seatVar(view, p.playerId), 'data-key': `now:${p.index}` },
      h(
        'p',
        { class: 'gh-now-who' },
        p.kind === 'nobiko' && p.pass ? '🎙 Nobiko-san reads ' : '🔊 ',
        seat(view, p.playerId),
        h('span', { class: 'gh-row-n' }, ` ${p.index + 1}/${p.total} · ${LEVEL_LABELS[level] ?? level}`),
        p.kind === 'nobiko' && p.pass ? h('span', { class: 'gh-muted' }, ' · mic pass') : null,
      ),
      ...body,
    ),
  );
}

function reactBeat(view: RoomView, game: HotlineView): HTMLElement {
  const lp = lastPlay?.round === game.round ? lastPlay : null;
  // The reaction is in: the newest row is the big one. Not yet: the caller is still deciding.
  const reacted = !lp || game.rows.some((r) => r.playerId === lp.playerId);
  if (reacted) {
    const last = game.rows[game.rows.length - 1];
    if (last?.reaction) onceFor(`react:${game.round}:${game.rows.length}`, () => sfx(last.reaction === 'chigau' ? 'wrong' : 'right'));
    return h('div', { class: 'gh-center gh-reactbeat' }, problem(game, true), rows(view, game, true));
  }
  return h(
    'div',
    { class: 'gh-center gh-reactbeat' },
    problem(game, true),
    rows(view, game, false),
    h(
      'div',
      { class: 'gh-now gh-deciding', style: seatVar(view, lp.playerId), 'data-key': `now:${lp.index}` },
      h('p', { class: 'gh-now-who' }, seat(view, lp.playerId), h('span', { class: 'gh-row-n' }, ` ${lp.index + 1}/${lp.total}`)),
      h('p', { class: 'gh-big' }, `${cap(callerName(view, game))} is deciding…`),
      h('div', { class: 'gh-react-slots', 'aria-hidden': 'true' }, chip('chigau', 'gh-dim'), chip('oshii', 'gh-dim'), chip('soreda', 'gh-dim')),
      bar(REACT_LOCK_MS, game.stepAt),
    ),
  );
}

// ---- secret ----

function secretBeat(view: RoomView, game: HotlineView): HTMLElement | null {
  const s = game.secret;
  if (!s) return null;
  onceFor(`secret:${game.round}`, () => sfx('flip'));
  const caller = cap(callerName(view, game));
  return h(
    'div',
    { class: 'gh-center gh-secretbeat' },
    h(
      'div',
      { class: 'gh-secret' },
      h('p', { class: 'gh-secret-tag' }, 'THE SECRET · WHAT WOULD ACTUALLY HELP'),
      pic(s.cure, 'gh-pic-big'),
      h('p', { class: 'gh-secret-ja' }, ruby(s.text)),
      h('p', { class: 'gh-secret-en' }, s.text.en),
    ),
    h(
      'div',
      { class: 'gh-secret-side' },
      game.rows.length ? rows(view, game, false) : h('p', { class: 'gh-small' }, 'No advice came in this time.'),
      s.fair === true ? h('p', { class: 'gh-fair gh-pop' }, `✓ ${caller} was fair: every `, h('span', { lang: 'ja', class: 'nw' }, 'それだ！'), ' matches the secret.') : null,
      s.fair === false ? h('p', { class: 'gh-fair gh-unfair gh-pop' }, `Hmm… not every `, h('span', { lang: 'ja', class: 'nw' }, 'それだ！'), ' matches the secret.') : null,
    ),
  );
}

// ---- laugh vote ----

function voteBeat(view: RoomView, game: HotlineView): HTMLElement {
  if (game.scripted || !game.rows.length)
    return h('div', { class: 'gh-center' }, game.secret ? secretBeat(view, game) : null, h('p', { class: 'gh-small' }, game.scripted ? 'Two of you: no laugh vote this time.' : 'No advice to vote on.'));
  const voters = view.players.filter((p) => p.connected).length;
  const voted = game.locked.votes.length;
  return h(
    'div',
    { class: 'gh-center gh-votebeat' },
    h('p', { class: 'gh-big' }, 'Which idea made you laugh?'),
    h('p', { class: 'gh-voted' }, h('span', { class: 'gh-lock' }, '✓'), ` ${voted} of ${voters} voted`),
    h('p', { class: 'gh-small' }, 'Choices stay hidden until everyone is in. Never your own.'),
    h(
      'div',
      { class: 'gh-cards' },
      ...game.rows.map((r) =>
        h(
          'div',
          { class: 'gh-card', style: seatVar(view, r.playerId), 'data-key': r.playerId },
          r.tile ? pic(r.tile, 'gh-pic-card') : h('span', { class: 'gh-pic gh-pic-card' }, h('span', { class: 'gh-emoji', 'aria-hidden': 'true' }, '💬')),
          h('span', { class: 'gh-card-ja', lang: 'ja' }, r.subtitle ?? r.tile?.word.text ?? '…'),
          h('span', { class: 'gh-card-en' }, r.tile ? `${r.tile.word.en} · ` : '', h('span', { class: 'gh-name' }, nameOf(view, r.playerId))),
          h('span', { class: 'gh-card-seat' }, seatShape(playerOf(view, r.playerId)?.seat ?? 0), String(playerOf(view, r.playerId)?.seat ?? '')),
        ),
      ),
    ),
    bar(VOTE_MS, game.stepAt),
  );
}

// ---- points ----

const TOKEN_MS = 350;
const TOP_MS = 1_600;
const POINTS_MS = 2_400;

function why(entries: LedgerEntry[]): string {
  const by = new Map<LedgerEntry['why'], number>();
  for (const e of entries) by.set(e.why, (by.get(e.why) ?? 0) + e.points);
  const laughs = Math.round((by.get('laugh') ?? 0) / POINTS.laugh);
  const parts: string[] = [];
  for (const [w, pts] of by) {
    if (w === 'soreda') parts.push(`それだ！ +${pts}`);
    else if (w === 'oshii') parts.push(`おしい！ +${pts}`);
    else if (w === 'laugh') parts.push(`${laughs} laugh${laughs === 1 ? '' : 's'} +${pts}`);
    else if (w === 'sweep') parts.push(`おおウケ！ +${pts}`);
    else if (w === 'bet') parts.push(`bet right +${pts}`);
    else if (w === 'line') parts.push(`said it +${pts}`);
  }
  return parts.join(' · ');
}

function pointsBeat(view: RoomView, game: HotlineView): HTMLElement | null {
  const t = game.tally;
  if (!t) return null;
  const mine = (id: string) => game.ledger.filter((e) => e.round === game.round && e.playerId === id);
  const total = (id: string) => t.points.find((p) => p.playerId === id)?.points ?? 0;
  onceFor(`points:${game.round}`, () => {
    if (t.sweep || t.top) sfx('right', TOP_MS / 1000);
  });
  const advisers = game.rows.map((r) => r.playerId);
  const others = t.points.filter((p) => !advisers.includes(p.playerId) && p.points > 0);
  // Tokens drop one by one across the cards, in play order.
  let token = 0;
  const cards = game.rows.map((r) => {
    const n = t.votes[r.playerId] ?? 0;
    const pts = total(r.playerId);
    const top = t.sweep ? t.sweep === r.playerId : t.top === r.playerId;
    return h(
      'div',
      { class: `gh-score${top ? ' gh-top' : ''}`, style: seatVar(view, r.playerId), 'data-key': r.playerId },
      r.tile ? pic(r.tile, 'gh-pic-card') : h('span', { class: 'gh-pic gh-pic-card' }, h('span', { class: 'gh-emoji', 'aria-hidden': 'true' }, '💬')),
      seat(view, r.playerId),
      h('span', { class: 'gh-tokens', 'aria-label': `${n} laugh${n === 1 ? '' : 's'}` }, ...Array.from({ length: n }, () => h('span', { class: 'gh-token gh-drop', style: `animation-delay: ${token++ * TOKEN_MS}ms` })), n === 0 ? h('span', { class: 'gh-muted gh-notoken' }, 'no laughs') : null),
      top && t.sweep ? h('span', { class: 'gh-sweep gh-stamp', lang: 'ja', style: `animation-delay: ${TOP_MS}ms` }, ruby({ text: '大ウケ！', kana: 'おおウケ！' }), h('small', {}, ' +100')) : null,
      top && !t.sweep ? h('span', { class: 'gh-trophy gh-pop', 'aria-label': 'top laugh', style: `animation-delay: ${TOP_MS}ms` }, '🏆') : null,
      h('span', { class: 'gh-pts gh-pop', style: `animation-delay: ${POINTS_MS}ms` }, pts ? `+${pts}` : '0'),
      h('span', { class: 'gh-why gh-pop', style: `animation-delay: ${POINTS_MS}ms` }, why(mine(r.playerId))),
    );
  });
  return h(
    'div',
    { class: 'gh-center gh-pointsbeat' },
    h(
      'div',
      { class: 'gh-scores' },
      ...cards,
      others.length
        ? h(
            'div',
            { class: 'gh-score gh-others' },
            ...others.map((p) => h('p', { class: 'gh-other gh-pop', style: `${seatVar(view, p.playerId) ?? ''}; animation-delay: ${POINTS_MS}ms`, 'data-key': p.playerId }, seat(view, p.playerId), h('span', { class: 'gh-why' }, why(mine(p.playerId))))),
          )
        : null,
    ),
  );
}

// ---- booth ----

function boothBeat(view: RoomView, game: HotlineView): HTMLElement | null {
  const b = game.booth;
  if (!b) return null;
  const line = b.line;
  const at = line.indexOf(b.chunk);
  const shown = at >= 0 ? [line.slice(0, at), h('mark', { class: 'gh-chunk' }, b.chunk), line.slice(at + b.chunk.length)] : [line];
  return h(
    'div',
    { class: 'gh-center gh-booth' },
    h(
      'div',
      { class: 'gh-booth-card' },
      h('p', { class: 'gh-booth-tag' }, '🎙 REPLAY · ', nameOf(view, b.playerId).toUpperCase()),
      h('p', { class: 'gh-booth-line', lang: 'ja' }, ...shown),
      at < 0 ? h('p', { class: 'gh-booth-line', lang: 'ja' }, h('mark', { class: 'gh-chunk' }, b.chunk)) : null,
    ),
    h('p', { class: 'gh-booth-note gh-pop', style: 'animation-delay: 2500ms' }, h('mark', { class: 'gh-chunk gh-chunk-small', lang: 'ja' }, b.chunk), ' ', b.note),
    h('p', { class: 'gh-booth-map gh-pop', style: 'animation-delay: 4000ms' }, '🚃 ', b.tag),
  );
}

function center(view: RoomView, game: HotlineView): HTMLElement | null {
  switch (game.step) {
    case 'ring':
      return ringBeat(view, game);
    case 'plan':
      return planBeat(view, game);
    case 'record':
      return recordBeat(view, game);
    case 'play':
      return playBeat(view, game);
    case 'react':
      return reactBeat(view, game);
    case 'secret':
      return secretBeat(view, game);
    case 'vote':
      return voteBeat(view, game);
    case 'points':
      return pointsBeat(view, game);
    case 'booth':
      return boothBeat(view, game);
    default:
      return null;
  }
}

export const ghostHotlineStage: StageMode<HotlineView> = {
  render(view, game) {
    if (view.phase === 'intro') return intro(game);
    if (!game.step) return h('div', { class: 'gh-stage' });
    // No band or call counter of its own: the top bar has the title and the round, the host row the caller,
    // and the player tiles each role (art panel, 1 Nov 2026), so the beat gets the room.
    return h('div', { class: `gh-stage gh-step-${game.step}` }, center(view, game));
  },
  badge(game, playerId) {
    const c = game.cast;
    if (!c || !game.step) return '';
    const caller = c.caller === playerId;
    const adviser = c.advisers.includes(playerId);
    const gallery = c.gallery.includes(playerId);
    switch (game.step) {
      case 'ring':
        return caller ? '📞 caller' : adviser ? 'adviser' : gallery ? 'gallery' : '';
      case 'plan':
        if (adviser) return game.locked.ready.includes(playerId) ? '✓ ready' : 'planning…';
        if (gallery) return game.locked.bets.includes(playerId) ? '✓ bet' : 'betting…';
        return caller ? '📞 caller' : '';
      case 'record':
        if (adviser) return game.locked.sent.includes(playerId) ? '✓ sent' : '● REC';
        if (gallery) return game.locked.bets.includes(playerId) ? '✓ bet' : 'gallery';
        return caller ? '📞 caller' : '';
      case 'play':
        if (game.play?.playerId === playerId) return '▶ playing';
        return caller ? '📞 caller' : adviser ? 'adviser' : gallery ? 'gallery' : '';
      case 'react': {
        // The caller's card in the host row says what they're doing; the tile just names the role.
        return caller ? '📞 caller' : adviser ? 'adviser' : gallery ? 'gallery' : '';
      }
      case 'vote':
        if (game.scripted) return '';
        return game.locked.votes.includes(playerId) ? '✓ voted' : 'voting…';
      case 'points': {
        const pts = game.tally?.points.find((p) => p.playerId === playerId)?.points ?? 0;
        return pts ? `+${pts}` : '';
      }
      default:
        return caller ? '📞 caller' : adviser ? 'adviser' : gallery ? 'gallery' : '';
    }
  },
  hostRow(view, game) {
    // Nobiko-san and the caller stay on screen all game, whether or not she is talking.
    if (view.phase === 'lobby' || view.phase === 'recap') return null;
    return { host: 'nobiko', side: onTheLine(view, game) };
  },
  hostHoldMs(view) {
    if (view.phase !== 'reveal') return 0;
    const left = clipLeft();
    return left > 0 ? Math.round(left * 1000) + 300 : 0;
  },
};
