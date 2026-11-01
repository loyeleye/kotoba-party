// The stage's settings panel: the four volumes, streamer mode, background effects and, on the
// main stage, the game buttons (Start, Skip ahead, Play again) and whether watching screens (friends'
// laptops on ?code=) may use them too. A watching screen that has been given control gets the same buttons. Volumes, streamer mode
// and background effects belong to this screen; remote control and the Audience (who the words are
// for: Kids, Family or Cheeky, which asks first) belong to the room. While a game runs, the panel
// opens on "End this game", which goes back to the game picker with the room, players and scores
// from before the game kept. The main stage can also close the room, behind a second, explicit confirm.

import { audienceContentList } from '../../shared/src/audience.js';
import { h, mount, ruby } from '../../shared/src/dom.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { invite, inviteLinks } from '../../shared/src/share.js';
import { SURPRISE, type Audience, type ModeId, type RoomView } from '../../shared/src/protocol.js';
import { isAmbientOn, setAmbient } from './backdrop.js';
import { isDanmakuOn, setDanmaku } from './danmaku.js';
import { isStreamerMode, setStreamerMode } from './music/index.js';
import { sfx } from './music/sfx.js';
import { getVolumes, setVolume, type VolumeId } from './sound.js';

type Send = (body: { type: 'start'; mode: ModeId | typeof SURPRISE; rounds?: number } | { type: 'skip'; phaseSeq: number } | { type: 'playAgain' } | { type: 'endGame' } | { type: 'settings'; remoteControl?: boolean; audience?: Audience } | { type: 'passVip'; playerId: string } | { type: 'closeRoom' }) => Promise<void>;

const VOLUMES: [VolumeId, string][] = [
  ['master', 'Master volume'],
  ['host', 'Host voice volume'],
  ['sfx', 'Sound effects volume'],
  ['music', 'Background music volume'],
];

let panel: HTMLElement | null = null;
let room: HTMLElement | null = null;
let game: HTMLElement | null = null;
let opts: { watch: boolean; send: Send; site: () => string } | null = null;
let view: RoomView | null = null;
let roomKey = '';
let show: (open: boolean) => void = () => {};
/** The close-room button has been pressed once and is asking to be sure. */
let confirming = false;
/** End this game has been pressed once and is asking to be sure. */
let ending = false;
/** Cheeky has been pressed and the warning is showing. */
let cheekyAsk = false;
/** Make VIP has been pressed: the player it would go to, while it asks to be sure. */
let vipAsk: string | null = null;
/** Who was VIP when the panel last drew, so a hand-over can flash. */
let lastVip: string | null = null;

/** A section heading: English first, then a short Japanese label with its reading for learners. */
function heading(en: string, jp?: string, kana?: string): HTMLElement {
  return h('h3', {}, en, jp ? ruby({ text: jp, kana }, { class: 'jp-k' }) : null);
}

