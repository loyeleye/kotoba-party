// Katsuyō Raid (活用レイド) on the stage: the Green Car Kana Yōkai Raid. The same march to the gate as the kana
// raid (its arena and sprite classes from kanaRaid.css), but each yōkai is a verb on a talisman tag wearing a
// form badge on a sash. Wave 2 hides the badge behind a question mark; Wave 3's yōkai carry a little picture;
// the boss is a scroll whose line is never shown whole until it falls. The TV never shows a transcript: a
// caught chunk yōkai shows Fude's model chunk.
//
// Art: placeholders only (text badges and emoji, the existing yōkai sprites). Positions come from the server's
// spawn and escape times, played as CSS animations with a negative delay, as in kanaRaid.ts.

import { sfx } from '../music/sfx.js';
import { h, ruby, stagger } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import type { BadgeView, KatsuyoRaidView, KatsuyoYokaiView } from '../../../shared/src/modes/kanaRaid/katsuyoRaid.js';
import { KATSUYO_INK_WAVE } from '../../../shared/src/modes/kanaRaid/katsuyoRaid.js';
import { COMBO_WINDOW_MS } from '../../../shared/src/modes/kanaRaid/raidCore.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';
import { BOSS_DEFEAT, hitSheet, isReady, spriteEl } from '../sprites.js';

let clockOffset = Number.NEGATIVE_INFINITY;
let lastAt = -1;
function serverNow(game: KatsuyoRaidView): number {
  if (game.at !== lastAt) {
    lastAt = game.at;
    clockOffset = Math.max(clockOffset, game.at - Date.now());
  }
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
}

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
const leftAt = (frac: number) => 100 - Math.min(1, Math.max(0, frac)) * 108;
const TRACK_GAP = 120;
const trackLeft = (pct: number) => `calc(${pct}% - ${(pct * TRACK_GAP) / 100}px)`;

const names = (view: RoomView) => new Map(view.players.map((p) => [p.id, p.name]));

/** A badge as a sash: its icon and name (words, not colours), and an N3 tag. */
export function sash(b: BadgeView | null, cls = ''): HTMLElement {
  if (!b) return h('span', { class: `ky-sash hidden ${cls}`, title: 'Which badge?' }, '？');
  return h('span', { class: `ky-sash ${b.side} ${cls}`, lang: 'ja' }, h('span', { class: 'ky-sash-icon' }, b.icon), b.ja, b.side === 'n3' ? h('small', { class: 'ky-n3' }, 'N3') : null);
}

