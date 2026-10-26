// Kana Yōkai Raid on the stage: the horde marches from right to left towards the gate, each
// yōkai a pixel-art spirit with its kana written on it, with an HP bar; the team combo meter
// sits on top. Positions come from the yōkai's server-side spawn and escape times, played
// as CSS animations with a negative delay, so a re-render never makes them jump. In the Ink
// Storm wave the yōkai wear their twins' masks and the players' drawings replay in brush
// strokes under the arena, timed the same way.

import { sfx } from '../music/sfx.js';
import { h, ruby, stagger } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import type { InkShow, KanaRaidView, YokaiView } from '../../../shared/src/modes/kanaRaid/kanaRaid.js';
import { COMBO_WINDOW_MS, INK_WAVE } from '../../../shared/src/modes/kanaRaid/kanaRaid.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';
import { BOSS_DEFEAT, hitSheet, isReady, spriteEl } from '../sprites.js';

// ---------- server clock ----------
// The view carries `at`, the server time of its last change. A state arrives after it was
// made, so `at - Date.now()` never overshoots the true offset; the largest sample is the best.
let clockOffset = Number.NEGATIVE_INFINITY;
let lastAt = -1;
function serverNow(game: KanaRaidView): number {
  if (game.at !== lastAt) {
    lastAt = game.at;
    clockOffset = Math.max(clockOffset, game.at - Date.now());
  }
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
}

// ---------- art ----------
const SPRITES = ['yokai-blob', 'yokai-lantern', 'yokai-umbrella', 'yokai-scroll'];
let artOk = true;
if (typeof Image !== 'undefined') {
  const probe = new Image();
  probe.onerror = () => (artOk = false);
  probe.src = '/stage/assets/yokai/yokai-lantern.png';
}
const spriteFor = (id: string): string => {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPRITES[n % SPRITES.length]!;
};

/** Where a yōkai is (in % of the march track from the left) a fraction of the way along its walk. */
const leftAt = (frac: number) => 100 - Math.min(1, Math.max(0, frac)) * 108;
/** The march track is the arena less 120 px at the right (kanaRaid.css), so a yōkai enters whole. */
const TRACK_GAP = 120;
const trackLeft = (pct: number) => `calc(${pct}% - ${(pct * TRACK_GAP) / 100}px)`;

function yokaiEl(y: YokaiView, index: number, now: number, wide: boolean, who: Map<string, string>): HTMLElement | null {
  const total = Math.max(1, y.escapeAt - y.spawnAt);
  const lane = index % 3;
  const sprite = y.leader ? 'yokai-umbrella' : spriteFor(y.id);
  const classes = ['raid-yokai', `lane-${lane}`, artOk ? `art ${sprite}` : 'no-art', y.leader ? 'leader' : '', wide ? 'wide' : ''];
  const poof = artOk && isReady(hitSheet(sprite).src);
  let style: string;
  if (y.state === 'alive') {
    style = `--dur:${total}ms;--delay:${y.spawnAt - now}ms`;
    classes.push('marching');
  } else if (y.state === 'defeated' && y.endedAt !== null && now - y.endedAt < 1_600) {
    style = `left:${trackLeft(leftAt((y.endedAt - y.spawnAt) / total))}`;
    classes.push('defeated');
    if (!poof) classes.push('no-sheet');
  } else return null;
  if (y.hitAt !== null && now - y.hitAt < 600 && y.state === 'alive') classes.push('hit');
  const hpPct = Math.round((100 * y.hp) / Math.max(1, y.maxHp));
  return h(
    'div',
    // Keyed by yōkai: the same element marches, takes hits and bursts across updates.
    { class: classes.filter(Boolean).join(' '), style, 'data-key': y.id },
    h(
      'div',
      { class: 'raid-yokai-inner' },
      h('div', { class: 'raid-hp' }, h('span', { style: `width:${hpPct}%` })),
      h(
        'div',
        {
          class: 'raid-body',
          style: !artOk ? '' : y.state === 'defeated' && poof ? `--art:url('/stage/assets/yokai/${sprite}.png')` : `background-image:url('/stage/assets/yokai/${sprite}.png');--art:url('/stage/assets/yokai/${sprite}.png')`,
        },
        // Caught: the hit sheet plays once, ending empty.
        y.state === 'defeated' && poof ? spriteEl(hitSheet(sprite), 128, 'poof') : null,
        h('span', { class: 'raid-tag', lang: 'ja' }, h('span', { class: 'raid-kana' }, y.char), y.alt ? h('span', { class: 'raid-kana alt' }, y.alt) : null),
      ),
      y.leader ? h('div', { class: 'raid-leader', lang: 'ja' }, `👑 ${y.leader}`) : null,
    ),
    y.state === 'defeated' ? h('div', { class: 'raid-burst' }, '✦') : null,
    // The catch chip: who got it and what it paid, rising out of the poof.
    y.state === 'defeated' && y.caughtBy ? h('div', { class: 'raid-catch' }, `${who.get(y.caughtBy) ?? '?'} +${y.caughtPoints ?? 0}`) : null,
  );
}

