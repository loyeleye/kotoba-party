// The phone controller: join with the room code, then answer and vote.
// Everything on screen comes from the server's latest view; the phone only sends intents.

import { invite, inviteLinks } from '../../shared/src/share.js';
import { RoomClient, joinRoom, type CommandBody, type ConnectionStatus } from '../../shared/src/client.js';
import { LEVEL_LABELS, awardTitle, formatSeconds, h, mount, placesOf, ruby, seatShape } from '../../shared/src/dom.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MAX_NAME_LENGTH } from '../../shared/src/constants.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';
import { MODES, noFit, speakersIn, surprisePool } from '../../shared/src/modes/registry.js';
import { playRoulette } from '../../shared/src/roulette.js';
import { LEVELS, SURPRISE, type ByeReason, type JoinError, type Level, type ModeId, type PlayerView, type RoomView } from '../../shared/src/protocol.js';
import { PHONE_MODES } from './modes/index.js';
import { setSpeechService, speechReady } from './components/mic.js';
import { getTalkMode, isTalking, onTalkEnd, setQuiet, setSpeakLevel, setTalkMode, speakBox } from './components/speak.js';
import { openMicSheet, refreshMicSheet, type MicSheetState } from './micSheet.js';
import { quip, setQuipHost } from './components/ui.js';
import { setSoundOff } from './components/voice.js';
import { reconnectQuips, vipIdleQuip } from '../../content/src/hosts/quips.js';
import { account, accountPanel, fetchMe } from './account.js';
import { clearedCard, loadPathView, pathKey as pathViewKey, pathStrip, pathView, tonightBox, wishBadge } from './path.js';
import { phrasebookButton } from './phrasebook.js';
import type { HostId } from '../../content/src/types.js';

const LEVEL_HINTS: Record<Level, string> = {
  kana: 'New to Japanese: you’ll see rōmaji too',
  n5: 'I can read ひらがな and カタカナ',
  n4: 'I can read some 漢字 and make simple sentences',
};

const ERRORS: Record<string, string> = {
  'not-enough-players': 'Not enough players for that game.',
  'not-enough-mics': 'That game needs more players with their mic on.',
  'too-many-players': 'Too many players for that game.',
  'not-vip': 'Only the VIP can do that.',
  'already-answered': 'You already answered.',
  'already-voted': 'You already voted.',
  'own-answer': 'You can’t vote for your own answer.',
  'not-your-turn': 'It’s not your turn yet.',
  'empty-answer': 'Type or say something first.',
  'not-konnichiwa': 'That didn’t sound like こんにちは. Try again!',
  'too-long': 'That’s too long. Keep it short.',
  'say-it-first': 'Try saying it first. The tiles open in a moment.',
  'japanese-only': 'This round is Japanese only.',
  'not-japanese': 'Answer in Japanese (kana is fine).',
  'not-english': 'Write this step in English.',
  'not-kana': 'Use kana for this one.',
  'too-close': 'Too close to the real meaning. Make it a fake!',
  'kids-words': 'This room is set to Kids. Try other words!',
  'tiles-only': 'Pick one of your tiles for this card.',
  'not-katakana': 'Write your name in katakana (カタカナ).',
  'already-read': 'That card has already been read out.',
  'wrong-start': 'Your word has to start with the last sound.',
  repeat: 'That word was already used.',
  'not-the-word': 'Not quite. Try saying it again.',
  'not-a-judge': 'Only knocked-out players judge this one.',
  'no-tokens': 'No hint tokens left.',
  'no-tries-left': 'No tries left.',
  'already-guessed': 'You already guessed.',
  'readback-mismatch': 'That didn’t match the ticket: say the food and the number on it.',
  'no-customer': 'No customer yet: wait for the phone to ring.',
  'empty-box': 'The box is empty: call your team for the food first.',
  'too-late': 'Too late: that customer has gone.',
  beaten: 'Too late: the other kitchen served that customer first.',
  'already-solved': 'Someone already got it.',
  'already-hinted': 'You already used a hint.',
  'already-encored': 'You already did an encore.',
  'author-cant-vote': 'You can’t vote on your own answer.',
  'pick-form': 'Pick a form for the word first.',
  'tile-twice': 'Each tile can only be used once.',
  'frame-needs-verb': 'This frame needs a verb tile.',
  'frame-one-verb': 'This frame takes one verb.',
  fogged: 'That row is fogged this turn.',
  'not-face-down': 'Pick a face-down card.',
  'too-early': 'Wait for it…',
  'not-allowed': 'You can’t do that right now.',
  'not-eligible': 'You can’t do that right now.',
  'not-playing': 'You’re not in this game. Join the next one!',
  'bad-suspect': 'Pick a suspect first.',
  'already-accused': 'You already named a culprit.',
  'bad-drawing': 'Fude couldn’t read that drawing. Draw a bit more and send it again.',
  'your-drawing': 'That’s your drawing! Sit back and keep a straight face.',
  hidden: 'The VIP hid that one.',
  // Happyōkai!
  'own-talk': 'Vote for someone else’s talk.',
  'pick-a-title': 'Pick a title first.',
  'already-swapped': 'You’ve already swapped a title this turn.',
  'make-it-ta': 'Put the verb in the た form: のぼる → のぼった.',
  'make-it-te': 'Put the verb in the て form: たべる → たべて.',
  'say-something': 'Say something about this slide first (or wait a moment).',
  'pick-a-question': 'Choose a question first.',
  'question-chosen': 'A question was already chosen.',
  'not-yet': 'Save the applause for the last slide!',
};

let lastView: RoomView | null = null;
import { isRoomCode, normalizeRoomCode } from '../../shared/src/roomCode.js';
import { hasTabAudio, joinAudioTabs, onTabAudio } from '../../shared/src/audioTabs.js';

interface Session {
  code: string;
  token: string;
  playerId: string;
  name: string;
  /** The server runs speech-to-text; without it every spoken step is typed or tapped. */
  speech?: boolean;
  /** The address to invite friends to: the server's public one, which may be a short link. */
  site?: string;
  /** Joined signed in: the room saves this player's games. */
  account?: boolean;
}

