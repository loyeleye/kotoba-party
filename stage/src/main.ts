// The debug stage: the shared screen for Phase 0. It shows the room code and QR, the
// round as the server sees it, and a debug panel to drive and inspect the room.

import { RoomClient, createRoom, type ConnectionStatus } from '../../shared/src/client.js';
import { PHASE_LABELS, formatSeconds, h, mount } from '../../shared/src/dom.js';
import type { CreateRoomResponse, RoomView } from '../../shared/src/protocol.js';

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
  els.phase.textContent = PHASE_LABELS[view.phase] ?? view.phase;
  els.round.textContent = view.round ? `Round ${view.round} / ${view.totalRounds}` : '';
  els.version.textContent = `v${v} · phase #${view.phaseSeq} · stale dropped ${client?.staleDropped ?? 0}`;
  els.start.disabled = view.phase !== 'lobby' || view.players.length === 0;
  els.skip.disabled = view.deadline === null;
  els.again.disabled = view.phase !== 'recap';
  if (!els.raw.hidden) els.raw.textContent = JSON.stringify(view, null, 2);

  mount(
    els.players,
    view.players.map((p) =>
      h(
        'li',
        { class: `player ${p.connected ? 'online' : 'offline'}` },
        h('span', { class: 'seat' }, p.seat),
        h('span', { class: 'name' }, p.name, p.isVip ? h('span', { class: 'vip', title: 'VIP' }, ' ★') : null),
        h('span', { class: 'ticks' }, p.answered ? '✎' : '', p.voted ? '✓' : ''),
        h('span', { class: 'score' }, p.score),
        p.connected ? null : h('span', { class: 'dropped' }, 'reconnecting…'),
      ),
    ),
  );
  mount(els.main, mainFor(view));
  tick();
}

function mainFor(view: RoomView): HTMLElement {
  switch (view.phase) {
    case 'lobby':
      return h(
        'div',
        { class: 'lobby' },
        h('p', { class: 'big' }, view.players.length ? 'Waiting for the VIP to start' : 'Scan the code to join'),
        h('p', { class: 'hint' }, `${view.players.length} / 8 players`),
      );
    case 'intro':
      return h('div', { class: 'card' }, h('p', { class: 'big' }, 'こんばんは! Welcome to Kotoba Party'), h('p', { class: 'hint' }, 'Debug intro: a host segment goes here in Phase 1.'));
    case 'prompt':
    case 'answer':
      return h(
        'div',
        { class: 'card' },
        h('p', { class: 'prompt' }, view.prompt?.text ?? ''),
        view.prompt?.subtitle ? h('p', { class: 'subtitle', lang: 'ja' }, view.prompt.subtitle) : null,
        view.phase === 'answer'
          ? h('p', { class: 'hint' }, `${view.players.filter((p) => p.answered).length} / ${view.players.length} answers in`)
          : null,
      );
    case 'reveal':
      return h(
        'div',
        { class: 'card' },
        h('p', { class: 'prompt small' }, view.prompt?.text ?? ''),
        h('ol', { class: 'answers' }, view.reveal.map((a) => h('li', {}, a.text))),
        h('p', { class: 'hint' }, `${view.players.filter((p) => p.voted).length} votes in`),
      );
    case 'encore':
    case 'score': {
      const answers = [...(view.results?.answers ?? [])].sort((a, b) => b.votes - a.votes);
      return h(
        'div',
        { class: 'card' },
        h('p', { class: 'prompt small' }, view.prompt?.text ?? ''),
        h(
          'ol',
          { class: 'answers results' },
          answers.map((a, i) =>
            h(
              'li',
              { class: a.ippon ? 'ippon' : i === 0 && a.votes > 0 ? 'winner' : '' },
              h('span', { class: 'text' }, a.text),
              h('span', { class: 'by' }, `${a.authorName} · ${a.votes} vote${a.votes === 1 ? '' : 's'} · +${a.points}`),
              a.ippon ? h('span', { class: 'badge' }, 'IPPON!') : null,
            ),
          ),
        ),
        view.phase === 'encore' && answers[0]?.votes ? h('p', { class: 'hint' }, `Encore: ${answers[0].authorName}, say it out loud!`) : null,
      );
    }
    case 'recap':
      return h(
        'div',
        { class: 'card' },
        h('p', { class: 'big' }, 'お疲れさま! Final scores'),
        h('ol', { class: 'standings' }, view.standings.map((s) => h('li', {}, h('span', {}, s.name), h('span', {}, s.score)))),
      );
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

els.start.addEventListener('click', () => void command({ type: 'start', rounds: Number(els.rounds.value) || 3 }));
els.skip.addEventListener('click', () => client?.view && void command({ type: 'skip', phaseSeq: client.view.phaseSeq }));
els.again.addEventListener('click', () => void command({ type: 'playAgain' }));
els.newRoom.addEventListener('click', () => void openRoom(true));
els.toggleRaw.addEventListener('click', () => {
  els.raw.hidden = !els.raw.hidden;
  if (!els.raw.hidden && client?.view) els.raw.textContent = JSON.stringify(client.view, null, 2);
});

setInterval(tick, 200);
void openRoom(false);