/** The latest drawings, brushed on stroke by stroke (newest on the right). */
function inkStrip(view: RoomView, game: KanaRaidView, now: number): HTMLElement {
  const who = names(view);
  return h(
    'div',
    { class: 'raid-inks' },
    game.inks.length ? null : h('p', { class: 'hint' }, '🖌 Draw on your phones: your brush strokes appear here.'),
    game.inks.map((ink: InkShow) =>
      h(
        'figure',
        { class: `raid-ink ${ink.ok ? (ink.clean ? 'clean' : 'ok') : 'miss'}` },
        inkSvg(ink.strokes, { strokeMs: 350, elapsedMs: Math.max(0, now - ink.at) }),
        h('figcaption', {}, h('strong', {}, who.get(ink.playerId) ?? '?'), ink.ok ? h('span', { lang: 'ja' }, ` ${ink.char} ${ink.clean ? '◎' : '○'}`) : ' ×'),
      ),
    ),
  );
}

function arena(view: RoomView, game: KanaRaidView): HTMLElement {
  const now = serverNow(game);
  const ink = game.ink && game.wave === INK_WAVE;
  const total = game.horde.length;
  const down = game.horde.filter((y) => y.state === 'defeated').length;
  const fled = game.horde.filter((y) => y.state === 'escaped' || (y.state === 'alive' && y.escapeAt <= now)).length;
  raidSfx(game, fled);
  const wide = game.wave === 3;
  const c = game.combo;
  const comboLeft = COMBO_WINDOW_MS - (now - c.lastAt);
  const comboLive = c.players >= 2 && c.count >= 2 && comboLeft > 0;
  const who = names(view);
  return h(
    'div',
    { class: 'raid-stage' },
    h(
      'div',
      { class: 'raid-top' },
      h('span', { class: 'raid-wave-tag' }, `WAVE ${game.wave}`, game.waveInfo ? [' ', ruby({ text: game.waveInfo.titleJa, kana: game.waveInfo.titleKana })] : null),
      h('span', { class: 'raid-count' }, `👻 ${down} caught · ${fled} fled · ${Math.max(0, total - down - fled)} left`),
      h(
        'span',
        { class: `raid-combo${comboLive ? ' live' : ''}`, style: comboLive ? `--fade:${comboLeft}ms` : '' },
        comboLive ? `COMBO ×${c.count}` : c.best ? `best combo ×${c.best}` : 'combo: hit together!',
        // Drains over the real combo window; keyed by the last hit so each hit refills it.
        comboLive ? h('span', { class: 'raid-combo-bar', 'data-key': `${c.lastAt}`, style: `--left:${(comboLeft / COMBO_WINDOW_MS).toFixed(3)};--fade:${comboLeft}ms` }) : null,
      ),
    ),
    h(
      'div',
      { class: `raid-arena${wide ? ' words' : ''}${ink ? ' ink' : ''}` },
      h('div', { class: 'raid-gate', title: 'The gate: yōkai that reach it escape' }, '⛩'),
      game.horde.map((y, i) => yokaiEl(y, i, now, wide, who)),
    ),
    ink ? inkStrip(view, game, now) : null,
    view.phase === 'answer' ? h('p', { class: 'raid-how' }, game.waveInfo?.how ?? '') : null,
  );
}