function yokaiEl(y: KatsuyoYokaiView, index: number, now: number, wide: boolean, who: Map<string, string>): HTMLElement | null {
  const total = Math.max(1, y.escapeAt - y.spawnAt);
  const lane = index % 3;
  const sprite = spriteFor(y.id);
  const classes = ['raid-yokai', `lane-${lane}`, artOk ? `art ${sprite}` : 'no-art', wide ? 'wide' : ''];
  const poof = artOk && isReady(hitSheet(sprite).src);
  let style: string;
  if (y.state === 'alive') {
    style = `--dur:${total}ms;--delay:${y.spawnAt - now}ms`;
    classes.push('marching');
  } else if (y.state === 'defeated' && y.endedAt !== null && now - y.endedAt < 1_800) {
    style = `left:${trackLeft(leftAt((y.endedAt - y.spawnAt) / total))}`;
    classes.push('defeated');
    if (!poof) classes.push('no-sheet');
  } else return null;
  if (y.hitAt !== null && now - y.hitAt < 600 && y.state === 'alive') classes.push('hit');
  const hpPct = Math.round((100 * y.hp) / Math.max(1, y.maxHp));
  return h(
    'div',
    { class: classes.filter(Boolean).join(' '), style, 'data-key': `${y.id}@${y.spawnAt}` },
    h(
      'div',
      { class: 'raid-yokai-inner' },
      h('div', { class: 'raid-hp' }, h('span', { style: `width:${hpPct}%` })),
      y.picture ? h('div', { class: 'ky-picture', 'aria-hidden': 'true' }, y.picture) : null,
      h(
        'div',
        {
          class: 'raid-body',
          style: !artOk ? '' : y.state === 'defeated' && poof ? `--art:url('/stage/assets/yokai/${sprite}.png')` : `background-image:url('/stage/assets/yokai/${sprite}.png');--art:url('/stage/assets/yokai/${sprite}.png')`,
        },
        y.state === 'defeated' && poof ? spriteEl(hitSheet(sprite), 128, 'poof') : null,
        h('span', { class: 'raid-tag ky-tag', lang: 'ja' }, h('span', { class: 'raid-kana' }, y.tag)),
      ),
      y.badge || y.hidden ? sash(y.badge) : null,
      y.aimedBy?.length ? h('div', { class: 'raid-aimers' }, `🎯 ${y.aimedBy.map((id) => who.get(id) ?? '?').join(', ')}`) : null,
    ),
    y.state === 'defeated' ? h('div', { class: 'raid-burst' }, '✦') : null,
    y.state === 'defeated' && y.model ? h('div', { class: 'ky-model', lang: 'ja' }, y.model) : null,
    y.state === 'defeated' && y.caughtBy ? h('div', { class: 'raid-catch' }, `${who.get(y.caughtBy) ?? '?'} +${y.caughtPoints ?? 0}`) : null,
  );
}

let heard = { wave: -1, lastHit: 0, fled: 0, chain: 0 };
function raidSfx(game: KatsuyoRaidView, fled: number): void {
  const lastHit = Math.max(0, ...game.horde.map((y) => y.hitAt ?? 0));
  const chain = game.chain?.at ?? 0;
  if (heard.wave === game.wave) {
    if (lastHit > heard.lastHit) sfx('hit');
    if (fled > heard.fled) sfx('wrong');
    // The badge chain's sting (placeholder: the synth's "right" until its own sting is made).
    if (chain > heard.chain) sfx('right');
  }
  heard = { wave: game.wave, lastHit, fled, chain };
}

