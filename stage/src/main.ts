// The stage: the shared TV screen. It shows the room code and QR, the host, the round as the
// server sees it and the score ribbon, on a fixed 1920×1080 canvas scaled to the window.
// With ?debug=1 a developer panel to drive and inspect the room floats over it.
// With ?code=XXXX it is another screen on a room that is already open (a remote player's laptop):
// the same view, its own music and host voice, but no say over the game.

import { RoomClient, createRoom, watchRoom, type ConnectionStatus } from '../../shared/src/client.js';
import { HOST_NAMES, LEVEL_LABELS, PHASE_LABELS, formatSeconds, h, mount, patch, placesOf, ruby, hasReading, awardTitle, seatShape } from '../../shared/src/dom.js';
import { icon } from '../../shared/src/art.js';
import { isRoomCode, normalizeRoomCode } from '../../shared/src/roomCode.js';
import { ROOM_STALE_MS } from '../../shared/src/constants.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';
import type { ByeReason, CreateRoomResponse, HostSay, ModeId, RecapView, RoomView } from '../../shared/src/protocol.js';
import { STAGE_MODES } from './modes/index.js';
import { HOSTS } from '../../server/ai/hosts.js';
import { duckFor, mountSoundButton, updateMusic } from './music/index.js';
import { creditSummary } from './music/tracks.js';
import { isMuted } from './sound.js';
import { canSpeakHost, speakHost, stopHostSpeech } from './hostSpeech.js';
import { joinAudioTabs } from '../../shared/src/audioTabs.js';
import { BOSS_DEFEAT, HostSprite, calm, hitSheet, preload } from './sprites.js';
import { mountSettings, updateSettings } from './settings.js';
import { tickSfx, watchSfx } from './music/sfx.js';
import { setClipSource } from './modes/dubAudio.js';
import { invite, inviteLinks } from '../../shared/src/share.js';
import { mountBackdrop, updateBackdrop } from './backdrop.js';
import { isDanmakuOn, onDanmakuToggle, startDanmaku, stopDanmaku } from './danmaku.js';

const MENU_ALL = Object.values(MODES).map((m) => m.info);

const SESSION_KEY = 'kotoba:stage';
const base = location.origin;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
/** The room this screen watches, from ?code=; null for the main stage, which opens its own room. */
const WATCH = ((code) => (isRoomCode(code) ? code : null))(normalizeRoomCode(params.get('code') ?? ''));
const WATCH_KEY = 'kotoba:stage:watch';

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
/** Where people open this room's pages, as the server names it (its public URL, not this tab's). */
let siteOrigin = location.origin;
let lastPhaseSeq = -1;
let lastPhase: RoomView['phase'] | null = null;
/** The phase's full length, as first seen: the ring timer's 100%. */
let phaseTotal: number | null = null;
const logLines: string[] = [];

// Every sprite the stage can show, fetched and decoded up front so nothing pops in half-drawn.
const HOST_IDS = Object.keys(HOST_NAMES);
preload([
  ...HOST_IDS.map((host) => `/stage/assets/hosts/${host}.png`),
  ...HostSprite.sheets(HOST_IDS),
  ...['blob', 'lantern', 'umbrella', 'scroll'].flatMap((y) => [`/stage/assets/yokai/yokai-${y}.png`, hitSheet(`yokai-${y}`).src]),
  '/stage/assets/yokai/yokai-boss.png',
  BOSS_DEFEAT.src,
]);
// The host sprite: stays on screen across lines.
/** The host sprite's size on the 1080p canvas before it is snapped to whole screen pixels. */
const HOST_TARGET = 192;
const hostSprite = new HostSprite(HOST_TARGET);

$('debug').hidden = !DEBUG;
mountBackdrop(els.canvas, () => client?.remainingMs() ?? null);
mountSoundButton(els.canvas);
mountSettings(els.canvas, { watch: !!WATCH, send: (body) => command(body), site: () => siteOrigin });
$('debug-tag').hidden = !DEBUG;
document.body.dataset.watch = WATCH ? '1' : '';
if (WATCH) {
  for (const b of [els.start, els.skip, els.again]) b.hidden = true;
  els.newRoom.textContent = 'Open my own room';
}