/** A hit thwacks, a yōkai getting away bwomps. Counted per wave, so a screen joining late stays quiet. */
let heard = { wave: -1, lastHit: 0, fled: 0 };
function raidSfx(game: KanaRaidView, fled: number): void {
  const lastHit = Math.max(0, ...game.horde.map((y) => y.hitAt ?? 0));
  if (heard.wave === game.wave) {
    if (lastHit > heard.lastHit) sfx('hit');
    if (fled > heard.fled) sfx('wrong');
  }
  heard = { wave: game.wave, lastHit, fled };
}

function names(view: RoomView): Map<string, string> {
  return new Map(view.players.map((p) => [p.id, p.name]));
}

const range = (chapters: number[]) => {
  const out: string[] = [];
  let start = chapters[0];
  for (let i = 0; i < chapters.length; i++) {
    const cur = chapters[i]!;
    const next = chapters[i + 1];
    if (next !== cur + 1) {
      out.push(start === cur ? `${cur}` : `${start}–${cur}`);
      start = next;
    }
  }
  return out.join(', ');
};

export const kanaRaidStage: StageMode<KanaRaidView> = {
  badge: (game, id) => {
    const pick = game.picks.find((p) => p.playerId === id);
    if (!pick) return '';
    return game.wave === 0 ? `${pick.ready ? '済 ' : ''}ch ${range(pick.chapters)}` : '';
  },

  render(view, game) {
    const who = names(view);
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'card raid-card' },
          h('p', { class: 'raid-title', lang: 'ja' }, 'かな妖怪レイド'),
          h('p', { class: 'big' }, 'The dictionary’s letters have escaped!'),
          h('p', { class: 'hint' }, 'On your phone, mark the kana chapters you’ve studied. Yōkai only attack you with kana you know. Shout their sounds to knock them out; tapping works too, just softer.'),
          h(
            'ul',
            { class: 'raid-picks' },
            game.picks.map((p) => h('li', { class: p.ready ? 'ready' : '' }, h('strong', {}, who.get(p.playerId) ?? '?'), ` chapters ${range(p.chapters)}`, p.ready ? h('span', { lang: 'ja' }, ' 済') : '')),
          ),
          game.ink ? h('p', { class: 'hint small' }, '🖌 Tonight ends in an Ink Storm: draw kana on your phones before the boss. (The VIP can switch it off.)') : null,
          game.placeholder ? h('p', { class: 'hint small' }, 'Using the built-in practice set (content not loaded).') : null,
        );
      case 'prompt':
        return h(
          'div',
          { class: 'card raid-card raid-banner' },
          h('p', { class: 'raid-wave-big' }, game.wave > game.waves ? 'BOSS' : `WAVE ${game.wave}`),
          game.waveInfo ? h('p', { class: 'raid-title' }, ruby({ text: game.waveInfo.titleJa, kana: game.waveInfo.titleKana })) : null,
          game.waveInfo ? h('p', { class: 'big' }, game.waveInfo.title) : null,
          game.waveInfo ? h('p', { class: 'hint' }, game.waveInfo.how) : null,
        );
      case 'answer':
        return arena(view, game);
      case 'reveal': {
        const r = game.waveResult;
        if (!r) return arena(view, game);
        return h(
          'div',
          { class: 'card raid-card' },
          h('p', { class: 'big' }, `Wave ${r.wave} over!`),
          h('p', { class: 'raid-result' }, h('span', { class: 'ok' }, `${r.defeated} caught`), ' · ', h('span', { class: 'miss' }, `${r.escaped} escaped`)),
          r.bestCombo >= 2 ? h('p', { class: 'hint' }, `Best team combo ×${r.bestCombo}`) : null,
          r.escapedChars.length
            ? h('div', { class: 'raid-escaped' }, h('p', { class: 'hint' }, 'Got away (they’ll haunt us):'), h('div', { class: 'raid-chips', lang: 'ja' }, r.escapedChars.map((c) => h('span', { class: 'raid-chip miss' }, c))))
            : h('p', { class: 'hint' }, 'Not one got away!'),
        );
      }
      case 'score': {
        const r = game.waveResult;
        const rows = [...(r?.players ?? [])].sort((a, b) => b.points - a.points);
        return h(
          'div',
          { class: 'card raid-card' },
          h('p', { class: 'big' }, `Wave ${r?.wave ?? ''} points`),
          h(
            'ol',
            { class: 'answers results' },
            // One row at a time, last place first, so the top scorer lands last.
            stagger(
              rows
                .map((p) =>
                  h('li', {}, h('span', { class: 'text' }, who.get(p.playerId) ?? '?'), h('span', { class: 'by' }, `${p.hits} hits · +${p.points}${p.bonus ? ` (${p.bonus} for speaking)` : ''}`)),
                )
                .reverse(),
              450,
              300,
            ).reverse(),
          ),
        );
      }
      case 'finale':
        return boss(game);
      case 'encore':
        return summary(game);
      default:
        return h('div', { class: 'card' }, h('p', { class: 'big' }, 'Look at your phone!'));
    }
  },
};