/** Puts the settings button on the stage; the panel opens over the canvas. */
export function mountSettings(parent: HTMLElement, options: { watch: boolean; send: Send; site: () => string }): void {
  opts = options;
  const button = h('button', { type: 'button', class: 'st-open', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, '⚙ Settings') as HTMLButtonElement;
  room = h('div', { class: 'st-room' });
  game = h('div', { class: 'st-game' });
  const close = h('button', { type: 'button', class: 'st-close', 'aria-label': 'Close settings' }, '✕');
  panel = h(
    'div',
    { class: 'st-panel', role: 'dialog', 'aria-label': 'Settings', hidden: true },
    h('div', { class: 'st-head' }, h('h2', {}, 'Settings', ruby({ text: '設定', kana: 'せってい' }, { class: 'jp-k' })), close),
    game,
    h('section', { class: 'st-sec' }, heading('Sound on this screen', '音', 'おと'), VOLUMES.map(([id, label]) => slider(id, label))),
    h(
      'section',
      { class: 'st-sec' },
      heading('Look of this screen'),
      toggle('Streamer mode', "Plays only the game's own music, so a stream or video of this screen doesn't pick up copyright claims.", isStreamerMode(), (on) => setStreamerMode(on)),
      toggle('Background effects', 'Mist, spotlights and confetti behind the game. Off shows a still set. Calm motion on the VIP’s phone also holds them still.', isAmbientOn(), (on) => setAmbient(on)),
      toggle('Flying titles', 'Game titles drifting across the lobby. Off shows the still list of games. Calm motion on the VIP’s phone also stops them.', isDanmakuOn(), (on) => setDanmaku(on)),
    ),
    room,
    h('div', { class: 'st-fade', 'aria-hidden': 'true' }),
  );
  // The fade at the bottom edge shows only while the panel can still scroll down.
  const atEnd = () => panel!.classList.toggle('at-end', panel!.scrollTop + panel!.clientHeight >= panel!.scrollHeight - 4);
  panel.addEventListener('scroll', atEnd, { passive: true });
  show = (open: boolean) => {
    panel!.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    confirming = false;
    ending = false;
    cheekyAsk = false;
    vipAsk = null;
    lastVip = null;
    if (open) (renderRoom(true), requestAnimationFrame(atEnd));
  };
  button.addEventListener('click', () => (sfx('tap'), show(panel!.hidden)));
  close.addEventListener('click', () => show(false));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel!.hidden) return;
    // Escape backs out of the close-room question first, then closes the panel.
    if (confirming || cheekyAsk || ending || vipAsk) {
      confirming = cheekyAsk = ending = false;
      vipAsk = null;
      renderRoom(true);
    } else show(false);
  });
  parent.append(button, panel);
}

/** Call on every render: keeps the room section in step with the game. */
export function updateSettings(next: RoomView): void {
  view = next;
  renderRoom(false);
}

function slider(id: VolumeId, label: string): HTMLElement {
  const value = Math.round(getVolumes()[id] * 100);
  const out = h('output', { class: 'st-val' }, `${value}%`);
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(value), 'aria-label': label }) as HTMLInputElement;
  input.addEventListener('input', () => {
    setVolume(id, Number(input.value) / 100);
    out.textContent = `${input.value}%`;
  });
  // A sample at the new level, so the sound effects slider can be heard as it moves.
  if (id === 'sfx' || id === 'master') input.addEventListener('change', () => sfx('right'));
  return h('label', { class: 'st-slider' }, h('span', { class: 'st-label' }, label), input, out);
}

function toggle(label: string, help: string, on: boolean, change: (on: boolean) => void): HTMLElement {
  const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
  box.checked = on;
  box.addEventListener('change', () => change(box.checked));
  return h('label', { class: 'st-toggle' }, box, h('span', {}, h('span', { class: 'st-label' }, label), h('span', { class: 'st-help' }, help)));
}

/** The room part: the game buttons, plus the main stage's remote-control switch; a watching screen gets the buttons once it has control. */
function renderRoom(force: boolean): void {
  if (!room || !opts || !panel || panel.hidden) return;
  const v = view;
  const key = v ? `${opts.watch}:${v.remoteControl}:${v.audience}:${v.phase}:${v.phaseSeq}:${v.deadline !== null}:${v.modes.map((m) => m.id).join()}:${v.players.map((p) => `${p.id}${p.isVip ? '*' : ''}`).join()}` : 'none';
  if (!force && key === roomKey) return;
  roomKey = key;
  if (!v) return void (mount(room), mount(game!));
  const inGame = v.phase !== 'lobby' && v.phase !== 'recap';
  if (!inGame) ending = false;
  mount(game!, inGame && (!opts.watch || v.remoteControl) ? endGame(v) : null);
  const share = h('section', { class: 'st-sec' }, heading('Invite friends', '友だちを よぼう', 'ともだちを よぼう'), invite(inviteLinks(opts.site(), v.code), v.code, false));
  if (!opts.watch) {
    mount(
      room,
      controls(v),
      vip(v),
      share,
      audience(v),
      closeRoom(v),
    );
    return;
  }
  if (!v.remoteControl) {
    mount(room, share, h('section', { class: 'st-sec' }, heading('Game controls', 'ゲーム'), h('p', { class: 'st-help' }, "The main screen runs this game. Ask them to turn on “Let other screens control the game” in their settings.")));
    return;
  }
  mount(room, controls(v), share);
}

