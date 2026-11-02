// Late Again! on the TV: Pon's office of hopeless latecomers, drawn as a station departure board.
//
//   scene   the board flips to tonight's latecomer: "40 min late · the morning meeting", the cast with
//           their roles, and each voter's leaves.
//   plan    "Aiko is calling the boss…": the witness's three causes (everyone may bet on them), and
//           lock-in chips that flip without ever saying what was picked.
//   record  ● REC and a countdown bar. Nothing else: the room listens.
//   play    who is talking and a playhead. Never a picture or subtitle (that would answer the listening
//           check). A Kana excuse pops its tiles; a mic pass shows Pon reading it.
//   gist    the subtitle, the picture gist with a kana line, then the alibi card flips: a thread to the
//           cause when it matches, a puff of smoke for the tanuki.
//   vote    "The chief is deciding…": a leaf rises over each voter who has voted (never which way).
//   ruling  the chief's stamp (セーフ in sky blue ⭕, アウト in vermilion ❌), then the leaves (Safe turns them
//           into Pon's late pass, Out puffs them back), "Overruled by the room" when the call missed, points.
//   booth   the commentary booth: the line, its chunk lit, one line of colour, the train-line tag.
//   truth   "What really happened…", a pause, then the real story.
//
// The stage redraws on every update; the clip runs outside the render (dubAudio.ts), keyed per round.

import { h, ruby, seatShape } from '../../../shared/src/dom.js';
import type { LateView, TileView } from '../../../shared/src/modes/lateAgain/lateAgain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { sfx } from '../music/sfx.js';
import { clipLeft, clipsHere, playClip, serverNow } from './dubAudio.js';
import type { StageMode } from './types.js';

const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);
const nameOf = (view: RoomView, id: string | null | undefined): string => playerOf(view, id)?.name ?? '';
const seatVar = (view: RoomView, id: string | null | undefined): string | null => {
  const seat = playerOf(view, id)?.seat;
  return seat ? `--seat: var(--seat-${seat})` : null;
};

const ART = (picture: string): string => `/stage/assets/late/${picture}.png`;
const LEAF = '/stage/assets/late/leaf.png';
const SASH = '/stage/assets/late/sash.png';
const sash = (cls = 'la-sash'): HTMLElement => h('img', { class: cls, src: SASH, alt: '' });

function pic(t: TileView, cls = 'la-pic'): HTMLElement {
  // No picture yet (Green Car causes whose art is still to come): the emoji.
  if (!t.picture || t.picture === 'sorry' || t.picture === 'sound') return h('span', { class: `${cls} la-emoji`, 'aria-hidden': 'true' }, t.emoji);
  return h('img', { class: cls, src: ART(t.picture), alt: '', draggable: 'false' });
}

function tile(t: TileView, cls = ''): HTMLElement {
  return h('div', { class: `la-tile ${cls}`, 'data-key': t.id }, pic(t), h('span', { class: 'la-tile-ja', lang: 'ja' }, t.word.text), h('span', { class: 'la-tile-en' }, t.word.en));
}

function who(view: RoomView, id: string | null, role: string, icon: string | HTMLElement, extra: HTMLElement | null = null): HTMLElement {
  const seat = playerOf(view, id)?.seat ?? 0;
  return h(
    'div',
    { class: `la-who la-${role}`, style: seatVar(view, id), 'data-key': `${role}:${id ?? 'pon'}` },
    h('span', { class: 'la-role' }, icon),
    id ? h('span', { class: 'la-seat' }, `${seatShape(seat)}${seat}`) : null,
    h('span', { class: 'la-name' }, id ? nameOf(view, id) : 'Pon'),
    extra,
  );
}

function leaves(n: number): HTMLElement {
  return h('span', { class: 'la-leaves', 'aria-label': `${n} leaves` }, ...Array.from({ length: n }, () => h('img', { class: 'la-leaf', src: LEAF, alt: '' })), n === 0 ? h('span', { class: 'la-noleaf' }, 'no leaf') : null);
}