// ---- the 1080p canvas, scaled to the window ----
function scaleCanvas(): void {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  els.canvas.style.setProperty('--scale', String(scale));
  // The 128px host sprites draw at a whole multiple of their pixels on the real screen (1× at 720p,
  // 2× at 1080p, 3× at 4K), so no pixel row gets dropped or doubled: 192 to 256 canvas px.
  const k = Math.max(1, Math.round((HOST_TARGET * scale) / 128));
  const size = (128 * k) / scale;
  els.canvas.style.setProperty('--host-size', `${size}px`);
  hostSprite.resize(size);
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

/** A full-screen message instead of the game: a watched room that is gone, or out of screens. */
function showNotice(title: string, detail: string): void {
  client?.close();
  client = null;
  document.body.dataset.phase = 'lobby';
  document.body.dataset.notice = '1';
  els.host.hidden = true;
  stopDanmaku();
  mount(els.players);
  patch(
    els.fit,
    h(
      'div',
      { class: 'lobby notice', 'data-key': 'notice' },
      h('p', { class: 'big' }, title),
      h('p', { class: 'hint' }, detail),
      h('p', { class: 'hint' }, h('a', { href: '/stage/' }, 'Open a new room on this screen')),
    ),
  );
  fitMain();
}

/** Another screen on the room in ?code=: asks the room for a watch token (or reuses this tab's). */
async function watchOpenRoom(fresh: boolean): Promise<CreateRoomResponse | null> {
  const code = WATCH!;
  let session: CreateRoomResponse | null = null;
  if (!fresh) {
    try {
      session = JSON.parse(sessionStorage.getItem(WATCH_KEY) ?? 'null') as CreateRoomResponse | null;
    } catch {
      session = null;
    }
    if (session?.code !== code) session = null;
  }
  if (session) {
    log(`watching room ${code} again`);
    return session;
  }
  const result = await watchRoom(base, code).catch(() => ({ error: 'room-not-found' as const }));
  if ('error' in result) {
    log(`watch ${code}: ${result.error}`);
    if (result.error === 'too-many-screens') showNotice(`Room ${code} has all the screens it can take`, 'Close a stage screen somewhere else, then reload this page.');
    else showNotice(`Room ${code} isn't open`, 'Check the code on the main screen, or ask whoever started the game to share their stage link.');
    return null;
  }
  try {
    sessionStorage.setItem(WATCH_KEY, JSON.stringify(result));
  } catch {
    // private mode: a reload just asks again
  }
  log(`watching room ${code}`);
  return result;
}

async function openRoom(fresh: boolean): Promise<void> {
  client?.close();
  let session: CreateRoomResponse | null = null;
  if (WATCH) {
    session = await watchOpenRoom(fresh);
    if (!session) return;
  }
  if (!fresh && !session) {
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
  joinAudioTabs('stage', session.code);
  els.qr.src = `${base}/api/rooms/${session.code}/qr.svg`;
  els.joinUrl.textContent = session.joinUrl.replace(/^https?:\/\//, '');
  siteOrigin = (() => {
    try {
      return new URL(session.joinUrl).origin;
    } catch {
      return location.origin;
    }
  })();
  lastPhaseSeq = -1;

  const code = session.code;
  let closedAs: ByeReason | null = null;
  client = new RoomClient({
    baseUrl: base,
    code,
    token: session.stageToken,
    onState: render,
    onBye: (reason) => (closedAs = reason),
    onStatus: (status: ConnectionStatus) => {
      els.status.textContent = status;
      els.status.dataset.status = status;
      log(`connection: ${status}`);
      // A watching screen never opens a room of its own: when the room ends, it says so.
      if (WATCH && status === 'room-gone') showNotice(`Room ${WATCH} has closed`, 'The game on the main screen ended or was left idle.');
      // Closed because nobody played for a long while: opening another room would just keep a forgotten TV busy.
      else if (status === 'room-gone' && closedAs === 'room-idle') showNotice(`Room ${code} has closed`, `Nobody played for ${ROOM_STALE_MS / 60_000} minutes.`);
      // Closed from Settings on purpose: a goodbye, not a fresh room.
      else if (status === 'room-gone' && closedAs === 'room-ended') showNotice('おつかれさまでした！', `Room ${code} is closed. Thanks for playing.`);
      else if (status === 'room-gone' || status === 'seat-lost') void openRoom(true);
    },
  });
  client.connect();
  const c = client;
  setClipSource({ base, code, token: session.stageToken, watch: !!WATCH, serverNow: () => Date.now() + c.clockOffset });
}

let lastView: RoomView | null = null;

function render(view: RoomView, v: number): void {
  lastView = view;
  document.body.dataset.motion = view.calmMotion ? 'calm' : '';
  updateBackdrop(view);
  if (view.phaseSeq !== lastPhaseSeq) {
    log(`v${v} → ${view.phase}${view.round ? ` (round ${view.round}/${view.totalRounds})` : ''}`);
    // From the lobby into a game: the TV changes channel to the mode's title card.
    if (lastPhase === 'lobby' && view.phase !== 'lobby' && view.phase !== 'recap' && view.mode) channelChange(view.mode);
    // A phase change in a game: curtain wipe (restarted by reflow), and the ring timer starts full.
    // Not between Karaoke Duel's sing turns: each line is a phase, and the curtain would hide the
    // next line on its count-in. Nor within a Narabete! round, or between its story lines.
    // Into or out of a Narabete! round, where her neck takes over from her portrait: a stage curtain
    // closes over the whole screen, so she can swap places behind it.
    else if (lastPhaseSeq >= 0 && view.mode === 'narabete' && narabeteRound(view.mode, view.phase) !== narabeteRound(view.mode, lastPhase) && !['lobby', 'recap'].includes(view.phase)) stageCurtain();
    else if (lastPhaseSeq >= 0 && view.phase !== 'lobby' && !(view.mode === 'karaoke-duel' && view.phase === 'answer' && lastPhase === 'answer') && !(view.phase !== 'prompt' && narabeteRound(view.mode, view.phase) && narabeteRound(view.mode, lastPhase)) && !(view.mode === 'narabete' && view.phase === 'finale' && lastPhase === 'finale')) {
      els.main.classList.remove('wipe');
      void els.main.offsetWidth;
      els.main.classList.add('wipe');
    }
    lastPhaseSeq = view.phaseSeq;
    lastPhase = view.phase;
    phaseTotal = client?.remainingMs() ?? null;
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
  watchSfx(view);
  updateSettings(view);
  showCredits(view.phase === 'recap');

  const stageMode = view.game ? STAGE_MODES[view.game.mode] : null;
  // Patched, not rebuilt: chips keep their place and a score that went up gets a fresh
  // element (keyed by the score), so its pop plays once.
  patch(
    els.players,
    view.players.map((p) => {
      const seen = seenScores.get(p.id) ?? p.score;
      const up = seen < p.score;
      seenScores.set(p.id, p.score);
      const team = view.game ? (stageMode?.team?.(view.game, p.id) ?? null) : null;
      return h(
        'li',
        { class: `player seat-${p.seat} ${p.connected ? 'online' : 'offline'}${team !== null ? ` on-team team-${team}` : ''}`, 'data-key': p.id, style: team !== null ? `order: ${team * 100 + p.seat}` : null },
        h('span', { class: 'seat', 'aria-label': `seat ${p.seat}` }, `${seatShape(p.seat)}${p.seat}`),
        h('span', { class: 'name' }, p.name, p.isVip ? h('span', { class: 'vip', title: 'VIP' }, ' ★') : null),
        h('span', { class: 'ticks' }, (view.game && stageMode?.badge?.(view.game, p.id)) || h('span', { class: 'level' }, LEVEL_LABELS[p.level], !view.game && p.total ? h('span', { class: 'tonight', title: 'Party points tonight' }, ` · ★${p.total}`) : null)),
        h('span', { class: `score${up ? ' up' : ''}`, 'data-key': `${p.score}`, 'data-from': up ? seen : null }, p.score),
        p.connected ? null : h('span', { class: 'dropped' }, 'reconnecting…'),
      );
    }),
  );
  els.players.classList.toggle('two-rows', view.players.length > 4);
  // One scene per phase: a new phase builds fresh elements (and its entrance animations), an
  // update inside a phase patches the ones on screen so transitions and animations carry on.
  document.body.classList.toggle('flying', view.phase === 'lobby' && flying());
  // Karaoke Duel's sing turns are one scene per song (each turn is a phase; its own card is keyed by turn).
  // Narabete!'s round is one scene from deal to flip: the line stays put and its cards slide.
  const sceneKey = view.mode === 'karaoke-duel' && view.phase === 'answer' ? `karaoke-${view.round}` : narabeteRound(view.mode, view.phase) ? `narabete-${view.round}` : view.mode === 'narabete' && view.phase === 'finale' ? 'narabete-story' : `${view.phaseSeq}`;
  patch(els.fit, h('div', { class: 'scene', 'data-key': sceneKey }, mainFor(view)));
  if (view.phase === 'lobby' && flying() && view.modes.length) startDanmaku(els.canvas, els.main, view.modes);
  else stopDanmaku();
  for (const el of els.fit.querySelectorAll<HTMLElement>('[data-count]:not([data-counted])')) countUp(el);
  for (const el of els.players.querySelectorAll<HTMLElement>('.score[data-from]:not([data-rolled])')) rollScore(el);
  fitNames();
  fitMain();
  tick();
}

const seenScores = new Map<string, number>();

/** A name too wide for its card steps down in size (to 22px) before it falls back to an ellipsis. */
function fitNames(): void {
  for (const el of els.players.querySelectorAll<HTMLElement>('.name')) {
    el.style.fontSize = '';
    for (let px = 28; px >= 22 && el.scrollWidth > el.clientWidth + 1; px -= 2) el.style.fontSize = `${px}px`;
  }
}
void document.fonts?.ready.then(fitNames);

function mainFor(view: RoomView): HTMLElement {
  if (view.phase === 'lobby') {
    const waiting = view.players.length ? 'Waiting for the VIP to pick a game' : 'Scan the code to join';
    // Flying titles: a compact panel low on the screen, under lanes of titles, with one game in the
    // spotlight. Still: the full list, as the lobby always was.
    if (flying())
      return h(
        'div',
        { class: 'lobby lobby-panel' },
        h('div', { class: 'lp-head' }, h('p', { class: 'lp-title' }, waiting), h('span', { class: 'lp-count' }, `${view.players.length} / 8 players`)),
        WATCH ? h('p', { class: 'hint watch-link' }, `Watching room ${view.code} · join with your phone at the code above`) : null,
        invite(inviteLinks(siteOrigin, view.code), view.code, false),
        spotlight(view),
      );
    return h(
      'div',
      { class: 'lobby' },
      h('p', { class: 'big' }, waiting),
      h('p', { class: 'hint' }, `${view.players.length} / 8 players`),
      // Friends somewhere else open their own copy of this screen with the same code.
      WATCH ? h('p', { class: 'hint watch-link' }, `Watching room ${view.code} · join with your phone at the code above`) : null,
      // Send either link to friends: the phone one for when the QR code won't scan, the stage one
      // for friends playing from somewhere else.
      invite(inviteLinks(siteOrigin, view.code), view.code),
      h('ul', { class: 'menu' }, view.modes.map((m) => h('li', {}, h('strong', {}, m.title), ` ${m.titleJa} · `, m.blurb))),
    );
  }
  if (view.phase === 'recap' || !view.game) return recapScreen(view);
  return STAGE_MODES[view.game.mode].render(view, view.game);
}

/** The lobby's titles fly unless the room has Calm motion on or this screen switched them off. */
const flying = (): boolean => !calm() && isDanmakuOn();
onDanmakuToggle(() => lastView && render(lastView, -1));

const SPOTLIGHT_MS = 6000;
let spotIdx = 0;
let spotTimer: ReturnType<typeof setInterval> | null = null;

const spotCard = (m: ModeInfo) =>
  h(
    'div',
    { class: 'spot', 'data-mode': m.id },
    h('img', { class: 'spot-host', src: `/stage/assets/hosts/${m.host}.png`, alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
    h('div', { class: 'spot-text' }, h('p', { class: 'spot-title' }, h('span', { class: 'spot-chip' }, m.title), ' ', h('span', { lang: 'ja' }, m.titleJa)), h('p', { class: 'spot-blurb' }, m.blurb)),
  );

/**
 * One game at a time with its blurb, turning to the next every few seconds. It is a spotlight,
 * not the VIP's pick, so it says where the pick happens.
 */
function spotlight(view: RoomView): HTMLElement {
  const m = view.modes[spotIdx % view.modes.length]!;
  const slot = h('div', { class: 'spot-slot', 'data-key': 'spot' }, spotCard(m));
  if (!spotTimer)
    spotTimer = setInterval(() => {
      const modes = lastView?.modes ?? [];
      const live = document.querySelector('.spot-slot');
      if (lastView?.phase !== 'lobby' || !modes.length || !live) return;
      spotIdx = (spotIdx + 1) % modes.length;
      // The new card wipes in over the old one, which goes once it is covered: no empty frame.
      const card = spotCard(modes[spotIdx]!);
      card.classList.add('spot-in');
      const old = [...live.children];
      live.append(card);
      const done = () => old.forEach((c) => c.remove());
      card.addEventListener('animationend', done, { once: true });
      setTimeout(done, 800);
    }, SPOTLIGHT_MS);
  return h('div', { class: 'spot-wrap' }, h('p', { class: 'spot-label' }, 'Spotlight', h('span', {}, ' · the VIP picks the game on their phone')), slot);
}

/** The night's running total after this game, leader first, with what this game added. */
function partyLine(standings: RecapView['standings']): HTMLElement | null {
  if (!standings.length) return null;
  const byTotal = [...standings].sort((a, b) => b.total - a.total);
  return h(
    'p',
    { class: 'rest party-line' },
    h('span', { class: 'party-label' }, '★ Party points tonight: '),
    byTotal.flatMap((s, i) => [i ? ' · ' : '', h('strong', {}, s.name), ` ${s.total}`, s.earned ? h('span', { class: 'party-earned' }, ` +${s.earned}`) : null]),
  );
}

/** Tonight's results: a podium for the top three (third rises first), award cards, everyone else. */
function recapScreen(view: RoomView): HTMLElement {
  const standings = view.recap?.standings ?? [];
  const places = placesOf(standings.map((s) => s.score));
  // Only scorers stand on the podium; nobody is "3rd" for a 0. Shared places read "=2".
  const scored = standings.filter((s) => s.score > 0).length;
  const top = standings.slice(0, Math.min(3, scored));
  const rest = standings.slice(top.length, scored);
  const zero = standings.slice(scored);
  const tied = (i: number) => places.filter((p) => p === places[i]).length > 1;
  const placeLabel = (i: number) => `${tied(i) ? '=' : ''}${places[i]}`;
  const coop = !!view.recap?.coop;
  const total = standings.reduce((a, s) => a + s.score, 0);
  // A team game: everyone shared the team's points, so there's no podium. Each player is listed
  // with their total (the differences are speaking bonuses), highest first.
  const team = coop
    ? h(
        'div',
        { class: 'team-result' },
        h('p', { class: 'team-big' }, '🤝 Played as a team', h('span', { class: 'team-total', 'data-count': total }, `${total} pts`)),
        h('p', { class: 'rest' }, standings.flatMap((s, i) => [i ? ' · ' : '', h('strong', {}, s.name), ` ${s.score}`])),
      )
    : null;
  // Team games (Bento Haus VS): which team won, by rounds and tips, above the players.
  const teams = view.recap?.teams ?? [];
  const best = teams.length ? Math.max(...teams.map((t) => t.wins * 1000 + t.tips)) : 0;
  const teamLine = teams.length
    ? h(
        'div',
        { class: 'recap-teams' },
        teams.map((t, i) =>
          h(
            'p',
            { class: `recap-team team-${i}${t.wins * 1000 + t.tips === best && teams.filter((x) => x.wins * 1000 + x.tips === best).length === 1 ? ' won' : ''}` },
            h('span', { class: 'rt-name', lang: 'ja' }, t.ja),
            h('span', { class: 'rt-score' }, `${t.wins} ${t.wins === 1 ? 'shift' : 'shifts'} · 💰 ${t.tips}`),
            h('span', { class: 'rt-who' }, t.members.map((id) => view.players.find((p) => p.id === id)?.name ?? '').join(' · ')),
          ),
        ),
      )
    : null;
  return h(
    'div',
    { class: `recap${coop ? ' coop' : ''}` },
    h('p', { class: 'recap-title' }, ruby({ text: 'お疲れさま！', furigana: [['お', ''], ['疲', 'つか'], ['れさま！', '']] }), "Tonight's results"),
    teamLine,
    team,
    coop
      ? null
      : top.length
      ? h(
          'div',
          { class: 'podium' },
          top.map((s, i) =>
            h(
              'div',
              // Where it stands goes by order (s1–s3); its height and colour go by its place, so a tie stands level.
              { class: `step s${i + 1} p${places[i]}${tied(i) ? ' tied' : ''}` },
              places[i] === 1 ? h('span', { class: 'crown', 'aria-hidden': 'true' }, '👑') : null,
              h('span', { class: 'who' }, s.name),
              h('span', { class: 'pts', 'data-count': s.score }, `${s.score} pts`),
              h('span', { class: 'block' }, placeLabel(i)),
            ),
          ),
        )
      : h('p', { class: 'rest' }, 'No points tonight: a perfect tie. もう いっかい？'),
    !coop && rest.length ? h('p', { class: 'rest' }, rest.flatMap((s, i) => [i ? ' · ' : '', h('strong', {}, `${placeLabel(i + top.length)}. ${s.name}`), ` ${s.score}`])) : null,
    !coop && top.length && zero.length ? h('p', { class: 'rest' }, 'Also played: ', zero.map((s) => s.name).join(' · ')) : null,
    partyLine(standings),
    view.recap?.awards.length
      ? h(
          'ul',
          { class: 'awards' },
          view.recap.awards.map((a, i) =>
            h('li', { class: 'award-card', style: `animation-delay:${3200 + i * 500}ms` }, icon('trophy', '🏆', 'a-trophy'), h('span', { class: 'a-ja', lang: 'ja' }, awardTitle(a.title)), h('span', { class: 'a-en' }, a.en), h('span', { class: 'a-who' }, a.name)),
          ),
        )
      : null,
  );
}

/**
 * The music and voice credits their licences ask for: one line at a time across the foot of the
 * screen during the recap, outside the play area so it never shrinks with the podium.
 */
const creditLines = [
  ...creditSummary(),
  `Host voices: ${[...new Set(Object.values(HOSTS).map((x) => x.credit))].join(' · ')}`,
  // CC BY-SA: Kana Raid's ink and Shodō Taikai's models and checks use KanjiVG's strokes.
  'Stroke order data: KanjiVG, © Ulrich Apel and contributors, CC BY-SA 3.0 (kanjivg.tagaini.net)',
];
const creditStrip = h('p', { class: 'credits', 'aria-live': 'off', hidden: true });
els.canvas.append(creditStrip);
let creditTimer: ReturnType<typeof setInterval> | null = null;
function showCredits(on: boolean): void {
  creditStrip.hidden = !on;
  if (!on) {
    if (creditTimer) clearInterval(creditTimer);
    creditTimer = null;
    return;
  }
  if (creditTimer) return;
  let i = 0;
  const next = () => mount(creditStrip, h('span', { 'data-key': `c${i}` }, `♪ ${creditLines[i++ % creditLines.length]}`));
  next();
  creditTimer = setInterval(next, 5_000);
}

/** Recap points tick up from 0 as the podium rises, instead of arriving finished. */
function countUp(el: HTMLElement): void {
  el.dataset.counted = '1';
  const to = Number(el.dataset.count);
  if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = performance.now() + 600;
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / 1400));
    el.textContent = `${Math.round(to * (1 - (1 - t) ** 3))} pts`;
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = '0 pts';
  requestAnimationFrame(step);
}

/** A score that went up rolls from the old number to the new one, like a counter, after the rows land. */
function rollScore(el: HTMLElement): void {
  el.dataset.rolled = '1';
  const from = Number(el.dataset.from);
  const to = Number(el.textContent);
  if (!(to > from) || calm()) return;
  el.textContent = String(from);
  const start = performance.now() + 500;
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / 900));
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 2)));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Lobby → game: a burst of TV static, the mode's title card, then a cut to the show (1.6 s).
 * The title card doesn't move: it cuts in and out. A click skips it; Calm motion has no static.
 */
