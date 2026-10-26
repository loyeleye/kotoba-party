// The debug stage: the shared screen for Phase 0. It shows the room code and QR, the
// round as the server sees it, and a debug panel to drive and inspect the room.

import { RoomClient, createRoom, type ConnectionStatus } from '../../shared/src/client.js';
import { HOST_NAMES, LEVEL_LABELS, PHASE_LABELS, formatSeconds, h, mount } from '../../shared/src/dom.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { CreateRoomResponse, ModeId, RoomView } from '../../shared/src/protocol.js';
import { STAGE_MODES } from './modes/index.js';

const MENU_ALL = Object.values(MODES).map((m) => m.info);

const SESSION_KEY = 'kotoba:stage';
const base = location.origin;

const $ = (id: string) => document.getElementById(id)!;
const els = {
  code: $('code'),
  qr: $('qr') as HTMLImageElement,
  joinUrl: $('join-url'),
  phase: $('phase'),
  round: $('round'),
  timer: $('timer'),
  main: $('main'),
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

  const stageMode = view.game ? STAGE_MODES[view.game.mode] : null;
  mount(
    els.players,
    view.players.map((p) =>
      h(
        'li',
        { class: `player ${p.connected ? 'online' : 'offline'}` },
        h('span', { class: 'seat' }, p.seat),
        h('span', { class: 'name' }, p.name, p.isVip ? h('span', { class: 'vip', title: 'VIP' }, ' ★') : null),
        h('span', { class: 'ticks' }, (view.game && stageMode?.badge?.(view.game, p.id)) || h('span', { class: 'level' }, LEVEL_LABELS[p.level])),
        h('span', { class: 'score' }, p.score),
        p.connected ? null : h('span', { class: 'dropped' }, 'reconnecting…'),
      ),
    ),
  );
  mount(els.main, mainFor(view));
  tick();
}

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
  if (view.phase === 'recap' || !view.game) {
    const recap = view.recap;
    return h(
      'div',
      { class: 'card' },
      h('p', { class: 'big' }, 'お疲れさま! Final scores'),
      h('ol', { class: 'standings' }, (recap?.standings ?? []).map((s) => h('li', {}, h('span', {}, s.name), h('span', {}, s.score)))),
      recap?.awards.length
        ? h('ul', { class: 'awards' }, recap.awards.map((a) => h('li', {}, h('strong', {}, a.title), ` ${a.en} · ${a.name}`)))
        : null,
    );
  }
  return STAGE_MODES[view.game.mode].render(view, view.game);
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
function showHost(view: RoomView): void {
  const say = view.host;
  els.host.hidden = !say;
  if (!say) return;
  const key = `${say.phaseSeq}:${say.text}`;
  if (key === lastHostKey) return;
  lastHostKey = key;
  const portrait = h('img', { class: 'host-portrait', src: `/stage/assets/hosts/${say.host}.png`, alt: '' }) as HTMLImageElement;
  portrait.onerror = () => portrait.remove();
  mount(els.host, portrait, h('span', { class: 'host-name' }, HOST_NAMES[say.host] ?? say.host), h('span', { class: 'host-jp', lang: 'ja' }, say.text), h('span', { class: 'host-en' }, say.en));
  if (say.audioUrl) {
    const audio = new Audio(say.audioUrl);
    void audio.play().catch(() => {});
  }
}

function tick(): void {
  els.timer.textContent = formatSeconds(client?.remainingMs() ?? null);
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