/** The cast strip: the latecomer, the witness, the chief, and every voter's leaves and lock-in. */
function cast(view: RoomView, game: LateView): HTMLElement | null {
  const c = game.cast;
  if (!c) return null;
  const voter = (id: string) => game.voters.find((v) => v.playerId === id);
  const voteMark = (id: string) => {
    const v = voter(id);
    if (!v) return null;
    const locked = game.step === 'vote' ? v.voted : game.step === 'plan' || game.step === 'record' ? (id === c.witness ? game.locked.alibi : game.locked.bets.includes(id)) : false;
    return h('span', { class: 'la-voter' }, leaves(v.leaves), locked ? h('span', { class: 'la-lock' }, '✓') : null);
  };
  return h(
    'div',
    { class: 'la-cast' },
    who(view, c.latecomer, 'late', '📞', game.locked.excuse && game.step === 'record' ? h('span', { class: 'la-lock' }, '✓') : null),
    who(view, c.witness, 'witness', '👀', c.witness ? voteMark(c.witness) : null),
    c.chief ? who(view, c.chief, 'chief', sash(), game.step === 'vote' && game.locked.called ? h('span', { class: 'la-lock' }, '✓') : null) : null,
    ...c.gallery.map((id) => who(view, id, 'gallery', '🍿', voteMark(id))),
  );
}

/** The departure board: who is late, how late, for what. */
function board(view: RoomView, game: LateView): HTMLElement | null {
  const sc = game.scene;
  if (!sc || !game.cast) return null;
  return h(
    'div',
    { class: 'la-board' },
    h('span', { class: 'la-board-tag', lang: 'ja' }, ruby({ text: '遅刻', kana: 'ちこく' })),
    h('span', { class: 'la-board-name', style: seatVar(view, game.cast.latecomer) }, nameOf(view, game.cast.latecomer)),
    h('span', { class: 'la-board-min', lang: 'ja' }, `+${sc.late.text}`, h('small', {}, ` ${sc.late.en}`)),
    h('span', { class: 'la-board-place' }, sc.emoji, ' ', ruby(sc.place), h('small', {}, ` ${sc.place.en}`)),
    h('span', { class: 'la-board-round' }, `${game.round}/${game.totalRounds}`),
  );
}

function bar(ms: number, at: number, cls = 'la-bar'): HTMLElement {
  const gone = Math.max(0, serverNow() - at);
  return h('div', { class: cls }, h('div', { class: 'la-bar-fill', style: `animation-duration: ${ms}ms; animation-delay: -${Math.min(gone, ms)}ms` }));
}

// One-shot sounds per moment: a redraw mustn't play them twice.
const once = new Set<string>();
const onceFor = (key: string, f: () => void) => {
  if (once.has(key)) return;
  once.add(key);
  f();
};

function intro(game: LateView): HTMLElement {
  return h(
    'div',
    { class: 'la-stage la-intro' },
    h('p', { class: 'la-logo', lang: 'ja' }, 'また ちこく！'),
    h('p', { class: 'la-subtitle' }, 'Late Again! · Pon’s office of hopeless latecomers'),
    game.coop ? h('p', { class: 'la-coop' }, `Two of you: beat Pon’s record of ${game.ponRecord} together!`) : null,
    h(
      'ol',
      { class: 'la-steps' },
      h('li', {}, '📞 One of you is late (again). Phone the boss and blame something.'),
      h('li', {}, '👀 The witness backs the story up without hearing it.'),
      h('li', {}, h('img', { class: 'la-leaf', src: LEAF, alt: '' }), ' Everyone else spends Pon’s leaves on “Safe”. Leaves are scarce!'),
      game.coop ? h('li', {}, sash(), ' The acting chief names what they blamed.') : h('li', {}, sash(), ' The acting chief calls セーフ or アウト, and scores by reading the room.'),
    ),
  );
}