function channelChange(mode: ModeId): void {
  const info = MENU_ALL.find((m) => m.id === mode);
  if (!info) return;
  els.canvas.querySelector('.channel')?.remove();
  const quiet = calm();
  const card = h(
    'div',
    { class: `channel${quiet ? ' quiet' : ''}`, onclick: () => card.remove() },
    quiet ? null : h('div', { class: 'channel-noise', style: `background-image:url('${noise()}')` }),
    h('div', { class: 'channel-band' }, h('span', { class: 'channel-ja', lang: 'ja' }, info.titleJa), h('span', { class: 'channel-en' }, info.title)),
  );
  els.canvas.append(card);
  setTimeout(() => card.remove(), quiet ? 1200 : 1600);
}

/** A stage curtain over the whole screen (1 s): closes from both sides, holds, opens. Calm motion skips it. */
function stageCurtain(): void {
  els.canvas.querySelector('.stage-curtain')?.remove();
  els.main.classList.remove('wipe', 'wipe-wide');
  if (calm()) return;
  void els.main.offsetWidth;
  els.main.classList.add('wipe-wide');
  const curtain = h('div', { class: 'stage-curtain', 'aria-hidden': 'true' }, h('span', { class: 'stage-curtain-l' }), h('span', { class: 'stage-curtain-r' }));
  els.canvas.append(curtain);
  setTimeout(() => {
    curtain.remove();
    els.main.classList.remove('wipe-wide');
  }, 1000);
}