function arena(view: RoomView, game: KatsuyoRaidView): HTMLElement {
  const now = serverNow(game);
  const ink = game.ink && game.wave === KATSUYO_INK_WAVE;
  const total = game.horde.length;
  const down = game.horde.filter((y) => y.state === 'defeated').length;
  const fled = game.horde.filter((y) => y.state === 'escaped' || (y.state === 'alive' && y.escapeAt <= now)).length;
  raidSfx(game, fled);
  const wide = game.wave === 3 || ink;
  const c = game.combo;
  const comboLeft = COMBO_WINDOW_MS - (now - c.lastAt);
  const comboLive = c.players >= 2 && c.count >= 2 && comboLeft > 0;
  const chainLive = game.chain && now - game.chain.at < 2_500;
  const who = names(view);
  return h(
    'div',
    { class: 'raid-stage ky-stage' },
    h(
      'div',
      { class: 'raid-top' },
      h('span', { class: 'raid-wave-tag' }, '🍀 ', `WAVE ${game.wave}`, game.waveInfo ? [' ', ruby({ text: game.waveInfo.titleJa, kana: game.waveInfo.titleKana })] : null),
      h('span', { class: 'raid-count' }, `👻 ${down} caught · ${fled} fled · ${Math.max(0, total - down - fled)} left`),
      h(
        'span',
        { class: `raid-combo${comboLive ? ' live' : ''}`, style: comboLive ? `--fade:${comboLeft}ms` : '' },
        comboLive ? `COMBO ×${c.count}` : c.best ? `best combo ×${c.best}` : 'combo: hit together!',
        comboLive ? h('span', { class: 'raid-combo-bar', 'data-key': `${c.lastAt}`, style: `--left:${(comboLeft / COMBO_WINDOW_MS).toFixed(3)};--fade:${comboLeft}ms` }) : null,
      ),
    ),
    chainLive ? h('div', { class: 'ky-chain', 'data-key': `chain@${game.chain!.at}` }, h('strong', {}, 'BADGE CHAIN!'), game.chain!.badges.map((b) => sash(b))) : null,
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

function inkStrip(view: RoomView, game: KatsuyoRaidView, now: number): HTMLElement {
  const who = names(view);
  return h(
    'div',
    { class: 'raid-inks' },
    game.inks.length ? null : h('p', { class: 'hint' }, '🖌 Write the kanji on your phones: your brush strokes appear here.'),
    game.inks.map((ink) =>
      h(
        'figure',
        { class: `raid-ink ${ink.ok ? (ink.clean ? 'clean' : 'ok') : 'miss'}` },
        inkSvg(ink.strokes, { strokeMs: 350, elapsedMs: Math.max(0, now - ink.at) }),
        h('figcaption', {}, h('strong', {}, who.get(ink.playerId) ?? '?'), ink.ok ? h('span', { lang: 'ja' }, ` ${ink.char} ${ink.clean ? '◎' : '○'}`) : ' ×'),
      ),
    ),
  );
}

function chart(game: KatsuyoRaidView): HTMLElement {
  const side = (s: 'n4' | 'n3', title: string) =>
    h(
      'div',
      { class: `ky-chart-side ${s}` },
      h('p', { class: 'ky-chart-head' }, title),
      game.chart
        .filter((b) => b.side === s)
        .map((b) => h('div', { class: 'ky-chart-row' }, sash(b), h('span', { class: 'ky-chart-en' }, b.en), h('span', { class: 'ky-chart-ex', lang: 'ja' }, b.example.kana))),
    );
  return h('div', { class: 'ky-chart' }, side('n4', 'N4 badges'), side('n3', 'N3 badges'));
}

export const katsuyoRaidStage: StageMode<KatsuyoRaidView> = {
  badge: (game, id) => {
    const pick = game.picks.find((p) => p.playerId === id);
    if (!pick || game.wave !== 0) return '';
    return `${pick.ready ? '済 ' : ''}${pick.level.toUpperCase()} · ${pick.badges.length} badges`;
  },

  render(view, game) {
    const who = names(view);
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'card raid-card' },
          h('p', { class: 'raid-title', lang: 'ja' }, '🍀 活用レイド'),
          h('p', { class: 'big' }, 'The verbs have put on their form badges!'),
          h('p', { class: 'hint' }, 'Each yōkai is a verb wearing a badge. Say the verb in that form to knock it out. Check your badges for tonight on your phone.'),
          chart(game),
          h(
            'ul',
            { class: 'raid-picks' },
            game.picks.map((p) => h('li', { class: p.ready ? 'ready' : '' }, h('strong', {}, who.get(p.playerId) ?? '?'), ` ${p.level.toUpperCase()} · ${p.badges.length} badges`, p.ready ? h('span', { lang: 'ja' }, ' 済') : '')),
          ),
          game.ink ? h('p', { class: 'hint small' }, '🖌 Tonight has an Ink Storm: write N4 and sign kanji on your phones before the boss. (The VIP can switch it off.)') : null,
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
            ? h('div', { class: 'raid-escaped' }, h('p', { class: 'hint' }, 'Got away (they’ll haunt us):'), h('div', { class: 'raid-chips ky-chips', lang: 'ja' }, r.escapedChars.slice(0, 16).map((c) => h('span', { class: 'raid-chip miss' }, c))))
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
            stagger(
              rows.map((p) => h('li', {}, h('span', { class: 'text' }, who.get(p.playerId) ?? '?'), h('span', { class: 'by' }, `${p.hits} hits · +${p.points}${p.bonus ? ` (${p.bonus} for speaking)` : ''}`))).reverse(),
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

function boss(game: KatsuyoRaidView): HTMLElement {
  const b = game.boss;
  if (!b) return h('div', { class: 'card' }, h('p', { class: 'big' }, 'The Sentence Yōkai unrolls…'));
  const broken = b.pieces.filter((x) => x.broken).length;
  return h(
    'div',
    { class: `raid-boss-stage ky-boss${b.defeated ? ' defeated' : ''}${b.stage === 'blow' ? ' blow' : ''}` },
    h('p', { class: 'raid-wave-tag' }, 'BOSS · ', h('span', { lang: 'ja' }, '文妖怪'), ' ', sash(b.badge)),
    h(
      'div',
      { class: `raid-boss ${artOk ? 'art' : 'no-art'}` },
      b.defeated && artOk && isReady(BOSS_DEFEAT.src) ? h('div', { class: 'raid-boss-art sheet' }, spriteEl(BOSS_DEFEAT, 384, 'poof')) : h('div', { class: 'raid-boss-art' }),
      h(
        'div',
        { class: 'ky-scroll' },
        h('p', { class: 'ky-gist' }, `“${b.gist}”`),
        h(
          'div',
          { class: 'ky-blots' },
          b.pieces.map((x) =>
            h('div', { class: `ky-blot${x.broken ? ' broken' : ''}` }, h('span', { class: 'ky-blot-verb', lang: 'ja' }, x.verb), sash(x.badge, 'small'), h('span', { class: 'raid-piece-who' }, x.broken ? `○ ${x.by ?? ''}` : (x.owner ?? '?'))),
          ),
        ),
      ),
    ),
    b.stage === 'break'
      ? h('p', { class: 'raid-how' }, `Break your piece from your phone: say its form! ${broken} / ${b.pieces.length}`)
      : b.defeated && b.line
        ? h('p', { class: 'raid-blow', lang: 'ja' }, `${b.line.kana}！ `, h('span', {}, 'defeated!'))
        : h('p', { class: 'raid-blow' }, 'みんなで！ ', h('span', {}, 'The finishing blow: say the whole line from the gist, from memory.')),
    b.stage === 'blow' ? h('p', { class: 'hint' }, `${b.readers.length} said it`) : null,
  );
}

function summary(game: KatsuyoRaidView): HTMLElement {
  const s = game.summary;
  if (!s) return h('div', { class: 'card' }, h('p', { class: 'big' }, 'Raid over!'));
  const line = game.boss?.line;
  return h(
    'div',
    { class: 'card raid-card' },
    h('p', { class: 'big' }, s.bossDefeated ? 'The Sentence Yōkai is beaten!' : 'The raid is over!'),
    h('p', { class: 'raid-result' }, h('span', { class: 'ok' }, `${s.defeated} yōkai caught tonight`), ' · ', h('span', { class: 'miss' }, `${s.escaped} escaped`), s.bestCombo >= 2 ? ` · best combo ×${s.bestCombo}` : ''),
    line ? h('p', { class: 'ky-line', lang: 'ja' }, line.kana, h('small', {}, ` “${line.en}”`)) : null,
    s.caught.length ? h('div', {}, h('p', { class: 'hint' }, 'Caught tonight:'), h('div', { class: 'raid-chips ky-chips', lang: 'ja' }, s.caught.slice(0, 24).map((c) => h('span', { class: 'raid-chip ok' }, c.label, c.n > 1 ? h('small', {}, `×${c.n}`) : null)))) : null,
    s.haunted.length ? h('div', {}, h('p', { class: 'hint' }, 'Haunted list (forms missed and escapees):'), h('div', { class: 'raid-chips ky-chips', lang: 'ja' }, s.haunted.slice(0, 20).map((c) => h('span', { class: 'raid-chip miss' }, c)))) : null,
    h('p', { class: 'hint small' }, 'Bare forms are practice. Chunks said with your own words, and the boss line said from memory, count toward the Limited Express.'),
  );
}