function center(view: RoomView, game: LateView): HTMLElement | null {
  const late = game.cast?.latecomer ?? null;
  const name = nameOf(view, late);
  switch (game.step) {
    case 'scene':
      onceFor(`scene:${game.round}`, () => sfx('ring'));
      return h('div', { class: 'la-center la-scene' }, h('p', { class: 'la-big' }, `${name} is late. Again.`), h('p', { class: 'la-small' }, game.coop ? 'Pon is the witness. He probably saw it.' : 'Everyone else: here are your leaves. Spend them on “Safe”.'));
    case 'plan':
      return h(
        'div',
        { class: 'la-center la-plan' },
        h('p', { class: 'la-big la-ring' }, '📞 ', `${name} is calling the boss…`),
        h('p', { class: 'la-small' }, 'What will they blame? Bet on your phone.'),
        h('div', { class: 'la-tiles' }, ...game.options.map((t) => tile(t))),
      );
    case 'record':
      return h('div', { class: 'la-center la-record' }, h('p', { class: 'la-rec' }, h('span', { class: 'la-rec-dot' }), 'REC'), h('p', { class: 'la-big' }, `${name} is on the phone…`), bar(Math.max(1, view.deadline ? view.deadline - game.phaseAt : 9_000), game.phaseAt));
    case 'play':
      return play(view, game, name);
    case 'gist':
    case 'vote':
      return gist(view, game, name);
    case 'ruling':
      return ruling(view, game);
    case 'booth':
      return booth(game);
    case 'truth':
      return truth(game);
    default:
      return null;
  }
}

function play(view: RoomView, game: LateView, name: string): HTMLElement | null {
  const p = game.play;
  if (!p) return null;
  if (p.hidden) return h('div', { class: 'la-center' }, h('p', { class: 'la-big' }, '🙈 Pon covers the phone.'));
  if (p.kind === 'clip' && p.clipId && p.at) playClip(p.clipId, `late:${game.round}`, serverNow() - p.at);
  const head = h('p', { class: 'la-big', style: seatVar(view, game.cast?.latecomer) }, '🔊 ', p.kind === 'pon' ? (p.micPass ? `Pon reads ${name}’s excuse` : `Pon covers for ${name}`) : `${name}’s excuse`);
  if (p.kind === 'tiles')
    return h(
      'div',
      { class: 'la-center la-play' },
      head,
      h('div', { class: 'la-tiles la-said' }, ...p.tiles.map((t, i) => h('div', { class: 'la-pop', style: `animation-delay: ${i * 1100}ms`, 'data-key': `${t.id}:${i}` }, tile(t)))),
    );
  return h(
    'div',
    { class: 'la-center la-play' },
    head,
    h('div', { class: 'la-wave', 'aria-hidden': 'true' }, ...Array.from({ length: 24 }, (_, i) => h('span', { style: `--i: ${i}` }))),
    bar(p.kind === 'clip' ? p.durMs : 4_000, p.at || serverNow(), 'la-bar la-playhead'),
    p.kind === 'clip' && !clipsHere() ? h('p', { class: 'la-small' }, '🔇 The excuse plays on the main TV') : null,
    p.kind === 'typed' ? h('p', { class: 'la-small' }, '⌨ A typed excuse: it comes up next') : null,
  );
}