let noiseUrl = '';
/** A small tile of grey TV static, made once. */
function noise(): string {
  if (noiseUrl) return noiseUrl;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 90;
  const g = c.getContext('2d');
  if (!g) return '';
  const img = g.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 40 + Math.floor(Math.random() * 200);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseUrl = c.toDataURL();
  return noiseUrl;
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

/** The phases of a Narabete! round, which share one layout (no curtain between them). */
const narabeteRound = (mode: string | null, phase: string | null): boolean => mode === 'narabete' && !!phase && ['prompt', 'answer', 'reveal', 'encore', 'score'].includes(phase);

let lastHostKey = '';
let hostAudio: HTMLAudioElement | null = null;
let hostHold: ReturnType<typeof setTimeout> | null = null;
/** A line whose audio is still being made: the browser reads it only if the audio doesn't come in time. */
let hostWait: { key: string; timer: ReturnType<typeof setTimeout> } | null = null;
const LATE_AUDIO_MS = 4000;
function stopHostWait(): void {
  if (hostWait) clearTimeout(hostWait.timer);
  hostWait = null;
}
function playHostAudio(say: HostSay & { audioUrl: string }): void {
  const audio = new Audio(say.audioUrl);
  hostAudio = audio;
  duckFor(audio);
  hostSprite.talk(audio, say.mouth, say.kana);
  // Blocked (no click yet): the mouth still moves with the subtitles.
  void audio.play().catch(() => hostAudio === audio && hostSprite.talk(null, undefined, say.kana));
}
/** A host's line, with furigana over any kanji (はんじょう賞) when it can be worked out from the line's kana. */
const hostJp = (say: HostSay): string | HTMLElement => (/\p{Script=Han}/u.test(say.text) && hasReading({ text: say.text, kana: say.kana }) ? ruby({ text: say.text, kana: say.kana }) : say.text);

function showHost(view: RoomView): void {
  const say = view.host;
  els.host.hidden = !say;
  if (!say) return;
  const key = `${say.phaseSeq}:${say.text}`;
  if (key === lastHostKey) {
    // The line's audio, late: it plays if the browser hasn't started reading the line instead.
    if (hostWait?.key === key && say.audioUrl) {
      stopHostWait();
      if (!isMuted()) playHostAudio({ ...say, audioUrl: say.audioUrl });
    }
    return;
  }
  stopHostWait();
  // A mode mid-reveal (the Karaoke Duel winner) holds the line: the host waits with "…" in the
  // bubble, which keeps the play area's size, and speaks once the reveal gets there.
  const hold = view.game ? (STAGE_MODES[view.game.mode].hostHoldMs?.(view, view.game) ?? 0) : 0;
  if (hold > 0) {
    if (hostHold === null) {
      hostHold = setTimeout(() => {
        hostHold = null;
        if (client?.view) showHost(client.view);
      }, hold);
      if (!hostSprite.el.isConnected) els.host.prepend(hostSprite.el);
      hostAudio?.pause();
      hostAudio = null;
      stopHostSpeech();
      const wait = h('div', { class: 'host-bubble' }, h('span', { class: 'host-name', lang: 'ja' }, HOST_NAMES[say.host] ?? say.host), h('span', { class: 'host-jp', lang: 'ja' }, '…'));
      const old = els.host.querySelector('.host-bubble');
      if (old) old.replaceWith(wait);
      else els.host.append(wait);
    }
    return;
  }
  lastHostKey = key;
  // The sprite stays; only the bubble is new. The host reacts to the line, then idles.
  if (!hostSprite.el.isConnected) els.host.prepend(hostSprite.el);
  hostSprite.show(say.host, say.mood);
  const bubble = h('div', { class: 'host-bubble' }, h('span', { class: 'host-name', lang: 'ja' }, HOST_NAMES[say.host] ?? say.host), h('span', { class: 'host-jp', lang: 'ja' }, hostJp(say)), h('span', { class: 'host-en' }, say.en));
  const old = els.host.querySelector('.host-bubble');
  if (old) old.replaceWith(bubble);
  else els.host.append(bubble);
  // A new line cuts off the last one, so two never talk over each other.
  hostAudio?.pause();
  hostAudio = null;
  // Every screen voices the host for whoever is in front of it; a muted screen stays quiet.
  stopHostSpeech();
  if (say.audioUrl && !isMuted()) playHostAudio({ ...say, audioUrl: say.audioUrl });
  else if (say.audioPending && !isMuted()) {
    // VOICEVOX is still making it: wait a little, then read it with the browser's voice after all.
    hostWait = {
      key,
      timer: setTimeout(() => {
        hostWait = null;
        if (lastHostKey !== key) return;
        if (canSpeakHost()) speakHost(say.host, say.kana);
        hostSprite.talk(null, undefined, say.kana);
      }, LATE_AUDIO_MS),
    };
  } else {
    // No VOICEVOX on the server: the browser's Japanese voice reads the kana instead.
    if (canSpeakHost()) speakHost(say.host, say.kana);
    hostSprite.talk(null, undefined, say.kana);
  }
}

function tick(): void {
  const left = client?.remainingMs() ?? null;
  tickSfx(client?.view ?? null, left);
  const text = formatSeconds(left);
  if (els.timer.textContent !== text) els.timer.textContent = text;
  els.timer.classList.toggle('urgent', left !== null && left > 0 && left <= 5_000);
  if (left !== null && (phaseTotal === null || left > phaseTotal)) phaseTotal = left;
  els.timer.style.setProperty('--left', left !== null && phaseTotal ? String(Math.max(0, left / phaseTotal)) : '1');
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
els.newRoom.addEventListener('click', () => (WATCH ? location.assign('/stage/') : void openRoom(true)));
els.toggleRaw.addEventListener('click', () => {
  els.raw.hidden = !els.raw.hidden;
  if (!els.raw.hidden && client?.view) els.raw.textContent = JSON.stringify(client.view, null, 2);
});

setInterval(tick, 200);
void openRoom(false);