const base = location.origin;
const app = document.getElementById('app')!;
const banner = document.getElementById('banner')!;
const toast = document.getElementById('toast')!;
const timerEl = document.getElementById('timer')!;

const JOIN_ERRORS: Record<JoinError | 'room-not-found' | 'network', string> = {
  'room-not-found': 'No room with that code. Check the TV.',
  'room-full': 'That room is full (8 players).',
  'game-in-progress': 'A game is already running. Join after it ends.',
  'name-taken': 'Someone already has that name.',
  'bad-name': `Pick a name of 1 to ${MAX_NAME_LENGTH} characters.`,
  network: 'Could not reach the server. Try again.',
};

let client: RoomClient | null = null;
let session: Session | null = null;
let screenKey = '';
let wakeLock: { release(): Promise<void> } | null = null;

// ---- storage (best effort: private mode may refuse) ----
function store(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function deviceId(): string {
  let id = load<string>('kotoba:device');
  if (!id) {
    id = crypto.randomUUID();
    store('kotoba:device', id);
  }
  return id;
}

// ---- join ----
function showJoin(message = '', draft?: { code: string; name: string }): void {
  client?.close();
  client = null;
  screenKey = '';
  timerEl.textContent = '';
  document.body.classList.remove('has-dock');
  const params = new URLSearchParams(location.search);
  const saved = load<Session>('kotoba:session');
  const codeInput = h('input', {
    id: 'code',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'characters',
    maxlength: 4,
    placeholder: 'KMTP',
    value: draft?.code ?? params.get('code') ?? saved?.code ?? '',
  }) as HTMLInputElement;
  const nameInput = h('input', { id: 'name', autocomplete: 'nickname', maxlength: MAX_NAME_LENGTH, placeholder: 'Your name', value: draft?.name ?? saved?.name ?? '' }) as HTMLInputElement;
  const error = h('p', { class: 'error' }, message);
  const button = h('button', { class: 'primary', type: 'submit' }, 'Join') as HTMLButtonElement;

  const form = h(
    'form',
    {
      class: 'join',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const code = normalizeRoomCode(codeInput.value);
        if (!isRoomCode(code)) {
          error.textContent = 'Room codes are 4 letters.';
          return;
        }
        button.disabled = true;
        void join(code, nameInput.value).then((err) => {
          button.disabled = false;
          if (err) error.textContent = JOIN_ERRORS[err as keyof typeof JOIN_ERRORS] ?? err;
        });
      },
    },
    h('h1', {}, 'Kotoba Party!'),
    h('label', {}, 'Room code', codeInput),
    h('label', {}, 'Name', nameInput),
    button,
    error,
  );
  // Optional sign-in and hosting, as two quiet chips under Join (docs/accounts.md). Never needed to play.
  if (!nameInput.value && account()) nameInput.value = account()!.name;
  // Hosting is the stage with no code: it makes a room. Left out when an invite link brought a player here.
  const host = params.has('code')
    ? null
    : h(
        'a',
        { class: 'join-chip', href: '/stage/', 'aria-label': 'Host a game: put the big screen on a TV or laptop' },
        h('img', { src: '/stage/assets/hosts/pon.png', alt: '', width: 32, height: 32, onerror: (e: Event) => (e.target as HTMLElement).remove() }),
        h('span', { class: 'join-chip-text' }, 'Host a game'),
      );
  // Signing in and coming back keeps what was typed.
  const extras = accountPanel(nameInput, { app, back: () => showJoin('', { code: codeInput.value, name: nameInput.value }) }, host);
  mount(app, form, extras);
  // Both filled (back from signing in, say): Join, so no keyboard opens over the screen.
  (!codeInput.value ? codeInput : !nameInput.value ? nameInput : button).focus();
}

async function join(code: string, name: string): Promise<string | null> {
  const saved = load<Session>('kotoba:session');
  let res;
  try {
    res = await joinRoom(base, code, {
      name,
      level: load<Level>('kotoba:level') ?? undefined,
      deviceId: deviceId(),
      token: saved?.code === code ? saved.token : undefined,
      account: account()?.token,
    });
  } catch {
    return 'network';
  }
  if ('error' in res) return res.error;
  start({ code, token: res.token, playerId: res.playerId, name, speech: !!res.speech, site: res.site, account: !!account() });
  return null;
}

function start(s: Session): void {
  session = s;
  store('kotoba:session', s);
  setSpeechService(s.speech ? { base, code: s.code, token: s.token } : null, { base, code: s.code, token: s.token });
  joinAudioTabs('phone', s.code);
  history.replaceState(null, '', `/?code=${s.code}`);
  closedAs = null;
  client = new RoomClient({ baseUrl: base, code: s.code, token: s.token, onState: render, onStatus: status, onBye: (reason) => (closedAs = reason) });
  client.connect();
  void keepAwake();
  mount(app, h('p', { class: 'center' }, 'Connecting…'));
}

/** Whose voice the reconnect banner uses: the current mode's host, Pon in the lobby. */
let bannerHost: HostId = 'pon';

// Short blips stay invisible: the pill only shows after 800 ms away, and says "Back in!" once the
// socket returns.
let awayTimer: ReturnType<typeof setTimeout> | undefined;
let wasAway = false;
/** Why the room said goodbye, so the join screen can tell a host's goodbye from a timeout. */
let closedAs: ByeReason | null = null;
function status(st: ConnectionStatus): void {
  clearTimeout(awayTimer);
  if (st === 'open') {
    if (wasAway) {
      banner.className = 'banner back';
      banner.textContent = 'Back in!';
      banner.hidden = false;
      awayTimer = setTimeout(() => (banner.hidden = true), 1200);
    } else banner.hidden = true;
    wasAway = false;
  } else if (st === 'reconnecting' || st === 'connecting') {
    awayTimer = setTimeout(() => {
      wasAway = true;
      const q = reconnectQuips[bannerHost];
      banner.className = 'banner away';
      banner.textContent = `${q.text} ${q.en}`;
      banner.hidden = false;
    }, 800);
  }
  if (st === 'seat-lost') {
    banner.hidden = true;
    store('kotoba:session', null);
    showJoin('You were away too long, so your seat was given up. Join again.');
  } else if (st === 'room-gone') {
    banner.hidden = true;
    store('kotoba:session', null);
    showJoin(closedAs === 'room-ended' ? 'The host closed the room. おつかれさまでした！ Thanks for playing.' : 'That room has closed.');
  }
}

