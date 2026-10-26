// The stage: the shared TV screen. It shows the room code and QR, the host, the round as the
// server sees it and the score ribbon, on a fixed 1920×1080 canvas scaled to the window.
// With ?debug=1 a developer panel to drive and inspect the room floats over it.

import { RoomClient, createRoom, type ConnectionStatus } from '../../shared/src/client.js';
import { HOST_NAMES, LEVEL_LABELS, PHASE_LABELS, formatSeconds, h, mount, patch, placesOf, ruby } from '../../shared/src/dom.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { CreateRoomResponse, ModeId, RoomView } from '../../shared/src/protocol.js';
import { STAGE_MODES } from './modes/index.js';
import { HOSTS } from '../../server/ai/hosts.js';
import { duckFor, mountSoundButton, updateMusic } from './music/index.js';
import { creditSummary } from './music/tracks.js';

const MENU_ALL = Object.values(MODES).map((m) => m.info);

const SESSION_KEY = 'kotoba:stage';
const base = location.origin;
const DEBUG = new URLSearchParams(location.search).has('debug');

const $ = (id: string) => document.getElementById(id)!;
const els = {
  code: $('code'),
  qr: $('qr') as HTMLImageElement,
  joinUrl: $('join-url'),
  phase: $('phase'),
  round: $('round'),
  timer: $('timer'),
  main: $('main'),
  fit: $('fit'),
  canvas: $('canvas'),
  players: $('players'),
  status: $('status'),
  version: $('version'),
  log: $('log'),
  raw: $('raw'),
  rounds: $('rounds') as HTMLInputElement,
  mode: $('mode') as HTMLSelectElement,
  pack: $('pack') as HTMLSelectElement,
  host: $('host'),
  start: $('btn-start') as HTMLButtonElement,
  skip: $('btn-skip') as HTMLButtonElement,
  again: $('btn-again') as HTMLButtonElement,
  newRoom: $('btn-new') as HTMLButtonElement,
  toggleRaw: $('btn-raw') as HTMLButtonElement,
};

let client: RoomClient | null = null;
let lastPhaseSeq = -1;
const logLines: string[] = [];

$('debug').hidden = !DEBUG;
mountSoundButton(els.canvas);
$('debug-tag').hidden = !DEBUG;

// ---- the 1080p canvas, scaled to the window ----
function scaleCanvas(): void {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  els.canvas.style.setProperty('--scale', String(scale));
}
window.addEventListener('resize', scaleCanvas);
scaleCanvas();

/** Shrinks the play area's content when it is taller or wider than the space it has. */
function fitMain(): void {
  const room = els.main.clientHeight;
  const need = els.fit.scrollHeight;
  const wide = els.fit.scrollWidth / Math.max(1, els.main.clientWidth);
  const scale = Math.min(1, room / Math.max(1, need), 1 / Math.max(1, wide));
  els.fit.style.transform = scale < 0.999 ? `scale(${scale.toFixed(3)})` : '';
}
if (typeof ResizeObserver !== 'undefined') {
  const watch = new ResizeObserver(() => fitMain());
  watch.observe(els.fit);
  watch.observe(els.main);
}

function log(line: string): void {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  logLines.unshift(`${time}  ${line}`);
  logLines.length = Math.min(logLines.length, 40);
  els.log.textContent = logLines.join('\n');
}

async function openRoom(fresh: boolean): Promise<void> {
  client?.close();
  let session: CreateRoomResponse | null = null;
  if (!fresh) {
    try {
      session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as CreateRoomResponse | null;
    } catch {
      session = null;
    }
    if (session) {
      const alive = await fetch(`${base}/api/rooms/${session.code}`).then((r) => r.ok, () => false);
      if (!alive) session = null;
    }
  }
  if (!session) {
    session = await createRoom(base);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // private mode: the room just won't survive a reload
    }
    log(`created room ${session.code}`);
  } else {
    log(`resumed room ${session.code}`);
  }

  els.code.textContent = session.code;
  els.qr.src = `${base}/api/rooms/${session.code}/qr.svg`;
  els.joinUrl.textContent = session.joinUrl.replace(/^https?:\/\//, '');
  lastPhaseSeq = -1;

  client = new RoomClient({
    baseUrl: base,
    code: session.code,
    token: session.stageToken,
    onState: render,
    onStatus: (status: ConnectionStatus) => {
      els.status.textContent = status;
      els.status.dataset.status = status;
      log(`connection: ${status}`);
      if (status === 'room-gone' || status === 'seat-lost') void openRoom(true);
    },
  });
  client.connect();
}

