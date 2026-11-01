// Dub Club on the TV: a cheap late-night anime with no sound, and the room as its voice cast.
//
//   intro      the club's title card and tonight's episode.
//   scene      the silent scene (pixel set, character), Fude-kantoku's table read of the line.
//   record     the scene waits, mouth shut; the cast ticks off who has read and who has sent a take.
//   screening  one dub at a time: the clapper and the actor's name card, the clip with the character
//              lip-syncing to it, the guessing (how many have guessed, もう いっかい asks), then the
//              card flips with who read it. Earlier dubs stack up at the side.
//   notes      the scene's results, and the dub going into tonight's episode.
//   episode    full screen: the title card, the three chosen dubs back to back, つづく, the credits.
//
// The stage redraws on every update, so the clip and its lip sync run outside the render
// (dubAudio.ts), keyed so a redraw joins them where they are.

import { h, ruby, seatShape } from '../../../shared/src/dom.js';
import { EPISODE, type DubCard, type DubView } from '../../../shared/src/modes/dubClub/dubClub.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { JpText } from '../../../content/src/types.js';
import { audioReady, unlockAudio } from '../sound.js';
import { sting } from '../music/index.js';
import { sfx } from '../music/sfx.js';
import { clipLeft, clipsHere, playClip, resetPlayed, serverNow, startLipSync, stopClip } from './dubAudio.js';
import type { StageMode } from './types.js';

const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);
const nameOf = (view: RoomView, id: string | null | undefined): string => playerOf(view, id)?.name ?? '(left)';

function badge(view: RoomView, id: string): HTMLElement {
  const seat = playerOf(view, id)?.seat ?? 0;
  return h('span', { class: 'dub-who', style: seat ? `--seat: var(--seat-${seat})` : null }, seat ? h('span', { class: 'dub-seat' }, `${seatShape(seat)}${seat}`) : null, nameOf(view, id));
}

// ---- art ----

const BG = (bg: string): string => `/stage/assets/dub/bg-${bg}.png`;
/** The character's still, and its mouth sheet (closed, half, open) when it has one. */
function charArt(char: string): { still: string; talk: string | null } {
  if (char === 'pon') return { still: '/stage/assets/hosts/pon.png', talk: '/stage/assets/anim/pon-talk.png' };
  return { still: `/stage/assets/dub/char-${char}.png`, talk: `/stage/assets/dub/char-${char}-talk.png` };
}

interface ScreenOpts {
  bg: string;
  char: string;
  /** The mouth follows the clip playing now. */
  live?: boolean;
  /** The subtitle in the bottom bar: Japanese, or English only (a string) over an ad-lib. */
  caption?: JpText | string | null;
  /** Top-left card: who is voicing it. */
  nameCard?: HTMLElement | null;
  overlay?: HTMLElement | null;
  cls?: string;
}

/** The anime picture: the set, the character, cinema bars, and the subtitle in the bottom bar. */
function screen(o: ScreenOpts): HTMLElement {
  const art = charArt(o.char);
  const char = art.talk
    ? h('div', { class: `dub-char sheet${o.live ? ' dub-mouth' : ''}`, 'data-m': '0', style: `background-image: url(${art.talk})`, role: 'img', 'aria-label': '' })
    : h('img', { class: `dub-char still${o.live ? ' dub-mouth' : ''}`, src: art.still, alt: '', 'data-m': '0' });
  if (o.live) startLipSync();
  return h(
    'div',
    { class: `dub-screen ${o.cls ?? ''}` },
    h('img', { class: 'dub-bg', src: BG(o.bg), alt: '' }),
    char,
    h('div', { class: 'dub-bar top' }, o.nameCard ?? null),
    h('div', { class: 'dub-bar bottom' }, typeof o.caption === 'string' ? h('p', { class: 'dub-sub en' }, o.caption) : o.caption ? h('p', { class: 'dub-sub' }, ruby(o.caption)) : null),
    o.overlay ?? null,
    !clipsHere() ? h('p', { class: 'dub-nosound' }, '🔇 The dubs play on the main TV') : null,
  );
}

/** The card's pixel icon (stage/assets/dub/cards, 32×32, drawn at whole multiples). */
const cardIcon = (c: DubCard, cls = 'dub-icon'): HTMLElement => h('img', { class: cls, src: `/stage/assets/dub/cards/${c.id}.png`, alt: '', draggable: 'false' });

function cardFace(c: DubCard, cls = ''): HTMLElement {
  return h('div', { class: `dub-card ${cls}` }, cardIcon(c, 'dub-card-emoji'), h('span', { class: 'dub-card-text' }, h('span', { class: 'dub-card-jp', lang: 'ja' }, c.jp.text), h('span', { class: 'dub-card-en' }, c.jp.en)));
}