/** Start, Skip ahead and Play again: on the main stage always, on a watching screen once it has control. */
function controls(v: RoomView): HTMLElement {
  const send = opts!.send;
  const buttons: HTMLElement[] = [];
  if (v.phase === 'lobby' && v.modes.length) {
    // Games that don't fit tonight's players stay listed but can't be picked, as on the VIP's phone.
    const n = v.players.length;
    const fits = (m: RoomView['modes'][number]) => n >= m.minPlayers && n <= m.maxPlayers;
    const needs = (m: RoomView['modes'][number]) => (m.minPlayers === m.maxPlayers ? `${m.minPlayers}` : `${m.minPlayers}–${m.maxPlayers}`);
    const pick = h(
      'select',
      { 'aria-label': 'Game' },
      h('option', { value: SURPRISE, disabled: !v.modes.some(fits) }, '🎲 Surprise Me!'),
      // Ruby can't go in an <option>, so the Japanese title comes as its kana reading.
      v.modes.map((m) => h('option', { value: m.id, disabled: !fits(m) }, `${m.title} · ${m.titleKana ?? m.titleJa}${fits(m) ? '' : ` (${needs(m)} players)`}`)),
    ) as HTMLSelectElement;
    pick.value = v.modes.find(fits)?.id ?? SURPRISE;
    // The intro plays straight away, so the panel gets out of its way.
    const start = button('Start', () => (show(false), send({ type: 'start', mode: pick.value as ModeId | typeof SURPRISE }))) as HTMLButtonElement;
    start.disabled = !v.modes.some(fits);
    buttons.push(pick, start);
  }
  if (v.deadline !== null && v.phase !== 'lobby') buttons.push(button('Skip ahead', () => send({ type: 'skip', phaseSeq: v.phaseSeq })));
  if (v.phase === 'recap') buttons.push(button('Play again', () => send({ type: 'playAgain' })));
  // The main stage decides whether watching screens get these buttons too.
  const remote = opts!.watch
    ? null
    : toggle(
        'Let other screens control the game',
        `Friends watching on their own screen (${inviteLinks(opts!.site(), v.code).stage.replace(/^https?:\/\//, '')}) get these controls too, and End game. Phones aren't affected: the VIP's phone can always run the game.`,
        v.remoteControl,
        (on) => void opts!.send({ type: 'settings', remoteControl: on }),
      );
  return h('section', { class: 'st-sec' }, heading('Game controls', 'ゲーム'), buttons.length ? h('div', { class: 'st-row' }, buttons) : h('p', { class: 'st-help' }, 'Nothing to do right now.'), remote);
}

/** Main stage only: who holds the VIP star, and a way to hand it to another phone. */
function vip(v: RoomView): HTMLElement {
  const now = v.players.find((p) => p.isVip);
  // A new VIP (from here or from the old VIP's phone): the section flashes once, with a chime.
  const changed = lastVip !== null && now?.id !== lastVip;
  lastVip = now?.id ?? null;
  if (changed) sfx('right');
  const sec = h('section', { class: `st-sec${changed ? ' st-flash' : ''}` }, heading('VIP', 'ビップ'));
  if (!now) return (sec.append(h('p', { class: 'st-help' }, 'The first phone to join becomes the VIP.')), sec);
  const others = v.players.filter((p) => !p.isVip);
  sec.append(h('p', { class: 'st-help' }, `${now.name} is the VIP: their phone picks the games, starts, skips and plays again.${others.length ? ' Hand it to someone else here, for example if their phone is going flat.' : ''}`));
  if (!others.length) return sec;
  const to = vipAsk ? others.find((p) => p.id === vipAsk) : undefined;
  if (to) {
    // Handing over takes the game menu off someone's phone, so it asks first, like End game.
    const keep = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, `Keep ${now.name}`) as HTMLButtonElement;
    const yes = h('button', { type: 'button', class: 'st-btn' }, `Yes, make ${to.name} VIP`) as HTMLButtonElement;
    keep.addEventListener('click', () => (sfx('tap'), (vipAsk = null), renderRoom(true)));
    yes.addEventListener('click', () => {
      yes.disabled = keep.disabled = true;
      sfx('tap');
      vipAsk = null;
      void opts?.send({ type: 'passVip', playerId: to.id });
    });
    sec.append(
      h(
        'div',
        { class: 'st-confirm st-confirm-calm', role: 'alertdialog', 'aria-label': `Make ${to.name} the VIP?` },
        h('p', { class: 'st-label' }, `Make ${to.name} the VIP?`),
        h('p', { class: 'st-help' }, `The game menu moves from ${now.name}’s phone to ${to.name}’s.`),
        h('div', { class: 'st-row' }, keep, yes),
      ),
    );
    return sec;
  }
  vipAsk = null;
  const pick = h('select', { 'aria-label': 'New VIP' }, others.map((p) => h('option', { value: p.id }, p.name))) as HTMLSelectElement;
  const ask = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, 'Make VIP…') as HTMLButtonElement;
  ask.addEventListener('click', () => (sfx('tap'), (vipAsk = pick.value), renderRoom(true)));
  sec.append(h('div', { class: 'st-row' }, pick, ask));
  return sec;
}