function render(view: RoomView, v: number): void {
  if (view.phaseSeq !== lastPhaseSeq) {
    log(`v${v} → ${view.phase}${view.round ? ` (round ${view.round}/${view.totalRounds})` : ''}`);
    lastPhaseSeq = view.phaseSeq;
  }
  document.body.dataset.phase = view.phase;
  document.body.dataset.mode = view.mode ?? '';
  const modeInfo = view.mode ? MENU_ALL.find((m) => m.id === view.mode) : undefined;
  els.phase.textContent = view.phase === 'lobby' ? 'Lobby' : view.phase === 'recap' ? 'Recap' : `${modeInfo?.title ?? ''} · ${modeInfo?.phaseLabels?.[view.phase] ?? PHASE_LABELS[view.phase] ?? view.phase}`;
  els.round.textContent = view.round ? `Round ${view.round} / ${view.totalRounds}` : '';
  els.version.textContent = `v${v} · phase #${view.phaseSeq} · stale dropped ${client?.staleDropped ?? 0}`;
  els.start.disabled = view.phase !== 'lobby' || view.players.length === 0;
  els.skip.disabled = view.deadline === null;
  els.again.disabled = view.phase !== 'recap';
  if (!els.raw.hidden) els.raw.textContent = JSON.stringify(view, null, 2);
  fillMenus(view);
  showHost(view);
  updateMusic(view);

  const stageMode = view.game ? STAGE_MODES[view.game.mode] : null;
  // Patched, not rebuilt: chips keep their place and a score that went up gets a fresh
  // element (keyed by the score), so its pop plays once.
  patch(
    els.players,
    view.players.map((p) => {
      const up = (seenScores.get(p.id) ?? p.score) < p.score;
      seenScores.set(p.id, p.score);
      return h(
        'li',
        { class: `player ${p.connected ? 'online' : 'offline'}`, 'data-key': p.id },
        h('span', { class: 'seat' }, p.seat),
        h('span', { class: 'name' }, p.name, p.isVip ? h('span', { class: 'vip', title: 'VIP' }, ' ★') : null),
        h('span', { class: 'ticks' }, (view.game && stageMode?.badge?.(view.game, p.id)) || h('span', { class: 'level' }, LEVEL_LABELS[p.level])),
        h('span', { class: `score${up ? ' up' : ''}`, 'data-key': `${p.score}` }, p.score),
        p.connected ? null : h('span', { class: 'dropped' }, 'reconnecting…'),
      );
    }),
  );
  // One scene per phase: a new phase builds fresh elements (and its entrance animations), an
  // update inside a phase patches the ones on screen so transitions and animations carry on.
  patch(els.fit, h('div', { class: 'scene', 'data-key': `${view.phaseSeq}` }, mainFor(view)));
  fitMain();
  tick();
}

const seenScores = new Map<string, number>();

function mainFor(view: RoomView): HTMLElement {
  if (view.phase === 'lobby') {
    return h(
      'div',
      { class: 'lobby' },
      h('p', { class: 'big' }, view.players.length ? 'Waiting for the VIP to pick a game' : 'Scan the code to join'),
      h('p', { class: 'hint' }, `${view.players.length} / 8 players`),
      h('ul', { class: 'menu' }, view.modes.map((m) => h('li', {}, h('strong', {}, m.title), ` ${m.titleJa} · `, m.blurb))),
    );
  }
  if (view.phase === 'recap' || !view.game) return recapScreen(view);
  return STAGE_MODES[view.game.mode].render(view, view.game);
}