/** The TV must make sound for this mode: one click unlocks it. */
function soundGate(): HTMLElement | null {
  if (audioReady() || !clipsHere()) return null;
  return h('button', { type: 'button', class: 'dub-gate', onclick: () => unlockAudio() }, '🔊 Click here to turn on the TV’s sound: the dubs need it!');
}

// One-shots per moment: a redraw mustn't clap twice.
const once = new Set<string>();
function onceFor(key: string, f: () => void): void {
  if (once.has(key)) return;
  once.add(key);
  f();
}

// ---- phases ----

function intro(view: RoomView, game: DubView): HTMLElement {
  return h(
    'div',
    { class: 'dub-stage dub-intro' },
    h('p', { class: 'dub-logo', lang: 'ja' }, 'アフレコ', h('ruby', {}, '部', h('rt', {}, 'ぶ'))),
    h('p', { class: 'dub-subtitle' }, 'Dub Club · tonight’s episode: ', h('span', { lang: 'ja' }, game.episode.title.text), ` (${game.episode.title.en})`),
    h(
      'ol',
      { class: 'dub-steps' },
      h('li', {}, '🤫 Each scene, your phone gives you a secret card: how to say your line.'),
      h('li', {}, '🗣 Read the line plainly first. Only you see how the words went.'),
      h('li', {}, '🎬 Then record it in character. The TV plays every dub: guess how each was directed!'),
      h('li', {}, '❤ Your heart picks the dub that goes into tonight’s episode.'),
    ),
    soundGate(),
  );
}

function sceneSide(view: RoomView, game: DubView, phase: 'prompt' | 'answer'): HTMLElement {
  const sc = game.scene!;
  return h(
    'div',
    { class: 'dub-side' },
    h('p', { class: 'dub-tag' }, `Scene ${game.round} of ${game.totalRounds}`, game.round === game.totalRounds ? ' · ×2 points' : ''),
    h('p', { class: 'dub-setup' }, sc.setup),
    h('p', { class: 'dub-line', lang: 'ja' }, ruby(sc.line)),
    h('p', { class: 'dub-line-en' }, sc.line.en),
    phase === 'prompt'
      ? h('p', { class: 'dub-call' }, '🤫 Pick your secret direction on your phone')
      : h(
          'ul',
          { class: 'dub-cast' },
          game.cast.map((c) =>
            h(
              'li',
              { class: c.sent ? 'sent' : c.passed ? 'passed' : '' },
              badge(view, c.playerId),
              c.adlib ? h('span', { class: 'dub-adlib', lang: 'ja' }, 'アドリブ') : null,
              h('span', { class: 'dub-cast-state' }, c.sent ? '🎬 take in' : c.passed ? '🎧 guessing' : c.rehearsed ? '🗣 rehearsed' : '…'),
            ),
          ),
        ),
    phase === 'answer' ? h('p', { class: 'dub-quiet' }, '🔇 Recording! Quiet on set, please.') : null,
  );
}

function sceneScreen(view: RoomView, game: DubView, phase: 'prompt' | 'answer'): HTMLElement {
  const sc = game.scene;
  if (!sc) return h('div', { class: 'dub-stage' });
  return h(
    'div',
    { class: 'dub-stage dub-split' },
    screen({ bg: sc.bg, char: sc.char, nameCard: h('p', { class: 'dub-namecard' }, h('span', { lang: 'ja' }, sc.who.text), h('small', {}, ` ${sc.who.en}`)), caption: phase === 'prompt' ? sc.line : null }),
    sceneSide(view, game, phase),
    soundGate(),
  );
}