const AUDIENCE_LABELS: [Audience, string, string][] = [
  ['kids', '🧒 Kids · こども', 'For children: simple words, silly stories, and stricter checks on what players type.'],
  ['family', '🏠 Family · かぞく', 'Grown-up jokes anyone can hear. The default.'],
  ['cheeky', '🌶️ Cheeky · おとな', 'Adult party humour. Asks first.'],
];

/**
 * Who the words are for. The hosts follow it in every mode; the modes in AUDIENCE_CONTENT (shared/src/audience.ts)
 * also swap their own content, and the rest play Family. Cheeky stays off until the host says yes to a warning,
 * and it is never the default; a game in progress picks up the change from its next round or song.
 */
function audience(v: RoomView): HTMLElement {
  const sec = h('section', { class: 'st-sec' }, heading('Audience', 'だれと あそぶ？'));
  const set = (to: Audience) => {
    sfx('tap');
    cheekyAsk = false;
    void opts?.send({ type: 'settings', audience: to });
    renderRoom(true);
  };
  const row = h(
    'div',
    { class: 'st-row', role: 'radiogroup', 'aria-label': 'Audience' },
    AUDIENCE_LABELS.map(([id, label]) => {
      const on = v.audience === id;
      const b = h('button', { type: 'button', class: `st-btn${on ? '' : ' st-btn-quiet'}`, role: 'radio', 'aria-checked': String(on) }, label) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (on) return;
        if (id !== 'cheeky') return set(id);
        sfx('tap');
        cheekyAsk = true;
        renderRoom(true);
      });
      return b;
    }),
  );
  sec.append(
    h('p', { class: 'st-help' }, `Who the words are for. ${AUDIENCE_LABELS.find(([id]) => id === v.audience)?.[2] ?? ''}`),
    row,
    h('p', { class: 'st-help' }, `The hosts follow it in every mode. Kids and Cheeky content so far: ${audienceContentList()}. Other modes play their Family content.`),
  );
  if (cheekyAsk) {
    const keep = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, 'Keep it clean') as HTMLButtonElement;
    const yes = h('button', { type: 'button', class: 'st-btn st-btn-danger' }, 'Turn on Cheeky') as HTMLButtonElement;
    keep.addEventListener('click', () => {
      sfx('tap');
      cheekyAsk = false;
      renderRoom(true);
    });
    yes.addEventListener('click', () => set('cheeky'));
    sec.append(
      h(
        'div',
        { class: 'st-confirm', role: 'alertdialog', 'aria-label': 'Turn on Cheeky?' },
        h('p', { class: 'st-label' }, 'Cheeky is for grown-ups only'),
        h('p', { class: 'st-help' }, 'The hosts (and the songs) joke about drinking, hangovers, bad dates, bathroom emergencies and innuendo (never explicit). Not for children, classrooms or a stream. Everyone in the room will hear it.'),
        h('div', { class: 'st-row' }, keep, yes),
      ),
    );
    queueMicrotask(() => keep.focus());
  }
  return sec;
}

/**
 * For a wrong pick or a game that isn't landing: back to the game picker, same room and players.
 * Everyone's score goes back to what it was before this game started, so it asks once first.
 */
