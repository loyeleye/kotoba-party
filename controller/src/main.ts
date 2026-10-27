// The phone controller: join with the room code, then answer and vote.
// Everything on screen comes from the server's latest view; the phone only sends intents.

import { invite, inviteLinks } from '../../shared/src/share.js';
import { RoomClient, joinRoom, type CommandBody, type ConnectionStatus } from '../../shared/src/client.js';
import { LEVEL_LABELS, awardTitle, formatSeconds, h, mount, placesOf, seatShape } from '../../shared/src/dom.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MAX_NAME_LENGTH } from '../../shared/src/constants.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { LEVELS, type JoinError, type Level, type PlayerView, type RoomView } from '../../shared/src/protocol.js';
import { PHONE_MODES } from './modes/index.js';
import { setSpeechService } from './components/mic.js';
import { setQuiet, setSpeakLevel, speakBox } from './components/speak.js';
import { quip, setQuipHost } from './components/ui.js';
import { reconnectQuips, vipIdleQuip } from '../../content/src/hosts/quips.js';
import type { HostId } from '../../content/src/types.js';

const LEVEL_HINTS: Record<Level, string> = {
  kana: 'I can’t read Japanese yet',
  n5: 'I can read ひらがな',
  n4: 'I can make simple sentences',
};

const ERRORS: Record<string, string> = {
  'not-enough-players': 'Not enough players for that game.',
  'too-many-players': 'Too many players for that game.',
  'not-vip': 'Only the VIP can do that.',
  'already-answered': 'You already answered.',
  'already-voted': 'You already voted.',
  'own-answer': 'You can’t vote for your own answer.',
  'not-your-turn': 'It’s not your turn yet.',
  'empty-answer': 'Type or say something first.',
  'too-long': 'That’s too long. Keep it short.',
  'say-it-first': 'Try saying it first. The tiles open in a moment.',
  'japanese-only': 'This round is Japanese only.',
  'not-japanese': 'Answer in Japanese (kana is fine).',
  'not-english': 'Write this step in English.',
  'not-kana': 'Use kana for this one.',
  'too-close': 'Too close to the real meaning. Make it a fake!',
  'wrong-start': 'Your word has to start with the last sound.',
  repeat: 'That word was already used.',
  'not-the-word': 'Not quite. Try saying it again.',
  'not-a-judge': 'Only knocked-out players judge this one.',
  'no-tokens': 'No hint tokens left.',
  'no-tries-left': 'No tries left.',
  'already-guessed': 'You already guessed.',
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
function showJoin(message = ''): void {
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
    placeholder: 'ABCD',
    value: params.get('code') ?? saved?.code ?? '',
  }) as HTMLInputElement;
  const nameInput = h('input', { id: 'name', autocomplete: 'nickname', maxlength: MAX_NAME_LENGTH, placeholder: 'Your name', value: saved?.name ?? '' }) as HTMLInputElement;
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
  mount(app, form);
  (codeInput.value ? nameInput : codeInput).focus();
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
    });
  } catch {
    return 'network';
  }
  if ('error' in res) return res.error;
  start({ code, token: res.token, playerId: res.playerId, name, speech: !!res.speech, site: res.site });
  return null;
}

function start(s: Session): void {
  session = s;
  store('kotoba:session', s);
  setSpeechService(s.speech ? { base, code: s.code, token: s.token } : null);
  joinAudioTabs('phone', s.code);
  history.replaceState(null, '', `/?code=${s.code}`);
  client = new RoomClient({ baseUrl: base, code: s.code, token: s.token, onState: render, onStatus: status });
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
    showJoin('That room has closed.');
  }
}

// ---- game screens ----
function render(view: RoomView): void {
  tickTimer();
  lastView = view;
  const me = view.players.find((p) => p.id === session?.playerId);
  if (!me) return;
  const isVip = me.isVip;
  document.body.dataset.motion = view.calmMotion ? 'calm' : '';
  const modeKey = view.game ? PHONE_MODES[view.game.mode].key(view, view.game, me.id) : '';
  const key = [
    view.phase,
    view.phaseSeq,
    isVip,
    me.level,
    me.score,
    me.mic,
    view.phase === 'lobby' ? view.players.map((p) => `${p.name}:${p.level}`).join() + view.modes.length + view.packs.length : '',
    modeKey,
  ].join('|');
  if (key === screenKey) return;
  screenKey = key;
  setSpeakLevel(me.level);
  setQuiet(me.mic === 'quiet');

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
    h('span', {}, `${me.name} · ${LEVEL_LABELS[me.level]}`),
    isVip ? h('span', { class: 'vip' }, '★ VIP') : null,
    h('span', { class: 'score' }, `${me.score} pts`),
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
  return PHONE_MODES[view.game.mode].render({ view, game: view.game, me, isVip, send: play, flash });
}