function gist(view: RoomView, game: LateView, name: string): HTMLElement | null {
  const g = game.gist;
  // Co-op: the cause stays hidden until the chief names it.
  if (!g) return game.coop ? h('div', { class: 'la-center' }, h('p', { class: 'la-big la-deciding' }, sash(), ` What did ${name} blame? ${nameOf(view, game.cast?.chief)} names it on their phone.`)) : null;
  const a = g.alibi;
  if (game.step === 'gist') onceFor(`gist:${game.round}`, () => sfx(a.match ? 'right' : a.curveball ? 'poof' : 'ticket', 1.3));
  const witness = game.cast?.witness ?? null;
  return h(
    'div',
    { class: `la-center la-gist${game.step === 'vote' ? ' la-dim' : ''}` },
    g.subtitle && !game.play?.hidden ? h('p', { class: 'la-sub', lang: 'ja' }, '「', g.subtitle, '」') : null,
    h(
      'div',
      { class: 'la-gist-row' },
      h('div', { class: 'la-gist-card' }, pic(g.cause, 'la-pic la-pic-big'), h('div', {}, h('p', { class: 'la-gist-label' }, `The gist of ${name}’s excuse`), h('p', { class: 'la-gist-ja', lang: 'ja' }, g.gist.text), h('p', { class: 'la-gist-en' }, g.gist.en))),
      a.pon && !witness
        ? null
        : h(
            'div',
            { class: `la-alibi${a.match ? ' la-match' : a.curveball ? ' la-curve' : ' la-miss'}` },
            h('p', { class: 'la-alibi-label' }, '👀 ', `${nameOf(view, witness)} “saw”:`),
            h('div', { class: 'la-flip' }, a.pick ? tile(a.pick, 'la-small-tile') : h('p', { class: 'la-small' }, 'nothing at all')),
            h('p', { class: 'la-alibi-verdict' }, a.match ? '✓ The story matches' : a.curveball ? '🍃 ドロン! A tanuki?!' : '✗ That’s not what they said'),
          ),
    ),
    game.step === 'vote' && !game.coop ? h('p', { class: 'la-big la-deciding' }, sash(), ` ${nameOf(view, game.cast?.chief)} is deciding… everyone else: give a leaf, or keep it.`) : null,
    game.step === 'vote' && !game.coop ? h('p', { class: 'la-holders' }, h('img', { class: 'la-leaf', src: LEAF, alt: '' }), ` ${game.holders} of ${game.voters.length} can say Safe`) : null,
    game.step === 'vote' ? bar(6_000, game.stepAt) : null,
  );
}

function ruling(view: RoomView, game: LateView): HTMLElement | null {
  const r = game.ruling;
  if (!r) return null;
  // The sound follows the stamp down.
  onceFor(`ruling:${game.round}`, () => sfx(r.tier === 'flop' ? 'wrong' : 'right', 0.35));
  const points =
    r.points.length
      ? h(
          'ul',
          { class: 'la-points' },
          ...r.points.map((p) => h('li', { style: seatVar(view, p.playerId), 'data-key': p.playerId }, h('span', { class: 'la-name' }, nameOf(view, p.playerId)), h('span', { class: 'la-pts' }, `+${p.points}`))),
        )
      : null;
  if (game.coop) {
    const right = !!r.coopPick && r.tier !== 'flop';
    return h(
      'div',
      { class: 'la-center la-ruling' },
      h('div', { class: `la-stamp la-${right ? 'safe' : 'out'}`, lang: 'ja' }, right ? 'せいかい！' : 'ざんねん！'),
      h('p', { class: 'la-small' }, right ? 'The chief named it.' : 'Not what they blamed.'),
      game.teamScore !== null && game.ponRecord !== null ? h('p', { class: 'la-holders' }, `Team ${game.teamScore} · Pon’s record ${game.ponRecord}`) : null,
      points,
    );
  }
  const call = r.call;
  const verdict = r.holders ? `${r.gave} of ${r.holders} gave a leaf` : r.voters ? 'Nobody had a leaf to give' : '';
  const room = r.roomSafe === true ? 'The room says: Safe' : r.roomSafe === false ? 'The room says: Out' : r.holders ? 'The room is split: the chief’s call stands' : '';
  const safe = r.roomSafe ?? call === 'safe';
  return h(
    'div',
    { class: 'la-center la-ruling' },
    call ? h('div', { class: `la-stamp la-${call}`, lang: 'ja' }, h('span', { class: `la-mark la-mark-${call}`, 'aria-hidden': 'true' }), call === 'safe' ? 'セーフ！' : 'アウト！') : h('p', { class: 'la-big' }, 'No call from the chief.'),
    r.overruled ? h('p', { class: 'la-overruled', lang: 'ja' }, `Overruled by the room · くうきが よめない！`) : null,
    verdict ? h('p', { class: 'la-leafcount' }, ...Array.from({ length: r.gave }, (_, i) => h('img', { class: 'la-leaf la-rise', src: LEAF, alt: '', style: `animation-delay: ${600 + i * 250}ms` })), ` ${verdict}`) : null,
    // Safe turns the leaves into Pon's late pass; Out puffs them back into leaves.
    r.gave && safe ? h('div', { class: 'la-pass la-pop', style: 'animation-delay: 1400ms' }, h('img', { class: 'la-cert', src: ART('certificate'), alt: '' }), h('span', { lang: 'ja' }, ruby({ text: 'ちこく しょうめいしょ' })), h('small', {}, 'Pon’s late pass')) : r.gave ? h('p', { class: 'la-small la-pop', style: 'animation-delay: 1400ms' }, '💨 ドロン! The leaves are just leaves again.') : null,
    room ? h('p', { class: 'la-small' }, room) : null,
    points,
  );
}