/** Tonight's results: a podium for the top three (third rises first), award cards, everyone else. */
function recapScreen(view: RoomView): HTMLElement {
  const standings = view.recap?.standings ?? [];
  const places = placesOf(standings.map((s) => s.score));
  const top = standings.slice(0, 3);
  const rest = standings.slice(3);
  const tied = (i: number) => places.filter((p) => p === places[i]).length > 1;
  return h(
    'div',
    { class: 'recap' },
    h('p', { class: 'recap-title' }, ruby({ text: 'お疲れさま！', furigana: [['お', ''], ['疲', 'つか'], ['れさま！', '']] }), "Tonight's results"),
    h(
      'div',
      { class: 'podium' },
      top.map((s, i) =>
        h(
          'div',
          { class: `step p${i + 1}${tied(i) ? ' tied' : ''}` },
          places[i] === 1 ? h('span', { class: 'crown', 'aria-hidden': 'true' }, '👑') : null,
          h('span', { class: 'who' }, s.name),
          h('span', { class: 'pts' }, `${s.score} pts`),
          h('span', { class: 'block' }, String(places[i])),
        ),
      ),
    ),
    rest.length ? h('p', { class: 'rest' }, rest.flatMap((s, i) => [i ? ' · ' : '', h('strong', {}, `${places[i + 3]}. ${s.name}`), ` ${s.score}`])) : null,
    view.recap?.awards.length
      ? h(
          'ul',
          { class: 'awards' },
          view.recap.awards.map((a, i) =>
            h('li', { class: 'award-card', style: `animation-delay:${3200 + i * 500}ms` }, h('span', { class: 'a-ja', lang: 'ja' }, a.title), h('span', { class: 'a-en' }, a.en), h('span', { class: 'a-who' }, a.name)),
          ),
        )
      : null,
    credits(),
  );
}

/** The music and voice credits their licences ask for, small at the foot of the recap. */
function credits(): HTMLElement {
  const voices = [...new Set(Object.values(HOSTS).map((x) => x.credit))];
  return h('ul', { class: 'credits', 'aria-label': 'Credits' }, [...creditSummary(), `Host voices: ${voices.join(' · ')}`].map((c) => h('li', {}, `♪ ${c}`)));
}

function fillMenus(view: RoomView): void {
  if (view.phase !== 'lobby') return;
  const modes = [...view.modes, ...MENU_ALL.filter((m) => m.id === 'debug')];
  const modeKey = modes.map((m) => m.id).join();
  if (els.mode.dataset.key !== modeKey) {
    els.mode.dataset.key = modeKey;
    mount(els.mode, modes.map((m) => h('option', { value: m.id }, m.title)));
  }
  const packKey = view.packs.map((p) => p.id).join();
  if (els.pack.dataset.key !== packKey) {
    els.pack.dataset.key = packKey;
    mount(els.pack, h('option', { value: '' }, 'any pack'), view.packs.map((p) => h('option', { value: p.id }, p.title)));
  }
}

let lastHostKey = '';
let hostAudio: HTMLAudioElement | null = null;
function showHost(view: RoomView): void {
  const say = view.host;
  els.host.hidden = !say;
  if (!say) return;
  const key = `${say.phaseSeq}:${say.text}`;
  if (key === lastHostKey) return;
  lastHostKey = key;
  const portrait = h('img', { class: 'host-portrait', src: `/stage/assets/hosts/${say.host}.png`, alt: '' }) as HTMLImageElement;
  portrait.onerror = () => portrait.remove();
  mount(
    els.host,
    portrait,
    h('div', { class: 'host-bubble' }, h('span', { class: 'host-name', lang: 'ja' }, HOST_NAMES[say.host] ?? say.host), h('span', { class: 'host-jp', lang: 'ja' }, say.text), h('span', { class: 'host-en' }, say.en)),
  );
  // A new line cuts off the last one, so two never talk over each other.
  hostAudio?.pause();
  hostAudio = null;
  if (say.audioUrl) {
    const audio = new Audio(say.audioUrl);
    hostAudio = audio;
    duckFor(audio);
    void audio.play().catch(() => {});
  }
}

function tick(): void {
  const left = client?.remainingMs() ?? null;
  const text = formatSeconds(left);
  if (els.timer.textContent !== text) els.timer.textContent = text;
  els.timer.classList.toggle('urgent', left !== null && left > 0 && left <= 5_000);
}

async function command(body: Parameters<RoomClient['send']>[0]): Promise<void> {
  if (!client) return;
  const result = await client.send(body);
  log(`${body.type}: ${result.ok ? 'ok' : result.error}`);
}

els.start.addEventListener('click', () =>
  void command({
    type: 'start',
    mode: els.mode.value as ModeId,
    rounds: Number(els.rounds.value) || undefined,
    packId: els.pack.value || undefined,
  }),
);
els.skip.addEventListener('click', () => client?.view && void command({ type: 'skip', phaseSeq: client.view.phaseSeq }));
els.again.addEventListener('click', () => void command({ type: 'playAgain' }));
els.newRoom.addEventListener('click', () => void openRoom(true));
els.toggleRaw.addEventListener('click', () => {
  els.raw.hidden = !els.raw.hidden;
  if (!els.raw.hidden && client?.view) els.raw.textContent = JSON.stringify(client.view, null, 2);
});

setInterval(tick, 200);
void openRoom(false);