function levelPicker(current: Level, onPick: (level: Level) => void): HTMLElement {
  return h(
    'div',
    { class: 'levels' },
    LEVELS.map((l) =>
      h(
        'button',
        { type: 'button', class: `level-btn ${l === current ? 'on' : ''}`, onclick: () => onPick(l) },
        h('strong', {}, LEVEL_LABELS[l]),
        h('span', {}, LEVEL_HINTS[l]),
      ),
    ),
  );
}

function lobby(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  const parts: (HTMLElement | null)[] = [
    h('p', { class: 'big' }, 'You are in!'),
    h('p', {}, `${view.players.length} player${view.players.length === 1 ? '' : 's'}: ${view.players.map((p) => p.name).join(', ')}`),
    micCheck(me),
    h('p', { class: 'hint' }, 'Your level:'),
    levelPicker(me.level, (level) => {
      store('kotoba:level', level);
      void command({ type: 'setLevel', level });
    }),
  ];
  if (isVip) parts.push(vipMenu(view));
  else parts.push(h('p', { class: 'hint' }, 'Waiting for the VIP to pick a game.'), quip(vipIdleQuip));
  // Links to bring more people in: the phone link for when the QR code won't scan, the stage
  // screen link for friends playing from somewhere else.
  parts.push(invite(inviteLinks(session?.site ?? location.origin, view.code), view.code));
  return h('div', { class: 'screen' }, parts);
}

function micCheck(me: PlayerView): HTMLElement {
  if (me.mic === 'ok') return h('p', { class: 'mic ok' }, '🎤 Mic check passed. よろしく！');
  if (me.mic === 'quiet') return h('p', { class: 'mic' }, '⌨️ Quiet mode: you’ll tap and type. (You can still talk any time.)');
  return h(
    'div',
    { class: 'mic-check' },
    h('p', { class: 'hint' }, 'Mic check: hold the button and say'),
    h('p', { class: 'big', lang: 'ja' }, 'こんにちは！'),
    me.level === 'kana' ? h('p', { class: 'hint' }, '(konnichiwa: “hello”)') : null,
    speakBox({
      label: 'Hold and say こんにちは',
      placeholder: 'こんにちは',
      onSend: (utterance) => void command({ type: 'micCheck', utterance }),
    }),
    h('button', { type: 'button', class: 'linkish', onclick: () => void command({ type: 'micCheck', utterance: { via: 'tap', text: '' } }) }, 'I can’t talk right now'),
  );
}

function vipMenu(view: RoomView): HTMLElement {
  let chosen: ModeInfo | undefined = view.modes[0];
  const packSelect = h('select', {}, h('option', { value: '' }, 'Any topic'), view.packs.map((p) => h('option', { value: p.id }, `${p.titleJa} · ${p.title}`))) as HTMLSelectElement;
  const roundsSelect = h('select', {}) as HTMLSelectElement;
  const note = h('p', { class: 'hint' });
  const startBtn = h('button', { class: 'primary' }, 'Start') as HTMLButtonElement;
  const modeButtons = view.modes.map((m) =>
    h(
      'button',
      {
        type: 'button',
        class: 'mode-btn',
        onclick: () => {
          chosen = m;
          refresh();
        },
      },
      h('strong', {}, `${m.title} `),
      h('span', { lang: 'ja' }, m.titleJa),
      h('small', {}, m.blurb),
    ),
  );
  const refresh = () => {
    view.modes.forEach((m, i) => modeButtons[i]!.classList.toggle('on', m === chosen));
    if (!chosen) return;
    mount(roundsSelect, chosen.roundChoices.map((n) => h('option', { value: n }, `${n} ${chosen!.id === 'last-train' ? 'stops' : 'rounds'}`)));
    roundsSelect.hidden = chosen.roundChoices.length === 0;
    packSelect.hidden = !chosen.usesPack || view.packs.length === 0;
    const n = view.players.length;
    const ok = n >= chosen.minPlayers && n <= chosen.maxPlayers;
    startBtn.disabled = !ok;
    note.textContent = ok ? '' : `${chosen.title} needs ${chosen.minPlayers}–${chosen.maxPlayers} players.`;
  };
  startBtn.addEventListener('click', () => {
    if (!chosen) return;
    void command({
      type: 'start',
      mode: chosen.id,
      rounds: roundsSelect.hidden ? undefined : Number(roundsSelect.value),
      packId: packSelect.hidden || !packSelect.value ? undefined : packSelect.value,
    });
  });
  refresh();
  return h('div', { class: 'vip-start' }, h('p', { class: 'hint' }, 'Pick tonight’s game:'), modeButtons, packSelect, roundsSelect, note, startBtn, motionToggle(view));
}

