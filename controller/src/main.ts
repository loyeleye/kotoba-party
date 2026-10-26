// The phone controller: join with the room code, then answer and vote.
// Everything on screen comes from the server's latest view; the phone only sends intents.

import { RoomClient, joinRoom, type ConnectionStatus } from '../../shared/src/client.js';
import { formatSeconds, h, mount } from '../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH, MAX_NAME_LENGTH } from '../../shared/src/constants.js';
import type { JoinError, RoomView } from '../../shared/src/protocol.js';
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
    res = await joinRoom(base, code, { name, deviceId: deviceId(), token: saved?.code === code ? saved.token : undefined });
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
  const me = view.players.find((p) => p.id === session?.playerId);
  const key = [
    view.phase,
    view.phaseSeq,
    view.me?.answerId,
    view.me?.votedFor,
    me?.isVip,
    view.phase === 'lobby' ? view.players.map((p) => p.name).join() : '',
  ].join('|');
  if (key === screenKey) return;
  screenKey = key;

  const header = h(
    'div',
    { class: 'me' },
    h('span', {}, `${me?.name ?? session?.name} · seat ${me?.seat ?? '?'}`),
    me?.isVip ? h('span', { class: 'vip' }, '★ VIP') : null,
    h('span', { class: 'score' }, `${me?.score ?? 0} pts`),
  );
  mount(app, header, screenFor(view, !!me?.isVip));
}

function screenFor(view: RoomView, isVip: boolean): HTMLElement {
  switch (view.phase) {
    case 'lobby':
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, 'You are in!'),
        h('p', {}, `${view.players.length} player${view.players.length === 1 ? '' : 's'}: ${view.players.map((p) => p.name).join(', ')}`),
        isVip ? vipStart() : h('p', { class: 'hint' }, 'Waiting for the VIP to start.'),
      );
    case 'intro':
    case 'prompt':
      return h('div', { class: 'screen' }, h('p', { class: 'big' }, 'Look at the screen!'), view.prompt ? h('p', { class: 'prompt' }, view.prompt.text) : null);
    case 'answer':
      return view.me?.answerText ? waiting(`Sent: “${view.me.answerText}”`, 'Waiting for the others…') : answerForm(view);
    case 'reveal':
      return voteList(view);
    case 'encore':
    case 'score': {
      const mine = view.results?.answers.find((a) => a.authorId === session?.playerId);
      return waiting(mine ? `+${mine.points}${mine.ippon ? ' · IPPON!' : ''}` : 'No answer this round', mine ? `${mine.votes} vote${mine.votes === 1 ? '' : 's'} for “${mine.text}”` : '');
    }
    case 'recap': {
      const place = view.standings.findIndex((s) => s.playerId === session?.playerId) + 1;
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, place ? `#${place}` : 'Game over'),
        h('ol', { class: 'standings' }, view.standings.map((s) => h('li', {}, `${s.name} · ${s.score}`))),
        isVip ? h('button', { class: 'primary', onclick: () => void send({ type: 'playAgain' }) }, 'Play again') : h('p', { class: 'hint' }, 'The VIP can start another game.'),
      );
    }
  }
}

function vipStart(): HTMLElement {
  const rounds = h('select', { id: 'rounds' }, [3, 5, 8].map((n) => h('option', { value: n }, `${n} rounds`))) as HTMLSelectElement;
  return h(
    'div',
    { class: 'vip-start' },
    rounds,
    h('button', { class: 'primary', onclick: () => void send({ type: 'start', rounds: Number(rounds.value) }) }, 'Everybody is in: start'),
  );
}

function answerForm(view: RoomView): HTMLElement {
  const input = h('input', { maxlength: MAX_ANSWER_LENGTH, placeholder: 'Your answer', enterkeyhint: 'send', lang: 'ja' }) as HTMLInputElement;
  const form = h(
    'form',
    {
      class: 'screen',
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (input.value.trim()) void send({ type: 'answer', text: input.value });
      },
    },
    h('p', { class: 'prompt' }, view.prompt?.text ?? ''),
    view.prompt?.subtitle ? h('p', { class: 'subtitle', lang: 'ja' }, view.prompt.subtitle) : null,
    input,
    h('button', { class: 'primary', type: 'submit' }, 'Send'),
  );
  queueMicrotask(() => input.focus());
  return form;
}

function voteList(view: RoomView): HTMLElement {
  if (view.me?.votedFor) return waiting('Vote in!', 'Waiting for the others…');
  const options = view.reveal.filter((a) => a.id !== view.me?.answerId);
  if (options.length === 0) return waiting('Nothing to vote for', '');
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'hint' }, 'Vote for the funniest:'),
    options.map((a) => h('button', { class: 'option', onclick: () => void send({ type: 'vote', answerId: a.id }) }, a.text)),
  );
}

function waiting(title: string, sub: string): HTMLElement {
  return h('div', { class: 'screen' }, h('p', { class: 'big' }, title), sub ? h('p', { class: 'hint' }, sub) : null);
}

async function send(body: Parameters<RoomClient['send']>[0]): Promise<void> {
  if (!client) return;
  try {
    const result = await client.send(body);
    if (!result.ok && result.error !== 'wrong-phase') flash(result.error);
  } catch {
    flash('Network trouble. Try again.');
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

setInterval(() => {
  timerEl.textContent = formatSeconds(client?.remainingMs() ?? null);
}, 250);

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