function screening(view: RoomView, game: DubView): HTMLElement {
  const sc = game.scene!;
  const now = game.now;
  let overlay: HTMLElement | null = null;
  // The guess and the card go in the side column, so the face stays clear.
  let panel: HTMLElement | null = null;
  let live = false;
  let caption: JpText | string | null = null;
  let nameCard: HTMLElement | null = h('p', { class: 'dub-namecard' }, h('span', { lang: 'ja' }, sc.who.text));
  if (!now) {
    overlay = h('div', { class: 'dub-over dub-curtain' }, h('p', { lang: 'ja' }, 'じょうえい'), h('small', {}, 'The screening'));
  } else {
    const key = `${game.round}:${now.index}`;
    nameCard = h('p', { class: 'dub-namecard' }, h('span', { lang: 'ja' }, sc.who.text), h('small', {}, ' CV: '), badge(view, now.playerId), now.adlib ? h('span', { class: 'dub-adlib', lang: 'ja' }, 'アドリブ') : null);
    if (now.skipped) overlay = h('div', { class: 'dub-over dub-cut' }, h('p', { lang: 'ja' }, 'カット！'), h('small', {}, 'Skipped'));
    else if (now.step === 'lead') {
      onceFor(`clap:${key}`, () => sfx('clap', 0.5));
      overlay = h('div', { class: 'dub-over dub-clapper' }, h('p', {}, `🎬 ${now.index + 1} / ${now.count}`), badge(view, now.playerId));
    } else if (now.step === 'play' || now.step === 'replay') {
      live = true;
      // An ad-lib has no script: the TV shows the model line's English only, so the room can follow
      // without reading the player a Japanese answer. The Japanese waits for the reveal.
      caption = now.adlib ? now.line.en : now.line;
      if (now.clipId && now.playAt !== null) playClip(now.clipId, `${key}:${now.step}`, serverNow() - now.playAt);
      if (now.local) overlay = h('p', { class: 'dub-phone' }, `📱 Playing from ${nameOf(view, now.playerId)}’s phone`);
      if (now.step === 'replay') overlay = h('p', { class: 'dub-phone' }, h('span', { lang: 'ja' }, 'もう いっかい！'), now.local ? ` 📱 ${nameOf(view, now.playerId)}’s phone` : '');
    } else if (now.step === 'guess' || now.step === 'regroup') {
      caption = now.adlib ? now.line.en : now.line;
      const left = Math.max(0, now.at + (now.step === 'guess' ? 4_500 : 3_000) - serverNow());
      panel = h(
        'div',
        { class: 'dub-panel dub-ask' },
        h('p', {}, 'How was it directed?'),
        h('p', { class: 'dub-count' }, `${now.guessed} / ${now.guessers} guessed`),
        now.again ? h('p', { class: 'dub-again' }, h('span', { lang: 'ja' }, 'もう いっかい'), ` 🙋 ×${now.again}`) : null,
        h('span', { class: 'dub-timer', style: `--d:${Math.round(left)}ms` }),
      );
    } else if (now.step === 'reveal' && now.card) {
      onceFor(`flip:${key}`, () => sfx('flip'));
      caption = now.line;
      panel = h(
        'div',
        { class: 'dub-panel dub-reveal' },
        cardFace(now.card, 'flip'),
        now.spoiler
          ? h('p', { class: 'dub-spoil' }, h('span', { lang: 'ja' }, 'ネタバレ！'), ' The card was said out loud: no acting points.')
          : h('p', { class: 'dub-got' }, now.guessedBy.length ? `⭕ ${now.guessedBy.map((id) => nameOf(view, id)).join(', ')}` : 'Nobody read it!'),
      );
    }
  }
  return h(
    'div',
    { class: 'dub-stage dub-split' },
    screen({ bg: sc.bg, char: sc.char, live, caption, nameCard, overlay }),
    h(
      'div',
      { class: 'dub-side' },
      h('p', { class: 'dub-tag' }, `Scene ${game.round} · the screening`),
      h('p', { class: 'dub-line', lang: 'ja' }, ruby(sc.line)),
      panel,
      game.done.length
        ? h(
            'ul',
            { class: 'dub-done' },
            game.done.map((d) => h('li', { class: d.skipped ? 'skipped' : '' }, badge(view, d.playerId), h('span', { class: 'dub-done-card' }, cardIcon(d.card), ' ', h('span', { lang: 'ja' }, d.card.jp.text)), h('span', { class: 'dub-done-n' }, d.skipped ? 'cut' : `⭕ ${d.guessed}`))),
          )
        : h('p', { class: 'dub-hint' }, 'Guess on your phone. ❤ your favourite: it goes into tonight’s episode.'),
    ),
    soundGate(),
  );
}

function notes(view: RoomView, game: DubView): HTMLElement {
  const sc = game.scene!;
  const rows = [...(game.results ?? [])].sort((a, b) => b.total - a.total);
  const best = game.best;
  return h(
    'div',
    { class: 'dub-stage dub-split' },
    best
      ? screen({ bg: sc.bg, char: sc.char, nameCard: h('p', { class: 'dub-namecard' }, '📼 Into tonight’s episode: ', badge(view, best)), overlay: h('div', { class: 'dub-over dub-best' }, h('p', { lang: 'ja' }, 'さいよう！'), h('small', {}, 'This take goes in the episode')) })
      : screen({ bg: sc.bg, char: sc.char }),
    h(
      'div',
      { class: 'dub-side' },
      h('p', { class: 'dub-tag' }, `Scene ${game.round} · cast notes`),
      h(
        'table',
        { class: 'dub-notes' },
        h('tr', {}, h('th', {}, ''), h('th', {}, 'Direction'), h('th', {}, '⭕'), h('th', {}, '❤'), h('th', {}, '')),
        rows.map((r) =>
          h(
            'tr',
            { class: r.playerId === best ? 'best' : '' },
            h('td', {}, badge(view, r.playerId)),
            h('td', { class: 'dub-notes-card' }, cardIcon(r.card), ' ', h('span', { lang: 'ja' }, r.card.jp.text), r.card.root ? h('small', { lang: 'ja' }, ` ← ${r.card.root.text}`) : null),
            h('td', {}, String(r.guessedBy.length)),
            h('td', {}, String(r.hearts)),
            h('td', { class: 'dub-notes-total' }, `+${r.total}`),
          ),
        ),
      ),
      h('p', { class: 'dub-hint' }, 'The words were checked privately on each phone.'),
    ),
  );
}