/** The VIP's Calm motion switch: the TV and every phone swap movement for fades and still sprites. */
function motionToggle(view: RoomView): HTMLElement {
  const btn = h('button', { type: 'button', class: 'secondary motion-btn', 'aria-pressed': String(view.calmMotion) }) as HTMLButtonElement;
  const label = (calm: boolean) => {
    btn.setAttribute('aria-pressed', String(calm));
    btn.textContent = calm ? 'Calm motion: on' : 'Calm motion: off';
  };
  label(view.calmMotion);
  btn.addEventListener('click', async () => {
    const calm = !(lastView?.calmMotion ?? view.calmMotion);
    if (await command({ type: 'setMotion', calm })) label(calm);
  });
  return btn;
}

const ORDINAL = ['', '1st', '2nd', '3rd'];

function recap(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  const r = view.recap;
  const standings = r?.standings ?? [];
  const places = placesOf(standings.map((s) => s.score));
  const i = standings.findIndex((s) => s.playerId === me.id);
  // A 0 isn't a place: nobody is told they came 3rd for scoring nothing.
  const place = i >= 0 && standings[i]!.score > 0 ? places[i]! : 0;
  const tied = place > 0 && places.filter((p) => p === place).length > 1;
  const romaji = me.level === 'kana';
  return h(
    'div',
    { class: 'screen' },
    place
      ? h(
          'div',
          { class: `place${place <= 3 ? ` p${place}` : ''}` },
          h('span', { class: 'place-n' }, ORDINAL[place] ?? `${place}th`),
          h('span', { class: 'place-label' }, tied ? 'tied' : place === 1 ? 'Tonight’s winner!' : 'place'),
        )
      : h('p', { class: 'big' }, i >= 0 ? 'No points this time. Next game!' : 'Game over'),
    h(
      'ol',
      { class: 'recap-list' },
      standings.map((s, j) => h('li', { class: s.playerId === me.id ? 'me-row' : '' }, h('span', {}, s.score > 0 ? `${places.filter((p) => p === places[j]).length > 1 ? '=' : ''}${places[j]}. ${s.name}` : `–  ${s.name}`), h('span', { class: 'pts' }, s.score))),
    ),
    r?.awards.filter((a) => a.playerId === me.id).map((a) => h('p', { class: 'award' }, '🏆 ', h('span', { lang: 'ja' }, awardTitle(a.title)), ` · ${a.en}`)),
    r?.phrasebook.length
      ? h(
          'details',
          { class: 'phrasebook', open: true },
          h('summary', {}, `${(view.mode && MODES[view.mode].info.phrasebookTitle) || 'Tonight’s phrasebook'} (${r.phrasebook.length})`),
          h(
            'ul',
            { class: 'phrase-cards' },
            r.phrasebook.map((e) =>
              h(
                'li',
                { class: `phrase-card pb-${e.outcome}` },
                h('span', { class: 'pc-jp', lang: 'ja' }, e.text),
                e.kana !== e.text ? h('span', { class: 'pc-kana', lang: 'ja' }, e.kana) : null,
                romaji ? h('span', { class: 'pc-romaji' }, toRomaji(e.kana)) : null,
                h('span', { class: 'pc-en' }, e.en),
              ),
            ),
          ),
        )
      : null,
    isVip ? h('button', { class: 'primary', onclick: () => void command({ type: 'playAgain' }) }, 'Back to the menu') : h('p', { class: 'hint' }, 'The VIP can start another game.'),
  );
}

// Moves that lock something in get a stamp and a buzz; small taps (tiles, peeks, ticks) don't.
const LOCK_INS = new Set(['accuse', 'answer', 'call', 'draw', 'fake', 'guess', 'judge', 'pick', 'ready', 'reply', 'say', 'sing', 'vote', 'word', 'step', 'chorus', 'echo']);

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