function endGame(v: RoomView): HTMLElement {
  const title = v.mode ? MODES[v.mode].info.title : 'this game';
  const sec = h('section', { class: 'st-sec st-game-end' }, h('h3', {}, 'This game'));
  if (!ending) {
    const ask = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, '↩ End game, pick another…') as HTMLButtonElement;
    ask.addEventListener('click', () => {
      sfx('tap');
      ending = true;
      renderRoom(true);
    });
    sec.append(h('p', { class: 'st-help' }, `Stops ${title} and goes back to the game picker. Everyone stays in the room.`), h('div', { class: 'st-row' }, ask));
    return sec;
  }
  const keep = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, 'Keep playing') as HTMLButtonElement;
  const yes = h('button', { type: 'button', class: 'st-btn' }, 'Yes, end game') as HTMLButtonElement;
  keep.addEventListener('click', () => {
    sfx('tap');
    ending = false;
    renderRoom(true);
  });
  yes.addEventListener('click', () => {
    yes.disabled = keep.disabled = true;
    sfx('tap');
    show(false);
    void opts?.send({ type: 'endGame' });
  });
  sec.append(
    h(
      'div',
      { class: 'st-confirm st-confirm-calm', role: 'alertdialog', 'aria-label': `End ${title}?` },
      h('p', { class: 'st-label' }, `End ${title} and go back to the game picker?`),
      h('p', { class: 'st-help' }, 'Points from this game are dropped: scores go back to what they were when it started. Players and the room code stay.'),
      h('div', { class: 'st-row' }, keep, yes),
    ),
  );
  queueMicrotask(() => keep.focus());
  return sec;
}

/**
 * Ending the room is the one thing here that can't be undone, so it sits last, looks quieter
 * than the game buttons until it is pressed, and asks once more with "Keep playing" focused.
 */
function closeRoom(v: RoomView): HTMLElement {
  const sec = h('section', { class: 'st-sec st-end' }, heading('End the party', 'お開き', 'おひらき'));
  const players = v.players.length;
  if (!confirming) {
    const ask = h('button', { type: 'button', class: 'st-btn st-btn-danger-quiet' }, 'Close room…') as HTMLButtonElement;
    ask.addEventListener('click', () => {
      sfx('tap');
      confirming = true;
      renderRoom(true);
    });
    sec.append(h('p', { class: 'st-help' }, `Ends room ${v.code} on this screen, every phone and any other screens. Players see a goodbye, and the room's code stops working.`), h('div', { class: 'st-row' }, ask));
    return sec;
  }
  const keep = h('button', { type: 'button', class: 'st-btn st-btn-quiet' }, 'Keep playing') as HTMLButtonElement;
  const yes = h('button', { type: 'button', class: 'st-btn st-btn-danger' }, 'Yes, close room') as HTMLButtonElement;
  keep.addEventListener('click', () => {
    sfx('tap');
    confirming = false;
    renderRoom(true);
  });
  yes.addEventListener('click', () => {
    yes.disabled = keep.disabled = true;
    show(false);
    void opts?.send({ type: 'closeRoom' });
  });
  const who = players === 0 ? 'Nobody has joined yet.' : `${players} ${players === 1 ? 'player is' : 'players are'} still in it.`;
  sec.append(
    h('div', { class: 'st-confirm', role: 'alertdialog', 'aria-label': `Close room ${v.code}?` }, h('p', { class: 'st-label' }, `Close room ${v.code} for everyone?`), h('p', { class: 'st-help' }, `${who} This can't be undone; you'd start a new room with a new code.`), h('div', { class: 'st-row' }, keep, yes)),
  );
  queueMicrotask(() => keep.focus());
  return sec;
}

function button(label: string, onClick: () => Promise<void>): HTMLElement {
  const b = h('button', { type: 'button', class: 'st-btn' }, label) as HTMLButtonElement;
  b.addEventListener('click', () => {
    sfx('tap');
    void onClick().then(() => {
      b.classList.add('st-done');
      setTimeout(() => b.classList.remove('st-done'), 600);
    });
  });
  return b;
}
