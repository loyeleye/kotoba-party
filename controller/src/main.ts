// The phone controller: join with the room code, then answer and vote.
// Everything on screen comes from the server's latest view; the phone only sends intents.

import { RoomClient, joinRoom, type CommandBody, type ConnectionStatus } from '../../shared/src/client.js';
import { LEVEL_LABELS, formatSeconds, h, mount } from '../../shared/src/dom.js';
import { MAX_NAME_LENGTH } from '../../shared/src/constants.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { LEVELS, type JoinError, type Level, type PlayerView, type RoomView } from '../../shared/src/protocol.js';
import { PHONE_MODES } from './modes/index.js';
import { setSpeakLevel, speakBox } from './components/speak.js';

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
};

let lastView: RoomView | null = null;
import { isRoomCode, normalizeRoomCode } from '../../shared/src/roomCode.js';

interface Session {
  code: string;
  token: string;
  playerId: string;
  name: string;
}

const base = location.origin;
const app = document.getElementById('app')!;
const banner = document.getElementById('banner')!;
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
  start({ code, token: res.token, playerId: res.playerId, name });
  return null;
}

function start(s: Session): void {
  session = s;
  store('kotoba:session', s);
  history.replaceState(null, '', `/?code=${s.code}`);
  client = new RoomClient({ baseUrl: base, code: s.code, token: s.token, onState: render, onStatus: status });
  client.connect();
  void keepAwake();
  mount(app, h('p', { class: 'center' }, 'Connecting…'));
}

function status(st: ConnectionStatus): void {
  banner.hidden = st === 'open' || st === 'connecting';
  banner.textContent = st === 'reconnecting' ? 'Reconnecting… your seat is saved' : st;
  if (st === 'seat-lost') {
    store('kotoba:session', null);
    showJoin('You were away too long, so your seat was given up. Join again.');
  } else if (st === 'room-gone') {
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

  const header = h(
    'div',
    { class: 'me' },
    h('span', {}, `${me.name} · seat ${me.seat} · ${LEVEL_LABELS[me.level]}`),
    isVip ? h('span', { class: 'vip' }, '★ VIP') : null,
    h('span', { class: 'score' }, `${me.score} pts`),
  );
  mount(app, header, screenFor(view, me, isVip));
}

function screenFor(view: RoomView, me: PlayerView, isVip: boolean): HTMLElement {
  if (view.phase === 'lobby') return lobby(view, me, isVip);
  if (view.phase === 'recap' || !view.game) return recap(view, isVip);
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
  else parts.push(h('p', { class: 'hint' }, 'Waiting for the VIP to pick a game.'));
  return h('div', { class: 'screen' }, parts);
}

function micCheck(me: PlayerView): HTMLElement {
  if (me.mic === 'ok') return h('p', { class: 'mic ok' }, '🎤 Mic check passed. よろしく!');
  if (me.mic === 'quiet') return h('p', { class: 'mic' }, '⌨️ Quiet mode: you’ll tap and type. (You can still talk any time.)');
  return h(
    'div',
    { class: 'mic-check' },
    h('p', { class: 'hint' }, 'Mic check: hold the button and say'),
    h('p', { class: 'big', lang: 'ja' }, 'こんにちは!'),
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
  return h('div', { class: 'vip-start' }, h('p', { class: 'hint' }, 'Pick tonight’s game:'), modeButtons, packSelect, roundsSelect, note, startBtn);
}

function recap(view: RoomView, isVip: boolean): HTMLElement {
  const r = view.recap;
  const place = (r?.standings.findIndex((s) => s.playerId === session?.playerId) ?? -1) + 1;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, place ? `#${place}` : 'Game over'),
    h('ol', { class: 'standings' }, (r?.standings ?? []).map((s) => h('li', {}, `${s.name} · ${s.score}`))),
    r?.awards.filter((a) => a.playerId === session?.playerId).map((a) => h('p', { class: 'award' }, `🏆 ${a.title} · ${a.en}`)),
    r?.phrasebook.length
      ? h(
          'details',
          { class: 'phrasebook', open: true },
          h('summary', {}, `${(view.mode && MODES[view.mode].info.phrasebookTitle) || 'Tonight’s phrasebook'} (${r.phrasebook.length})`),
          h(
            'ul',
            {},
            r.phrasebook.map((e) =>
              h('li', { class: `pb-${e.outcome}` }, h('span', { lang: 'ja' }, e.text), e.kana !== e.text ? h('small', { lang: 'ja' }, ` ${e.kana}`) : null, h('small', {}, ` · ${e.en}`)),
            ),
          ),
        )
      : null,
    isVip ? h('button', { class: 'primary', onclick: () => void command({ type: 'playAgain' }) }, 'Back to the menu') : h('p', { class: 'hint' }, 'The VIP can start another game.'),
  );
}

async function play(move: unknown): Promise<boolean> {
  return command({ type: 'play', move });
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

function flash(text: string): void {
  banner.hidden = false;
  banner.textContent = text;
  setTimeout(() => {
    if (client?.status === 'open') banner.hidden = true;
  }, 2500);
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
    .then((res) => ('error' in res ? showJoin() : start({ ...saved, token: res.token, playerId: res.playerId })))
    .catch(() => showJoin());
} else {
  showJoin();
}