// ---- game screens ----
// A redraw while a talk button is held would drop the take: hold it until the button is let go.
let heldView: RoomView | null = null;
onTalkEnd(() => {
  const v = heldView;
  heldView = null;
  if (v) render(v);
});

function render(view: RoomView): void {
  if (isTalking()) {
    heldView = view;
    return;
  }
  tickTimer();
  // A Surprise Me! game: the phone spins for it too, the moment the room leaves the lobby.
  if (view.surprise?.length && view.mode && lastView?.phase === 'lobby' && view.phase !== 'lobby') {
    const pool = view.surprise.map((id) => MODES[id].info);
    playRoulette(document.body, pool, MODES[view.mode].info, { calm: view.calmMotion || matchMedia('(prefers-reduced-motion: reduce)').matches });
  }
  const prevPhase = lastView?.phase;
  lastView = view;
  const me = view.players.find((p) => p.id === session?.playerId);
  if (!me) return;
  // The learning path's card reads the save: fresh in each lobby, and again once a finished game is in it.
  if (prevPhase !== view.phase && (view.phase === 'lobby' || view.phase === 'recap')) {
    const load = () => void loadPathView(account() && session?.account ? fetchMe : null, redraw);
    if (view.phase === 'recap') setTimeout(load, 1500);
    else load();
  }
  const isVip = me.isVip;
  document.body.dataset.motion = view.calmMotion ? 'calm' : '';
  const mode = view.game ? PHONE_MODES[view.game.mode] : null;
  const hold = view.game ? (mode!.hold?.(view, view.game, me.id) ?? null) : null;
  const modeKey = view.game ? mode!.key(view, view.game, me.id) : '';
  if (!view.game) endAsk = false;
  const key = hold !== null ? ['hold', view.phase, isVip, me.level, me.mic, me.soundOff, getTalkMode(), hold, endAsk].join('|') : [
    view.phase,
    view.phaseSeq,
    isVip,
    me.level,
    me.score,
    me.mic,
    me.soundOff,
    getTalkMode(),
    view.phase === 'lobby' ? view.players.map((p) => `${p.name}:${p.level}:${p.mic === 'quiet' ? 'q' : ''}`).join() + view.modes.length + view.packs.length : '',
    modeKey,
    endAsk,
    passAsk,
    pathKey(view),
  ].join('|');
  if (key === screenKey) return;
  screenKey = key;
  setSpeakLevel(me.level);
  setQuiet(me.mic === 'quiet');
  setSoundOff(me.soundOff);
  refreshMicSheet(micSheetState(me));

  // In a game (and its recap) the phone wears the mode's colour and host.
  const info = view.phase !== 'lobby' && view.mode ? MODES[view.mode].info : null;
  setQuipHost(info?.host ?? null);
  bannerHost = info?.host ?? 'pon';
  if (info) document.body.dataset.mode = info.id;
  else delete document.body.dataset.mode;
  const band = info
    ? h(
        'div',
        { class: 'me-band' },
        h('img', { class: 'me-host', src: `/stage/assets/hosts/${info.host}.png`, alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
        h('span', { class: 'me-title' }, info.title, h('small', { lang: 'ja' }, info.titleJa)),
      )
    : null;
  const header = h(
    'div',
    { class: 'me' },
    h('span', { class: `seat-badge seat-${me.seat}`, 'aria-label': `seat ${me.seat}` }, `${seatShape(me.seat)}${me.seat}`),
    h('span', { class: 'me-name' }, `${me.name} · ${LEVEL_LABELS[me.level]}`),
    isVip ? h('span', { class: 'vip' }, '★ VIP') : null,
    !view.game && me.total ? h('span', { class: 'tonight', title: 'Party points tonight' }, `★${me.total}`) : null,
    h('span', { class: 'score' }, `${me.score} pts`),
    session ? phrasebookButton(view.phase, { base, code: session.code, token: session.token, name: me.name, level: me.level }, flash) : null,
    // Always in the header, lobby too, so it's in the same place on every screen.
    soundSwitch(me),
    micSwitch(me),
  );
  mount(app, band, header, screenFor(view, me, isVip));
  dockTalk();
}

/** A screen with exactly one talk button pins it to the bottom of the phone, under the thumb. */
function dockTalk(): void {
  const talks = app.querySelectorAll<HTMLElement>('.talk');
  const one = talks.length === 1 ? talks[0]! : null;
  one?.classList.add('docked');
  document.body.classList.toggle('has-dock', !!one);
}

function screenFor(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  if (view.phase === 'lobby') return lobby(view, me, isVip);
  if (view.phase === 'recap' || !view.game) return recap(view, me, isVip);
  const screen = PHONE_MODES[view.game.mode].render({ view, game: view.game, me, isVip, send: play, flash, redraw, remainingMs: () => client?.remainingMs() ?? null });
  if (isVip) screen.append(endGameFold(view));
  return screen;
}

/** End game has been tapped once and is asking to be sure. */
let endAsk = false;
/** The VIP pressed Make VIP…: who it would go to, while the phone asks to be sure. */
let passAsk: string | null = null;

/**
 * The VIP's way out of a game picked by mistake: back to the menu, same room and players.
 * Scores go back to what they were when the game started, so it asks once first.
 */
function endGameFold(view: RoomView): HTMLElement {
  const title = view.mode ? MODES[view.mode].info.title : 'this game';
  const body = endAsk
    ? h(
        'div',
        { class: 'end-ask', role: 'alertdialog', 'aria-label': `End ${title}?` },
        h('p', {}, h('strong', {}, `End ${title} for everyone?`), ' Points from this game are dropped; scores go back to what they were when it started.'),
        h(
          'div',
          { class: 'end-row' },
          h('button', { type: 'button', class: 'secondary', onclick: () => ((endAsk = false), redraw()) }, 'Keep playing'),
          h('button', { type: 'button', class: 'secondary end-yes', onclick: () => void command({ type: 'endGame' }) }, 'Yes, end game'),
        ),
      )
    : h(
        'div',
        { class: 'end-ask' },
        h('p', { class: 'hint' }, `Picked the wrong game? Stop ${title} and go back to the menu. Everyone stays in the room.`),
        h('button', { type: 'button', class: 'secondary', onclick: () => ((endAsk = true), redraw()) }, '↩ End game, pick another…'),
      );
  return h('div', { class: 'vip-game' }, fold('vip-game', 'VIP controls', 'End this game', body));
}

/** The three levels as one segmented row; the chosen level's "I can…" line sits under it. */
function levelPicker(current: Level, onPick: (level: Level) => void): HTMLElement {
  return h(
    'div',
    { class: 'levels' },
    h(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-label': 'Your level' },
      LEVELS.map((l) =>
        h(
          'button',
          { type: 'button', role: 'radio', 'aria-checked': String(l === current), class: `seg-btn ${l === current ? 'on' : ''}`, title: LEVEL_HINTS[l], onclick: () => onPick(l) },
          LEVEL_LABELS[l],
        ),
      ),
    ),
    h('p', { class: 'hint small' }, LEVEL_HINTS[current]),
  );
}

/** What the learning path draws, so a loaded save, a pick or a wish redraws the lobby and recap. */
function pathKey(view: RoomView): string {
  if (view.phase !== 'lobby' && view.phase !== 'recap') return '';
  const wishes = view.phase === 'lobby' ? `${JSON.stringify(view.wishes ?? {})}:${view.me?.wish ?? ''}` : '';
  return `${pathViewKey()}:${menu.mode}:${wishes}`;
}

const forceRedraw = (): void => {
  screenKey = '';
  redraw();
};

/** The learning path's one-row strip, for a signed-in player who turned the path on (path.ts). */
function pathCard(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement | null {
  return pathStrip(me.level, { players: view.players.length, speakers: speakersIn(view.players) }, {
    isVip,
    recap: view.phase === 'recap',
    picked: view.phase === 'lobby' ? (menu.mode as ModeId) || null : null,
    wish: view.me?.wish ?? null,
    pick: (mode) => {
      menu.mode = mode;
      menu.rounds = 0;
      forceRedraw();
    },
    setWish: (mode) => void command({ type: 'wish', mode }),
    redraw: forceRedraw,
  });
}

/** "Local Line cleared", once, with the level move on offer. */
function pathCleared(me: PlayerView): HTMLElement | null {
  return clearedCard(
    me.level,
    (level) => {
      store('kotoba:level', level);
      void command({ type: 'setLevel', level });
    },
    forceRedraw,
  );
}

function lobby(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  const parts: (HTMLElement | null)[] = [
    h('p', { class: 'big' }, 'You are in!'),
    h('p', {}, `${view.players.length} player${view.players.length === 1 ? '' : 's'}: ${view.players.map((p) => p.name).join(', ')}`),
    micCheck(me),
    soundCheck(me),
    h('p', { class: 'hint' }, 'Your level'),
    levelPicker(me.level, (level) => {
      store('kotoba:level', level);
      void command({ type: 'setLevel', level });
    }),
  ];
  // The path's cleared card and strip sit under Start (or under the VIP's waiting line).
  if (isVip) parts.push(vipMenu(view, pathCard(view, me, isVip), pathCleared(me)));
  else parts.push(h('p', { class: 'hint' }, 'Waiting for the VIP to pick a game.'), pathCleared(me), pathCard(view, me, isVip), quip(vipIdleQuip));
  // Links to bring more people in: the phone link for when the QR code won't scan, the stage
  // screen link for friends playing from somewhere else.
  parts.push(fold('invite', ['Invite friends', ruby({ text: '友だちを よぼう', kana: 'ともだちを よぼう' }, { class: 'jp-k' })], 'Links for friends who can’t scan the code', invite(inviteLinks(session?.site ?? location.origin, view.code), view.code, false)));
  return h('div', { class: 'screen' }, parts);
}

/** Turns quiet mode on, or back off (the mic is checked again on the next lobby). */
const setMicQuiet = (quiet: boolean): void => void command({ type: 'micCheck', utterance: quiet ? { via: 'tap', text: '' } : null });

function micSheetState(me: PlayerView): MicSheetState {
  return {
    quiet: me.mic === 'quiet',
    setQuiet: setMicQuiet,
    talkModeChanged: () => {
      screenKey = '';
      redraw();
    },
  };
}

/**
 * The header's mic button: opens the Mic sheet (micSheet.ts) to turn quiet mode on or off and to pick hold or
 * tap to talk, any time, in the lobby or mid-game. It sits at the end of the header row, so it never covers
 * a game's screen. Always shown beside the sound switch: with no speech server tonight it still marks the
 * player as mic off, for the games with speaking roles.
 */
function micSwitch(me: PlayerView): HTMLElement {
  const quiet = me.mic === 'quiet';
  const tap = getTalkMode() === 'tap';
  const label = `Mic settings: ${quiet ? 'quiet mode' : `mic on, ${tap ? 'tap' : 'hold'} to talk`}`;
  const b = h(
    'button',
    {
      type: 'button',
      class: `mic-switch${quiet ? ' off' : ''}${tap && !quiet ? ' tap' : ''}`,
      'aria-label': label,
      'aria-haspopup': 'dialog',
      title: label,
      onclick: () => openMicSheet(b, micSheetState(me)),
    },
    // Quiet: the same mic, struck through (style.css .mic-switch.off::after). Tap to talk: a small dot badge.
    '🎤',
  );
  return b;
}

/**
 * The header's sound switch: Sound off silences this phone (a crowded room, no headphones) and its listening
 * prompts show as text instead (components/voice.ts). The TV keeps playing. Any time, lobby or mid-game.
 */
function soundSwitch(me: PlayerView): HTMLElement {
  const off = me.soundOff;
  const label = off ? 'Phone sound is off: tap to turn it on' : 'Phone sound is on: tap to turn it off';
  return h(
    'button',
    { type: 'button', class: `mic-switch sound-switch${off ? ' off' : ''}`, 'aria-label': label, 'aria-pressed': String(!off), title: label, onclick: () => void command({ type: 'setSound', on: off }) },
    // Off: the same speaker, struck through like the mic switch (style.css .mic-switch.off::after).
    '🔊',
  );
}

/** The lobby's sound line, under the mic check. */
function soundCheck(me: PlayerView): HTMLElement {
  if (me.soundOff) {
    return h(
      'div',
      { class: 'mic-quiet' },
      h('p', { class: 'mic' }, '🔇 Phone sound off: listening prompts show as text. The TV still plays.'),
      h('button', { type: 'button', class: 'linkish', onclick: () => void command({ type: 'setSound', on: true }) }, '🔊 Turn my phone sound on'),
    );
  }
  return h('button', { type: 'button', class: 'linkish sound-off-link', onclick: () => void command({ type: 'setSound', on: false }) }, 'I can’t hear my phone right now');
}

function micCheck(me: PlayerView): HTMLElement {
  if (me.mic === 'ok') return h('p', { class: 'mic ok' }, '🎤 Mic check passed. よろしく！');
  if (me.mic === 'quiet') {
    return h(
      'div',
      { class: 'mic-quiet' },
      h('p', { class: 'mic' }, '⌨️ Quiet mode: you’ll tap and type.'),
      h('button', { type: 'button', class: 'linkish', onclick: () => setMicQuiet(false) }, '🎤 Use my mic after all'),
    );
  }
  const tap = getTalkMode() === 'tap';
  return h(
    'div',
    { class: 'mic-check' },
    h('p', { class: 'hint' }, `Mic check: ${tap ? 'tap the button, then' : 'hold the button and'} say`),
    h('p', { class: 'big', lang: 'ja' }, 'こんにちは！'),
    me.level === 'kana' ? h('p', { class: 'hint' }, '(konnichiwa: “hello”)') : null,
    speakBox({
      label: 'Hold and say こんにちは',
      placeholder: 'こんにちは',
      // The check is for the mic, so no typed box beside it (speakBox still shows one when there's no mic to check).
      speechOnly: true,
      onSend: (utterance) => void command({ type: 'micCheck', utterance }),
    }),
    // Where holding versus tapping is first felt, so the choice is offered here too (also under the header's 🎤).
    h(
      'button',
      {
        type: 'button',
        class: 'linkish',
        onclick: () => {
          setTalkMode(tap ? 'hold' : 'tap');
          screenKey = '';
          redraw();
        },
      },
      tap ? 'Rather hold the button while you talk?' : 'Rather tap to start and stop?',
    ),
    h('button', { type: 'button', class: 'linkish', onclick: () => setMicQuiet(true) }, 'I can’t talk right now'),
  );
}

// What the VIP has set up on the menu. The lobby redraws whenever someone joins or changes
// level, so the picks (and which panels are open) live here rather than in the elements.
const menu = { mode: '', packId: '', rounds: 0, sheetOpen: false, folds: new Set<string>() };

/** A collapsed panel with a one-line summary; it remembers being open across redraws. */
function fold(id: string, title: string | (string | HTMLElement)[], sub: string, ...body: HTMLElement[]): HTMLElement {
  const el = h(
    'details',
    { class: 'fold', open: menu.folds.has(id) },
    h('summary', {}, h('span', { class: 'fold-title' }, h('span', {}, title), h('small', {}, sub))),
    h('div', { class: 'fold-body' }, body),
  ) as HTMLDetailsElement;
  el.addEventListener('toggle', () => (el.open ? menu.folds.add(id) : menu.folds.delete(id)));
  return el;
}

/** Surprise Me! on the menu: not a game of its own, the room rolls one of the games that fit. */
const SURPRISE_ENTRY: ModeInfo = {
  id: SURPRISE as ModeInfo['id'],
  title: 'Surprise Me!',
  titleJa: 'おまかせ',
  blurb: 'Can’t decide? Spin for a random game that everyone here can play.',
  host: 'pon',
  minPlayers: 1,
  maxPlayers: 8,
  roundChoices: [],
  usesPack: false,
};
const isSurprise = (m: ModeInfo) => (m.id as string) === SURPRISE;
// Players with their mic on in the room the menu was last drawn for (a game with speaking roles needs enough).
let speakers = 0;
const fitCount = (n: number) => surprisePool(n, speakers).length;
const fits = (m: ModeInfo, n: number) => (isSurprise(m) ? fitCount(n) > 0 : !noFit(m, n, speakers));
const micsShort = (m: ModeInfo, n: number) => !isSurprise(m) && noFit(m, n, speakers) === 'not-enough-mics';
const playersLabel = (m: ModeInfo, n = 0) =>
  isSurprise(m)
    ? `${fitCount(n)} game${fitCount(n) === 1 ? '' : 's'} fit`
    : micsShort(m, n)
      ? `🎤 needs ${m.minSpeakers} mics on`
      : m.minPlayers === m.maxPlayers
        ? `${m.minPlayers} players`
        : `${m.minPlayers}–${m.maxPlayers} players`;
const hostIcon = (m: ModeInfo) =>
  isSurprise(m)
    ? h('span', { class: 'gp-host gp-dice', 'aria-hidden': 'true' }, '🎲')
    : h('img', { class: 'gp-host', src: `/stage/assets/hosts/${m.host}.png`, alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() });

/**
 * The VIP's menu: tonight's game as one card that opens a picker sheet, topic and rounds side
 * by side, then Start. Calm motion lives in a folded settings panel under it.
 */
/** A game's Japanese title at the VIP's level: kana and rōmaji for beginners, furigana over the kanji for N5 and N4. */
function jaTitle(m: ModeInfo, level: Level): HTMLElement {
  if (level === 'kana') {
    const kana = m.titleKana ?? m.titleJa;
    return h('span', { class: 'gp-ja' }, h('span', { lang: 'ja' }, kana), h('small', { class: 'gp-romaji' }, toRomaji(kana)));
  }
  return ruby({ text: m.titleJa, kana: m.titleKana }, { class: 'gp-ja' });
}

function vipMenu(view: RoomView, strip: HTMLElement | null = null, cleared: HTMLElement | null = null): HTMLElement {
  const n = view.players.length;
  speakers = speakersIn(view.players);
  const level = view.players.find((p) => p.isVip)?.level ?? 'n5';
  // Surprise Me! sits first on the list; it rolls among the games below it.
  const entries = view.modes.length ? [SURPRISE_ENTRY, ...view.modes] : [];
  // Keep the VIP's pick across redraws; the first game that fits the room is the default.
  let chosen = entries.find((m) => m.id === menu.mode) ?? view.modes.find((m) => fits(m, n)) ?? view.modes[0];
  const packSelect = h('select', { 'aria-label': 'Topic' }, h('option', { value: '' }, 'Any topic'), view.packs.map((p) => h('option', { value: p.id }, `${p.titleJa} · ${p.title}`))) as HTMLSelectElement;
  packSelect.value = menu.packId;
  packSelect.addEventListener('change', () => (menu.packId = packSelect.value));
  const roundsSelect = h('select', { 'aria-label': 'Length' }) as HTMLSelectElement;
  roundsSelect.addEventListener('change', () => (menu.rounds = Number(roundsSelect.value)));
  const packField = h('label', { class: 'gp-field' }, h('span', {}, 'Topic'), packSelect);
  const roundsField = h('label', { class: 'gp-field' }, h('span', {}, 'Length'), roundsSelect);
  const note = h('p', { class: 'hint', role: 'status' });
  const extras = h('div', { class: 'vip-extras' });
  const ticked = new Set<string>();
  const startBtn = h('button', { class: 'primary' }, 'Start') as HTMLButtonElement;
  const current = h('button', { type: 'button', class: 'gp-current', 'aria-haspopup': 'dialog' }) as HTMLButtonElement;

  const rows = entries.map((m) =>
    h(
      'button',
      {
        type: 'button',
        class: `gp-row ${fits(m, n) ? '' : 'gp-nofit'}${isSurprise(m) ? ' gp-surprise' : ''}`,
        onclick: () => {
          chosen = m;
          menu.mode = m.id;
          menu.rounds = 0;
          refresh();
          closeSheet();
          // The learning path's card says whether its game is the one on the menu.
          if (pathView()) {
            menu.sheetOpen = false; // the dialog's close event comes after this redraw
            screenKey = '';
            redraw();
          }
        },
      },
      hostIcon(m),
      h('span', { class: 'gp-text' }, h('strong', {}, m.title), jaTitle(m, level), h('small', {}, m.blurb)),
      h('span', { class: 'gp-players' }, playersLabel(m, n), isSurprise(m) ? null : wishBadge(view.wishes?.[m.id as ModeId])),
    ),
  );
  const sheet = h(
    'dialog',
    { class: 'gp-sheet', 'aria-labelledby': 'gp-sheet-title' },
    h('div', { class: 'gp-head' }, h('h2', { id: 'gp-sheet-title' }, 'Pick tonight’s game'), h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: () => closeSheet() }, '✕')),
    h('div', { class: 'gp-list' }, rows),
  ) as HTMLDialogElement;
  // A tap on the dimmed backdrop (the dialog itself, outside its content) closes the sheet.
  sheet.addEventListener('click', (e) => e.target === sheet && closeSheet());
  sheet.addEventListener('close', () => {
    menu.sheetOpen = false;
    if (sheet.isConnected) current.focus();
  });
  const openSheet = () => {
    menu.sheetOpen = true;
    if (!sheet.open) sheet.showModal();
    rows[entries.indexOf(chosen!)]?.focus();
  };
  const closeSheet = () => sheet.open && sheet.close();
  current.addEventListener('click', openSheet);

  function refresh(): void {
    entries.forEach((m, i) => {
      rows[i]!.classList.toggle('on', m === chosen);
      rows[i]!.setAttribute('aria-current', String(m === chosen));
    });
    if (!chosen) return;
    const m = chosen;
    mount(
      current,
      hostIcon(m),
      h('span', { class: 'gp-text' }, h('small', { class: 'gp-kicker' }, 'Tonight’s game'), h('strong', {}, m.title), jaTitle(m, level), h('small', {}, m.blurb), isSurprise(m) ? null : wishBadge(view.wishes?.[m.id as ModeId])),
      h('span', { class: 'gp-change' }, 'Change'),
    );
    current.setAttribute('aria-label', `Tonight’s game: ${m.title}. Change game`);
    mount(roundsSelect, m.roundChoices.map((r) => h('option', { value: r }, `${r} ${m.id === 'last-train' ? 'stops' : 'rounds'}`)));
    if (m.roundChoices.includes(menu.rounds)) roundsSelect.value = String(menu.rounds);
    roundsField.hidden = m.roundChoices.length === 0;
    packField.hidden = !m.usesPack || view.packs.length === 0;
    ticked.clear();
    mount(
      extras,
      (m.extras ?? []).map((x) => {
        const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
        box.addEventListener('change', () => (box.checked ? ticked.add(x.key) : ticked.delete(x.key)));
        return h('label', { class: 'vip-extra' }, box, ` ${x.label}`);
      }),
    );
    const ok = fits(m, n);
    startBtn.disabled = !ok;
    startBtn.textContent = !ok ? 'Start' : isSurprise(m) ? '🎲 Spin for a game!' : `Start ${m.title}`;
    note.textContent = !ok
      ? isSurprise(m)
        ? `No game fits ${n} player${n === 1 ? '' : 's'} yet.`
        : micsShort(m, n)
          ? `${m.title} needs ${m.minSpeakers} players with their mic on. Tonight ${speakers === 1 ? 'there’s 1' : `there are ${speakers}`}.`
          : `${m.title} needs ${playersLabel(m)}. Tonight there ${n === 1 ? 'is 1' : `are ${n}`}.`
      : isSurprise(m)
        ? fitCount(n) === 1
          ? `Chooses the only game available for ${n} player${n === 1 ? '' : 's'}.`
          : `Randomly chooses one of the ${fitCount(n)} games available for ${n} player${n === 1 ? '' : 's'}.`
        : '';
  }
  startBtn.addEventListener('click', () => {
    if (!chosen) return;
    void command({
      type: 'start',
      mode: chosen.id,
      rounds: roundsField.hidden ? undefined : Number(roundsSelect.value),
      packId: packField.hidden || !packSelect.value ? undefined : packSelect.value,
      extra: ticked.size ? Object.fromEntries([...ticked].map((k) => [k, true])) : undefined,
    });
  });
  refresh();
  // Reopen the sheet if a redraw (someone joined) replaced it while the VIP was choosing.
  if (menu.sheetOpen) queueMicrotask(() => sheet.isConnected && openSheet());
  return h(
    'div',
    { class: 'vip-start' },
    current,
    h('div', { class: 'gp-fields' }, packField, roundsField),
    extras,
    note,
    startBtn,
    cleared,
    strip,
    fold('settings', ['Room settings', ruby({ text: 'へやの 設定', kana: 'へやの せってい' }, { class: 'jp-k' })], 'Calm motion · Hand over VIP', motionToggle(view), vipHandoff(view)),
    sheet,
  );
}

/** The VIP's Calm motion switch: the TV and every phone swap movement for fades and still sprites. */
function motionToggle(view: RoomView): HTMLElement {
  const btn = h(
    'button',
    { type: 'button', role: 'switch', class: 'switch-row motion-btn' },
    h('span', { class: 'switch-text' }, 'Calm motion', h('small', {}, 'Fades and still sprites instead of movement, on the TV and every phone.')),
    h('span', { class: 'switch', 'aria-hidden': 'true' }),
  ) as HTMLButtonElement;
  const label = (calm: boolean) => btn.setAttribute('aria-checked', String(calm));
  label(view.calmMotion);
  btn.addEventListener('click', async () => {
    const calm = !(lastView?.calmMotion ?? view.calmMotion);
    if (await command({ type: 'setMotion', calm })) label(calm);
  });
  return btn;
}

/** Hands the VIP star (picking and running the games) to another player's phone. */
function vipHandoff(view: RoomView): HTMLElement {
  const others = view.players.filter((p) => !p.isVip);
  if (!others.length) return h('p', { class: 'hint vip-pass' }, 'Once a friend joins, you can make them the VIP here.');
  const label = h('span', { class: 'switch-text' }, 'Hand over VIP', h('small', {}, 'They pick the games, start, skip and play again from their phone. You stay in the game.'));
  const to = passAsk ? others.find((p) => p.id === passAsk) : undefined;
  if (to) {
    // It takes the game menu off this phone, so it asks first, like End game.
    const yes = h('button', { type: 'button', class: 'secondary end-yes' }, `Yes, ${to.name}`) as HTMLButtonElement;
    yes.addEventListener('click', () => {
      yes.disabled = true;
      passAsk = null;
      void command({ type: 'passVip', playerId: to.id }).finally(() => redraw());
    });
    return h(
      'div',
      { class: 'vip-pass' },
      label,
      h('p', { class: 'vip-pass-ask' }, `Make ${to.name} the VIP? The game menu moves to their phone.`),
      h('div', { class: 'end-row' }, h('button', { type: 'button', class: 'secondary', onclick: () => ((passAsk = null), redraw()) }, 'Keep it'), yes),
    );
  }
  passAsk = null;
  const pick = h('select', { 'aria-label': 'New VIP' }, others.map((p) => h('option', { value: p.id }, p.name))) as HTMLSelectElement;
  const give = h('button', { type: 'button', class: 'secondary', onclick: () => ((passAsk = pick.value), redraw()) }, 'Make VIP…');
  return h('div', { class: 'vip-pass' }, label, h('div', { class: 'vip-pass-row' }, pick, give));
}

const ORDINAL = ['', '1st', '2nd', '3rd'];

/** Signed in when they joined: this game went into their saved progress. */
function savedNote(): HTMLElement | null {
  const a = account();
  return a && session?.account ? h('p', { class: 'acct-saved' }, `✓ Saved to ${a.name}’s progress`) : null;
}

function recap(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  const r = view.recap;
  const standings = r?.standings ?? [];
  const places = placesOf(standings.map((s) => s.score));
  const i = standings.findIndex((s) => s.playerId === me.id);
  // A 0 isn't a place: nobody is told they came 3rd for scoring nothing.
  const place = i >= 0 && standings[i]!.score > 0 ? places[i]! : 0;
  const tied = place > 0 && places.filter((p) => p === place).length > 1;
  const romaji = me.level === 'kana';
  // A team game leads with the team: everyone shared its points, so a place would only rank bonuses.
  const total = standings.reduce((a, s) => a + s.score, 0);
  // A team game (Bento Haus VS) leads with how your team did; places come after.
  const teams = r?.teams ?? [];
  const mine = teams.findIndex((t) => t.members.includes(me.id));
  const rank = (t: (typeof teams)[number]) => t.wins * 1000 + t.tips;
  const teamResult =
    mine >= 0
      ? h(
          'div',
          { class: `recap-team-p team-${mine}` },
          h(
            'p',
            { class: 'big', lang: 'ja' },
            teams.every((t) => rank(t) === rank(teams[mine]!)) ? 'ひきわけ！' : teams.every((t) => rank(t) <= rank(teams[mine]!)) ? `${teams[mine]!.ja}の かち！` : `${teams[mine]!.ja}… ざんねん！`,
          ),
          h('p', {}, teams.map((t, j) => `${t.ja}${j === mine ? ' (you)' : ''}: ${t.wins} ${t.wins === 1 ? 'shift' : 'shifts'}, ${t.tips} ${t.tips === 1 ? 'tip' : 'tips'}`).join(' · ')),
        )
      : null;
  return h(
    'div',
    { class: 'screen' },
    teamResult,
    r?.coop
      ? h('div', { class: 'place p1' }, h('span', { class: 'place-n' }, `${total}`), h('span', { class: 'place-label' }, '🤝 points together'))
      : place && mine < 0
      ? h(
          'div',
          { class: `place${place <= 3 ? ` p${place}` : ''}` },
          h('span', { class: 'place-n' }, ORDINAL[place] ?? `${place}th`),
          h('span', { class: 'place-label' }, tied ? 'tied' : place === 1 ? 'Tonight’s winner!' : 'place'),
        )
      : mine >= 0
        ? null
        : h('p', { class: 'big' }, i >= 0 ? 'No points this time. Next game!' : 'Game over'),
    i >= 0 && standings[i]!.total ? h('p', { class: 'party' }, standings[i]!.earned ? `★ +${standings[i]!.earned} party points · ${standings[i]!.total} tonight` : `★ ${standings[i]!.total} party points tonight`) : null,
    h(
      'ol',
      { class: 'recap-list' },
      standings.map((s, j) => h('li', { class: s.playerId === me.id ? 'me-row' : '' }, h('span', {}, r?.coop ? s.name : s.score > 0 ? `${places.filter((p) => p === places[j]).length > 1 ? '=' : ''}${places[j]}. ${s.name}` : `–  ${s.name}`), h('span', { class: 'pts' }, s.score))),
    ),
    r?.awards.filter((a) => a.playerId === me.id).map((a) => h('p', { class: 'award' }, '🏆 ', h('span', { lang: 'ja' }, awardTitle(a.title)), ` · ${a.en}`)),
    r?.phrasebook.length && view.mode ? tonightBox(r.phrasebook, view.mode, me.level) : null,
    r?.phrasebook.length
      ? h(
          'details',
          { class: 'phrasebook', open: true },
          h('summary', {}, `${(view.mode && MODES[view.mode].info.phrasebookTitle) || 'Tonight’s phrasebook'} (${r.phrasebook.length})`),
          h(
            'ul',
            { class: 'phrase-cards' },
            r.phrasebook.map((e) => {
              const ro = romaji ? toRomaji(e.kana) : '';
              return h(
                'li',
                { class: `phrase-card pb-${e.outcome}` },
                h('span', { class: 'pc-jp', lang: 'ja' }, e.text),
                e.kana !== e.text ? h('span', { class: 'pc-kana', lang: 'ja' }, e.kana) : null,
                ro ? h('span', { class: 'pc-romaji' }, ro) : null,
                // A kana's English is its romaji (ま · ma): once is enough.
                e.en !== ro ? h('span', { class: 'pc-en' }, e.en) : null,
              );
            }),
          ),
        )
      : null,
    savedNote(),
    pathCleared(me),
    pathCard(view, me, isVip),
    isVip ? h('button', { class: 'primary', onclick: () => void command({ type: 'playAgain' }) }, 'Back to the menu') : h('p', { class: 'hint' }, 'The VIP can start another game.'),
  );
}

// Moves that lock something in get a stamp and a buzz; small taps (tiles, peeks, ticks) don't.
const LOCK_INS = new Set(['accuse', 'answer', 'call', 'draw', 'fake', 'guess', 'judge', 'pick', 'ready', 'reply', 'say', 'sing', 'vote', 'word', 'step', 'chorus', 'echo', 'rank', 'wish']);

async function play(move: unknown): Promise<boolean> {
  const ok = await command({ type: 'play', move });
  const kind = (move as { kind?: unknown } | null)?.kind;
  if (ok && typeof kind === 'string' && LOCK_INS.has(kind)) lockIn();
  return ok;
}

/** 決定: a stamp that thumps down on the phone, plus a short vibration where the phone allows it. */
function lockIn(): void {
  try {
    navigator.vibrate?.(30);
  } catch {
    /* not allowed */
  }
  const stamp = h('div', { class: 'lock-stamp', 'aria-hidden': 'true', lang: 'ja' }, '決定');
  document.body.append(stamp);
  setTimeout(() => stamp.remove(), 900);
}

async function command(body: CommandBody): Promise<boolean> {
  if (!client) return false;
  try {
    const result = await client.send(body);
    if (!result.ok && result.error !== 'wrong-phase') flash(ERRORS[result.error] ?? result.error);
    return result.ok;
  } catch {
    flash('Network trouble. Try again.');
    return false;
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function redraw(): void {
  if (lastView) render(lastView);
}

function flash(text: string): void {
  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.textContent = text;
  toastTimer = setTimeout(() => (toast.hidden = true), 2500);
}

async function keepAwake(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
}

// A phone coming back from sleep should not wait for the backoff timer.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && client) {
    client.reconnectNow();
    if (!wakeLock) void keepAwake();
  }
});
// Two tabs of this phone on the room: only the one in front reads Japanese aloud (audioTabs.ts).
onTabAudio((active) => {
  if (!active && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
});
window.addEventListener('online', () => client?.reconnectNow());

function tickTimer(): void {
  timerEl.textContent = formatSeconds(client?.remainingMs() ?? null);
}
setInterval(tickTimer, 250);

// Reloaded page: go straight back to the saved seat for this room.
const saved = load<Session>('kotoba:session');
const wanted = new URLSearchParams(location.search).get('code');
if (saved && (!wanted || normalizeRoomCode(wanted) === saved.code)) {
  void joinRoom(base, saved.code, { name: saved.name, token: saved.token, deviceId: deviceId() })
    .then((res) => ('error' in res ? showJoin() : start({ ...saved, token: res.token, playerId: res.playerId, speech: !!res.speech, site: res.site })))
    .catch(() => showJoin());
} else {
  showJoin();
}