function boss(game: KanaRaidView): HTMLElement {
  const b = game.boss;
  if (!b) return h('div', { class: 'card' }, h('p', { class: 'big' }, 'The boss approaches…'));
  const broken = b.pieces.filter((x) => x.broken).length;
  return h(
    'div',
    { class: `raid-boss-stage${b.defeated ? ' defeated' : ''}${b.stage === 'blow' ? ' blow' : ''}` },
    h('p', { class: 'raid-wave-tag' }, 'BOSS · ', h('span', { lang: 'ja' }, 'ことば妖怪')),
    h(
      'div',
      { class: `raid-boss ${artOk ? 'art' : 'no-art'}` },
      // Beaten: the defeat sheet plays once behind the word, ending empty.
      b.defeated && artOk && isReady(BOSS_DEFEAT.src)
        ? h('div', { class: 'raid-boss-art sheet' }, spriteEl(BOSS_DEFEAT, 384, 'poof'))
        : h('div', { class: 'raid-boss-art' }),
      h(
        'div',
        { class: 'raid-boss-word', lang: 'ja' },
        b.pieces.map((x) =>
          h('div', { class: `raid-piece${x.broken ? ' broken' : ''}` }, h('span', { class: 'raid-piece-char' }, x.char), h('span', { class: 'raid-piece-who' }, x.broken ? `○ ${x.by ?? ''}` : (x.owner ?? '?'))),
        ),
      ),
    ),
    b.stage === 'break'
      ? h('p', { class: 'raid-how' }, `Break one piece each from your phone! ${broken} / ${b.pieces.length}`)
      : b.defeated
        ? h('p', { class: 'raid-blow', lang: 'ja' }, `${b.word}！ `, h('span', {}, `“${b.en}” · defeated!`))
        : h('p', { class: 'raid-blow', lang: 'ja' }, 'みんなで！ ', h('span', {}, `Read it aloud together: ${b.word}`)),
    b.stage === 'blow' ? h('p', { class: 'hint' }, `${b.readers.length} read it`) : null,
  );
}

function summary(game: KanaRaidView): HTMLElement {
  const s = game.summary;
  if (!s) return h('div', { class: 'card' }, h('p', { class: 'big' }, 'Raid over!'));
  return h(
    'div',
    { class: 'card raid-card' },
    h('p', { class: 'big' }, s.bossDefeated ? 'The Word Yōkai is beaten!' : 'The raid is over!'),
    h('p', { class: 'raid-result' }, h('span', { class: 'ok' }, `${s.defeated} yōkai caught tonight`), ' · ', h('span', { class: 'miss' }, `${s.escaped} escaped`), s.bestCombo >= 2 ? ` · best combo ×${s.bestCombo}` : ''),
    s.correct.length
      ? h('div', {}, h('p', { class: 'hint' }, 'Got right tonight:'), h('div', { class: 'raid-chips', lang: 'ja' }, s.correct.slice(0, 40).map((c) => h('span', { class: 'raid-chip ok' }, c.char, c.n > 1 ? h('small', {}, `×${c.n}`) : null))))
      : null,
    s.haunted.length ? h('div', {}, h('p', { class: 'hint' }, 'Haunted list (tricky ones and escapees):'), h('div', { class: 'raid-chips', lang: 'ja' }, s.haunted.slice(0, 30).map((c) => h('span', { class: 'raid-chip miss' }, c)))) : null,
    h('p', { class: 'hint small' }, 'A yōkai is truly caught after 3 right answers on separate days. Tonight’s tally is on your phone.'),
  );
}