function episode(view: RoomView, game: DubView): HTMLElement {
  const st = game.step;
  const title = game.episode.title;
  if (!st || st.kind === 'title')
    return h(
      'div',
      { class: 'dub-stage dub-full' },
      h('div', { class: 'dub-screen big dub-titlecard' }, h('p', { class: 'dub-ep' }, h('span', { lang: 'ja' }, 'だいいちわ'), ' · Episode 1'), h('p', { class: 'dub-ep-title', lang: 'ja' }, ruby(title)), h('p', { class: 'dub-ep-en' }, title.en)),
      soundGate(),
    );
  if (st.kind === 'scene' && st.scene) {
    const s = st.scene;
    if (s.clipId) playClip(s.clipId, `ep:${s.index}`, serverNow() - (st.at + EPISODE.lead));
    return h(
      'div',
      { class: 'dub-stage dub-full' },
      screen({
        bg: s.bg,
        char: s.char,
        live: !!s.playerId,
        caption: s.adlib ? s.line.en : s.line,
        cls: 'big',
        nameCard: h('p', { class: 'dub-namecard' }, h('span', { lang: 'ja' }, s.who.text), s.playerId ? h('small', {}, ' CV: ') : null, s.playerId ? badge(view, s.playerId) : null),
        overlay: s.local && s.playerId ? h('p', { class: 'dub-phone' }, `📱 ${nameOf(view, s.playerId)}’s phone`) : null,
      }),
    );
  }
  if (st.kind === 'end') {
    onceFor(`end:${view.phaseSeq}`, () => sting('eyecatch'));
    return h('div', { class: 'dub-stage dub-full' }, h('div', { class: 'dub-screen big dub-titlecard end' }, h('p', { class: 'dub-ep-title', lang: 'ja' }, 'つづく…'), h('p', { class: 'dub-ep-en' }, 'To be continued…')));
  }
  return h(
    'div',
    { class: 'dub-stage dub-full' },
    h(
      'div',
      { class: 'dub-screen big dub-credits' },
      h(
        'div',
        { class: 'dub-roll', style: `--d:${EPISODE.credits}ms` },
        h('p', { class: 'dub-roll-title', lang: 'ja' }, title.text),
        h('p', { class: 'dub-roll-head' }, 'CAST'),
        game.credits.map((c) => h('p', { class: 'dub-roll-row' }, h('span', { lang: 'ja' }, c.who.text), h('span', {}, nameOf(view, c.playerId)), c.card ? h('small', {}, cardIcon(c.card), ' ', h('span', { lang: 'ja' }, c.card.jp.text)) : null)),
        h('p', { class: 'dub-roll-head' }, 'STAFF'),
        h('p', { class: 'dub-roll-row' }, h('span', { lang: 'ja' }, 'かんとく'), h('span', { lang: 'ja' }, 'フデ')),
        h('p', { class: 'dub-roll-row' }, h('span', { lang: 'ja' }, 'よさん'), h('span', {}, '¥0')),
        h('p', { class: 'dub-roll-row' }, h('span', { lang: 'ja' }, 'せいさく'), h('span', { lang: 'ja' }, 'アフレコ部')),
      ),
    ),
  );
}

let lastSeq = -1;

export const dubClubStage: StageMode<DubView> = {
  render(view, game) {
    if (view.phaseSeq !== lastSeq) {
      lastSeq = view.phaseSeq;
      // A new phase: anything still playing stops, and dubs may play again (the episode).
      stopClip();
      resetPlayed();
      once.clear();
    }
    switch (view.phase) {
      case 'intro':
        return intro(view, game);
      case 'prompt':
        return sceneScreen(view, game, 'prompt');
      case 'answer':
        return sceneScreen(view, game, 'answer');
      case 'reveal':
        return screening(view, game);
      case 'score':
        return notes(view, game);
      case 'finale':
        return episode(view, game);
      default:
        return h('div', { class: 'dub-stage' });
    }
  },

  badge(game, playerId) {
    const c = game.cast.find((x) => x.playerId === playerId);
    return c?.sent ? '🎬' : c?.passed ? '🎧' : '';
  },

  // Fude never talks over a voice.
  hostHoldMs(view) {
    if (view.phase !== 'reveal' && view.phase !== 'finale') return 0;
    const left = clipLeft();
    return left > 0 ? Math.round(left * 1000) + 300 : 0;
  },
};