function booth(game: LateView): HTMLElement | null {
  const b = game.booth;
  if (!b) return null;
  const line = b.line;
  const at = line.indexOf(b.chunk);
  const shown = at >= 0 ? [line.slice(0, at), h('mark', { class: 'la-chunk' }, b.chunk), line.slice(at + b.chunk.length)] : [line];
  return h(
    'div',
    { class: 'la-center la-booth' },
    h('p', { class: 'la-booth-tag' }, '🎙 Pon’s commentary booth: the play of the round'),
    h('p', { class: 'la-booth-line', lang: 'ja' }, ...shown),
    at < 0 ? h('p', { class: 'la-booth-line', lang: 'ja' }, h('mark', { class: 'la-chunk' }, b.chunk)) : null,
    b.en ? h('p', { class: 'la-booth-en' }, 'Pon’s version: ', b.en) : null,
    h('p', { class: 'la-booth-note' }, b.note),
    h('p', { class: 'la-booth-map' }, '🚃 ', b.tag),
  );
}

export const lateAgainStage: StageMode<LateView> = {
  render(view, game) {
    if (view.phase === 'intro') return intro(game);
    return h('div', { class: 'la-stage' }, board(view, game), center(view, game), cast(view, game));
  },
  badge(game, playerId) {
    const c = game.cast;
    if (!c) return '';
    if (c.latecomer === playerId) return '📞';
    if (c.witness === playerId) return '👀';
    if (c.chief === playerId) return '🎀';
    return '';
  },
  hostHoldMs(view) {
    if (view.phase !== 'reveal') return 0;
    const left = clipLeft();
    return left > 0 ? Math.round(left * 1000) + 300 : 0;
  },
};

/** The round's last beat: what really happened (a cause nobody was dealt, or Pon). */
function truth(game: LateView): HTMLElement | null {
  const t = game.truth;
  if (!t) return null;
  // "What really happened…", a beat of silence, then the reveal.
  onceFor(`truth:${game.round}`, () => sfx('poof', t.pauseMs / 1000));
  const late = `animation-delay: ${t.pauseMs}ms`;
  return h(
    'div',
    { class: 'la-center la-truth' },
    h('p', { class: 'la-booth-tag' }, '🤫 What really happened…'),
    t.picture ? h('img', { class: 'la-pic la-pic-big la-pop', src: ART(t.picture), alt: '', style: late }) : h('span', { class: 'la-emoji la-pic-big la-pop', 'aria-hidden': 'true', style: late }, t.emoji),
    h('p', { class: 'la-gag la-pop', lang: 'ja', style: late }, ruby(t.line)),
    h('p', { class: 'la-small la-pop', style: late }, t.line.en),
  );
}
