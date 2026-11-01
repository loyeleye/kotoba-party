// Yōkai Court (妖怪裁判) on the TV: Fude-san presides over a studio mystery.
//
//   case      the case scroll: the title in kanji with furigana, the accused, the evidence line.
//   ask       Fude-san's question to the witness (なにか 見ましたか？), the witness chip.
//   testify   what the witness said; a curveball adds a NEW SUSPECT card (the court gasps).
//   plan      the holding loop: both lawyer cards with a plan ring that turns ✓. Prosecution always left in
//             vermilion with the sealed scroll; defence right in sky blue with the sunflower badge and a dashed edge. Never what anyone picked.
//   record    ● REC with level bars on each lawyer still recording, ✓ Sent on the rest.
//   play      the speaker and a playhead only, prosecution then defence. Never words or pictures for a
//             spoken argument (the check is about it); typed words show, since they have no sound.
//   check     "Judges: one question, on your phone": lock-ins only, no words or pictures until all lock.
//   gist/vote both arguments side by side: pictures, the gist with furigana, English; "3 of 4 voted".
//   verdict   the tally (tokens drop into two pans), then the scroll: Fude-san herself writes 有罪 or 無罪
//             top to bottom in a brush face and signs it with her 筆 seal (lower left, ふで under it); the tie line,
//             then the points (the score ribbon holds its totals until they land): checks first, then the lawyers.
//   booth     the replay booth: the line, its chunk lit, one line of colour, the station tag.

import { h, LEVEL_LABELS, ruby, seatShape } from '../../../shared/src/dom.js';
import { ASK_MS, CASE_MS, CHECK_MS, TESTIFY_MS, CODA_AT_MS, GIST_MS, PLAN_MS, POINTS, POINTS_AT_MS, STAMP_AT_MS, TYPED_PLAY_MS, VOTE_MS, FUDE_PLAY_MS, TILE_READ_MS, type ArgView, type CourtView, type ThingView } from '../../../shared/src/modes/yokaiCourt/court.js';
import type { Side } from '../../../shared/src/modes/yokaiCourt/cases.js';
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
const levelLabel = (l: string): string => LEVEL_LABELS[l] ?? l.toUpperCase();

function seat(view: RoomView, id: string | null | undefined, cls = 'yc-chip'): HTMLElement {
  const s = playerOf(view, id)?.seat ?? 0;
  return h('span', { class: cls, style: seatVar(view, id) }, h('span', { class: 'yc-seat' }, `${seatShape(s)}${s}`), h('span', { class: 'yc-name' }, nameOf(view, id)));
}

// ---- pictures ----

const ART = (picture: string): string => `/stage/assets/${picture}.png`;
const missing = new Set<string>();

function pic(t: { picture: string; emoji: string }, cls = ''): HTMLElement {
  const emoji = () => h('span', { class: 'yc-emoji', 'aria-hidden': 'true' }, t.emoji);
  if (!t.picture || missing.has(t.picture)) return h('span', { class: `yc-pic ${cls}`, 'data-key': `e:${t.picture}` }, emoji());
  return h(
    'span',
    { class: `yc-pic ${cls}`, 'data-key': `i:${t.picture}` },
    h('img', {
      src: ART(t.picture),
      alt: '',
      draggable: 'false',
      onerror: (e: Event) => {
        missing.add(t.picture);
        (e.target as HTMLElement).replaceWith(emoji());
      },
    }),
  );
}

const thing = (t: ThingView, label: string, cls = ''): HTMLElement =>
  h('div', { class: `yc-thing ${cls}`, 'data-key': `${label}:${t.id}` }, h('p', { class: 'yc-label' }, label), pic(t), h('p', { class: 'yc-thing-ja', lang: 'ja' }, ruby(t.word)), h('p', { class: 'yc-thing-en' }, t.word.en));

type Role = Side | 'witness' | 'judge';
const ROLE_EMOJI: Record<Role, string> = { pros: '📜', def: '🌻', witness: '👁️', judge: '⚖️' };
const ROLE_NAME: Record<Role, string> = { pros: 'prosecution', def: 'defence', witness: 'witness', judge: 'judge' };

/** A role's pixel icon (the emoji if the picture is missing): a sealed scroll, a sunflower badge, a scale, an eye. */
function icon(role: Role, cls = 'yc-role-icon'): HTMLElement {
  const key = `court/role-${role}`;
  const emoji = () => h('span', { class: cls, 'aria-hidden': 'true' }, ROLE_EMOJI[role]);
  if (missing.has(key)) return emoji();
  return h('img', {
    class: cls,
    src: ART(key),
    alt: '',
    draggable: 'false',
    onerror: (e: Event) => {
      missing.add(key);
      (e.target as HTMLElement).replaceWith(emoji());
    },
  });
}

const SIDE: Record<Side, { icon: string; label: string; verdict: { text: string; kana: string }; en: string }> = {
  pros: { icon: '📜', label: 'PROSECUTION', verdict: { text: '有罪', kana: 'ゆうざい' }, en: 'guilty' },
  def: { icon: '🌻', label: 'DEFENCE', verdict: { text: '無罪', kana: 'むざい' }, en: 'not guilty' },
};

// ---- timing ----

function bar(ms: number, at: number, cls = 'yc-bar'): HTMLElement {
  const gone = Math.max(0, serverNow() - at);
  return h('div', { class: cls, 'data-key': `bar:${at}:${ms}` }, h('div', { class: 'yc-bar-fill', style: `animation-duration: ${ms}ms; animation-delay: -${Math.min(gone, ms)}ms` }));
}

function ring(ms: number, at: number, label: string): HTMLElement {
  const gone = Math.max(0, serverNow() - at);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'yc-ring-svg');
  svg.innerHTML = `<circle class="yc-ring-bg" cx="50" cy="50" r="42"/><circle class="yc-ring-arc" cx="50" cy="50" r="42" pathLength="100" style="animation-duration:${ms}ms;animation-delay:-${Math.min(gone, ms)}ms"/>`;
  return h('span', { class: 'yc-ring' }, svg, h('span', { class: 'yc-ring-label' }, label));
}

const once = new Set<string>();
const onceFor = (key: string, f: () => void) => {
  if (once.has(key)) return;
  once.add(key);
  f();
};

// ---- the frame ----

const LOGO = (): HTMLElement => h('span', { class: 'yc-band-ja', lang: 'ja' }, ruby({ text: '妖怪裁判', kana: 'ようかいさいばん' }));

function header(view: RoomView, game: CourtView): HTMLElement {
  return h(
    'div',
    { class: 'yc-head' },
    h('span', { class: 'yc-band' }, LOGO(), h('span', { class: 'yc-band-en' }, 'YŌKAI COURT')),
    h('span', { class: 'yc-caseno' }, `CASE ${game.round} / ${game.totalRounds}`),
    game.case ? h('span', { class: 'yc-accused-corner' }, pic(game.case.accused, 'yc-pic-small'), h('span', {}, h('span', { class: 'yc-label' }, 'ACCUSED '), h('span', { lang: 'ja' }, game.case.accused.word.kana))) : null,
  );
}

const step = (icon: string | HTMLElement, ...text: (string | HTMLElement)[]): HTMLElement => h('li', {}, h('span', { class: 'yc-step-icon', 'aria-hidden': 'true' }, icon), h('span', {}, ...text));

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'yc-stage yc-intro' },
    h('p', { class: 'yc-logo', lang: 'ja' }, ruby({ text: '妖怪裁判', kana: 'ようかいさいばん' })),
    h('p', { class: 'yc-subtitle' }, 'Yōkai Court · Fude-san presides'),
    h(
      'ol',
      { class: 'yc-steps' },
      step('🔍', 'A studio mystery goes to trial. Fude-san reads the case.'),
      step(icon('witness'), 'Fude-san asks the witness one question. A curveball can add a second suspect.'),
      step('🗣', 'Two lawyers, paired by level, plan in private and argue at the same time: ', icon('pros'), ' prosecution, then ', icon('def'), ' defence.'),
      step(icon('judge'), 'Everyone else answers one question about the arguments, then votes: who won you over? A tie is not guilty.'),
    ),
  );
}

// ---- the case and the witness ----

function caseScroll(game: CourtView, slim = false): HTMLElement | null {
  const c = game.case;
  if (!c) return null;
  return h(
    'div',
    { class: `yc-scroll${slim ? ' slim' : ''}` },
    h('p', { class: 'yc-scroll-tag' }, 'THE CASE'),
    h('p', { class: 'yc-scroll-ja', lang: 'ja' }, ruby(c.title)),
    h('p', { class: 'yc-scroll-en' }, c.title.en),
    slim ? null : h('p', { class: 'yc-scroll-scene' }, h('span', { lang: 'ja' }, ruby(c.scene)), ` · ${c.scene.en}`),
  );
}

function caseBeat(game: CourtView): HTMLElement {
  const c = game.case;
  onceFor(`case:${game.round}`, () => sfx('flip'));
  return h(
    'div',
    { class: 'yc-center yc-casebeat' },
    caseScroll(game),
    c ? h('div', { class: 'yc-things' }, thing(c.accused, 'ACCUSED', 'yc-accused'), thing(c.object, 'EVIDENCE')) : null,
    c ? h('p', { class: 'yc-caption' }, c.evidence) : null,
    bar(CASE_MS, game.stepAt),
  );
}

function askBeat(view: RoomView, game: CourtView): HTMLElement {
  const w = game.cast?.witness;
  return h(
    'div',
    { class: 'yc-center yc-askbeat' },
    caseScroll(game, true),
    h(
      'div',
      { class: 'yc-question' },
      h('p', { class: 'yc-label' }, 'FUDE-SAN ASKS THE WITNESS'),
      game.question ? h('p', { class: 'yc-question-ja', lang: 'ja' }, ruby(game.question)) : null,
      game.question ? h('p', { class: 'yc-question-en' }, game.question.en) : null,
      w ? h('p', { class: 'yc-witness' }, icon('witness'), ' ', seat(view, w), h('span', { class: 'yc-muted' }, ' · answering on their phone')) : h('p', { class: 'yc-muted' }, 'No witness this case.'),
    ),
    bar(ASK_MS, game.stepAt),
  );
}

function testifyBeat(view: RoomView, game: CourtView): HTMLElement {
  const t = game.testimony;
  const c = game.case;
  if (t?.kind === 'curve') onceFor(`curve:${game.round}`, () => sfx('wrong'));
  return h(
    'div',
    { class: 'yc-center yc-testifybeat' },
    h(
      'div',
      { class: 'yc-said-card' },
      h('p', { class: 'yc-label' }, game.cast?.witness ? `${nameOf(view, game.cast.witness).toUpperCase()} · WITNESS` : 'THE WITNESS'),
      t ? h('p', { class: 'yc-said-ja', lang: 'ja' }, ruby(t.line)) : null,
      t ? h('p', { class: 'yc-said-en' }, `“${t.line.en}”`) : null,
      t?.auto ? h('p', { class: 'yc-muted' }, 'No answer in time: the witness saw nothing.') : null,
      t?.said ? h('span', { class: 'yc-said-chip yc-pop' }, '🎤 said it') : null,
    ),
    // Only the curveball is a second suspect; "it was the fox" blames another yōkai.
    t?.suspect && c ? h('div', { class: 'yc-things' }, thing(c.accused, 'ACCUSED', 'yc-accused'), thing(t.suspect, t.kind === 'curve' ? 'NEW SUSPECT' : 'BLAMED', `yc-new${t.kind === 'curve' ? ' yc-pop' : ''}`)) : null,
    t?.kind === 'curve' ? h('p', { class: 'yc-big yc-pop' }, 'A second suspect! The court gasps.') : t ? h('p', { class: 'yc-caption' }, t.note) : null,
    bar(TESTIFY_MS, game.stepAt),
  );
}

// ---- plan and record ----

function lawyerCard(view: RoomView, game: CourtView, side: Side): HTMLElement | null {
  const id = side === 'pros' ? game.cast?.pros : game.cast?.def;
  if (!id) return null;
  const level = playerOf(view, id)?.level ?? 'n5';
  const ready = game.locked.ready.includes(id);
  const sent = game.locked.sent.includes(id);
  const recording = game.step === 'record';
  let mark: HTMLElement;
  let state: string;
  if (recording) {
    mark = sent ? h('span', { class: 'yc-done' }, '✓') : h('span', { class: 'yc-levels', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, (_, i) => h('span', { style: `--i: ${i}` })));
    state = sent ? '✓ Sent' : '● REC';
  } else {
    mark = ready ? h('span', { class: 'yc-done' }, '✓') : game.step === 'plan' ? ring(PLAN_MS, game.stepAt, 'PLAN') : h('span', { class: 'yc-wait' }, '…');
    state = ready ? (level === 'kana' ? '✓ Tiles picked' : '✓ Ready') : game.step === 'plan' ? 'Planning…' : 'Mission on its way';
  }
  const s = SIDE[side];
  return h(
    'div',
    { class: `yc-lawyer yc-side-${side}${(recording ? sent : ready) ? ' yc-in' : ''}${recording && !sent ? ' yc-rec-on' : ''}`, 'data-key': id },
    h('span', { class: 'yc-lawyer-mark' }, mark),
    h('p', { class: 'yc-lawyer-tag' }, icon(side), ` ${s.label} · `, h('span', { lang: 'ja' }, ruby(s.verdict))),
    seat(view, id),
    h('p', { class: 'yc-lawyer-level' }, levelLabel(level)),
    h('p', { class: 'yc-lawyer-state' }, state),
  );
}

function hunchChips(view: RoomView, game: CourtView): HTMLElement | null {
  const judges = game.cast?.judges ?? [];
  if (!judges.length) return null;
  return h(
    'div',
    { class: 'yc-locks' },
    h('span', { class: 'yc-label' }, 'Judges’ private hunches'),
    ...judges.map((id) => h('span', { class: `yc-lockchip${game.locked.hunches.includes(id) ? ' yc-in' : ''}`, 'data-key': id }, seat(view, id), game.locked.hunches.includes(id) ? h('span', { class: 'yc-lock' }, '✓') : h('span', { class: 'yc-wait' }, '…'))),
  );
}

function planBeat(view: RoomView, game: CourtView): HTMLElement {
  return h(
    'div',
    { class: 'yc-center yc-planbeat' },
    game.testimony ? h('p', { class: 'yc-witness-line', lang: 'ja' }, icon('witness'), ' ', ruby(game.testimony.line), h('span', { class: 'yc-muted' }, ` “${game.testimony.line.en}”`)) : null,
    h('div', { class: 'yc-lawyers' }, lawyerCard(view, game, 'pros'), h('span', { class: 'yc-vs' }, 'VS'), lawyerCard(view, game, 'def')),
    h('p', { class: 'yc-caption' }, 'Both lawyers plan in private, on missions written for this testimony. Judges: make a private hunch on your phone.'),
    hunchChips(view, game),
    bar(Math.max(1, (game.stepEndsAt ?? view.deadline ?? game.stepAt + PLAN_MS) - game.stepAt), game.stepAt),
  );
}

function recordBeat(view: RoomView, game: CourtView): HTMLElement {
  const cast = game.cast;
  const left = cast ? [cast.pros, cast.def].filter((id) => !game.locked.sent.includes(id)).length : 0;
  return h(
    'div',
    { class: 'yc-center yc-recordbeat' },
    left ? h('p', { class: 'yc-rec' }, h('span', { class: 'yc-rec-dot' }), 'REC') : h('p', { class: 'yc-big' }, '✓ Both arguments are in'),
    h('div', { class: 'yc-lawyers' }, lawyerCard(view, game, 'pros'), h('span', { class: 'yc-vs' }, 'VS'), lawyerCard(view, game, 'def')),
    h('p', { class: 'yc-caption' }, 'Both lawyers record at once. Prosecution plays first, then defence.'),
    bar(Math.max(1, view.deadline ? view.deadline - game.stepAt : 12_000), game.stepAt),
  );
}

// ---- hearing both sides ----

function playMs(p: NonNullable<CourtView['play']>): number {
  if (p.kind === 'clip' || (p.kind === 'tiles' && (p.clipId || p.local))) return p.durMs;
  if (p.kind === 'typed') return TYPED_PLAY_MS;
  if (p.kind === 'tiles') return TILE_READ_MS * 2;
  return FUDE_PLAY_MS[p.level];
}

function playBeat(view: RoomView, game: CourtView): HTMLElement | null {
  const p = game.play;
  if (!p) return null;
  const name = nameOf(view, p.playerId);
  if ((p.kind === 'clip' || p.kind === 'tiles') && p.clipId && !p.local && p.at) playClip(p.clipId, `court:${game.round}:${p.index}`, serverNow() - p.at);
  const s = SIDE[p.side];
  let body: (HTMLElement | null)[];
  if (p.hidden) body = [h('p', { class: 'yc-big' }, '🙈 Fude-san covers the microphone.')];
  else if (p.kind === 'typed' && p.text) {
    // Typed words have no sound, so they show as they play (player text: plain text only).
    const words = h('p', { class: 'yc-big yc-typed-line', lang: 'ja' });
    words.textContent = p.text;
    body = [words, bar(TYPED_PLAY_MS, p.at || serverNow(), 'yc-bar yc-playhead'), h('p', { class: 'yc-small' }, '⌨ Typed argument')];
  } else
    body = [
      h('div', { class: 'yc-wave', 'aria-hidden': 'true' }, ...Array.from({ length: 28 }, (_, i) => h('span', { style: `--i: ${i}` }))),
      bar(playMs(p), p.at || serverNow(), 'yc-bar yc-playhead'),
      h(
        'p',
        { class: 'yc-small' },
        p.kind === 'fude' ? (p.free ? '🖌 Fude-san stands in · ' : '🎙 Fude-san reads it · mic pass · ') : p.kind === 'tiles' && !p.clipId && !p.local ? '🖌 Fude-san reads the tiles · ' : p.local ? `🔊 Playing on ${name}’s phone · ` : !clipsHere() ? '🔇 It plays on the main TV · ' : '',
        'Words and pictures come after every check locks.',
      ),
    ];
  return h(
    'div',
    { class: 'yc-center yc-playbeat' },
    h(
      'div',
      { class: 'yc-lawyers two' },
      ...(['pros', 'def'] as Side[]).map((side) => {
        const id = side === 'pros' ? game.cast?.pros : game.cast?.def;
        const now = side === p.side;
        const done = side === 'pros' && p.side === 'def';
        return h(
          'div',
          { class: `yc-lawyer yc-side-${side}${now ? ' yc-now' : ''}`, 'data-key': `play:${side}` },
          h('p', { class: 'yc-lawyer-tag' }, `${SIDE[side].label} · ${side === 'pros' ? 1 : 2}/2${now ? ' · NOW' : ''}`),
          h('p', { class: 'yc-lawyer-verdict', lang: 'ja' }, ruby(SIDE[side].verdict)),
          seat(view, id),
          now ? h('div', { class: 'yc-now-body' }, ...body) : h('p', { class: 'yc-lawyer-state' }, done ? '✓ played' : 'next'),
        );
      }),
    ),
    h('p', { class: 'yc-small' }, icon(p.side), ` ${name} is arguing · ${levelLabel(p.level)}`),
  );
}

function checkBeat(view: RoomView, game: CourtView): HTMLElement {
  const judges = game.cast?.judges ?? [];
  const n = game.locked.checks.length;
  return h(
    'div',
    { class: 'yc-center yc-checkbeat' },
    h('p', { class: 'yc-big' }, 'Judges: one question about the arguments, on your phone.'),
    h('p', { class: 'yc-small' }, `+${POINTS.check} if right`),
    h(
      'div',
      { class: 'yc-lawyers two' },
      ...(['pros', 'def'] as Side[]).map((side) =>
        h('div', { class: `yc-lawyer yc-side-${side}`, 'data-key': `check:${side}` }, h('p', { class: 'yc-lawyer-tag' }, icon(side), ` ${SIDE[side].label}`), h('p', { class: 'yc-lawyer-verdict', lang: 'ja' }, ruby(SIDE[side].verdict)), seat(view, side === 'pros' ? game.cast?.pros : game.cast?.def), h('p', { class: 'yc-lawyer-state' }, 'Their words show after the check')),
      ),
    ),
    h('p', { class: 'yc-voted' }, n ? h('span', { class: 'yc-lock', 'data-key': `ok:${n}` }, '✓') : null, ` ${n} of ${judges.length} checks in`),
    bar(CHECK_MS, game.stepAt),
  );
}

/** Both sides in the same order: the words heard (theirs, or Fude-san's reading) large, then the English. */
function argCard(view: RoomView, a: ArgView): HTMLElement {
  const s = SIDE[a.side];
  let words: HTMLElement;
  if (a.subtitle) {
    words = h('p', { class: 'yc-arg-ja', lang: 'ja' });
    words.textContent = `「${a.subtitle}」`;
  } else words = h('p', { class: 'yc-arg-ja', lang: 'ja' }, '「', ruby(a.line ?? a.gist), '」');
  return h(
    'div',
    { class: `yc-arg yc-side-${a.side}`, 'data-key': `arg:${a.side}` },
    h('div', { class: 'yc-arg-head' }, h('p', { class: 'yc-lawyer-tag' }, icon(a.side), ' ', h('span', { lang: 'ja' }, ruby(s.verdict)), ` ${s.en}`), seat(view, a.playerId)),
    h('div', { class: 'yc-arg-body' },
      h('div', { class: 'yc-arg-pics' }, ...a.pics.map((t) => pic(t, 'yc-pic-card'))),
      h('div', { class: 'yc-arg-text' },
        a.hidden ? h('p', { class: 'yc-muted' }, 'Taken off the TV') : words,
        a.hidden ? null : h('p', { class: 'yc-arg-en' }, a.subtitle ? `Main claim: ${a.gist.en}` : (a.line ?? a.gist).en),
        a.pass || a.free ? h('p', { class: 'yc-chip yc-arg-chip' }, a.free ? '🖌 Fude-san stood in' : '🎙 Fude-san read it') : null,
      ),
    ),
  );
}

function voteBeat(view: RoomView, game: CourtView): HTMLElement {
  const n = game.locked.votes.length;
  const levels = game.args.map((a) => a.level);
  return h(
    'div',
    { class: 'yc-center yc-votebeat' },
    h('div', { class: 'yc-args' }, ...game.args.map((a) => argCard(view, a))),
    game.step === 'vote' ? h('p', { class: 'yc-voted' }, n ? h('span', { class: 'yc-lock', 'data-key': `ok:${n}` }, '✓') : null, ` ${n} of ${game.voters} voted`) : null,
    h('p', { class: 'yc-small' }, levels.length === 2 && levels[0] === levels[1] ? `Both lawyers are ${levelLabel(levels[0]!)}. Vote for who argued it better.` : 'Vote for who argued it better.'),
    bar(game.step === 'gist' ? GIST_MS : VOTE_MS, game.stepAt),
  );
}

// ---- the verdict ----

/** All the tokens drop within this, both pans at once, and each pan's count pops before the scroll unrolls over them. */
const TOKENS_MS = 1_000;
/** Fude-san's brush writes the verdict one character at a time, finishing as the seal lands (STAMP_AT_MS). */
const STROKE_MS = 320;
const BRUSH_AT_MS = STAMP_AT_MS - 2 * STROKE_MS;
/** The seal's fall: it touches the paper at STAMP_AT_MS, with Fude-san's line and the stamp sound. */
const SEAL_MS = 180;
/** Fude-san upside down, her topknot the brush tip (tools/art/sources/court/fude-write.py). */
const FUDE_WRITES = 'court/fude-write';

/**
 * Fude-san herself writes 有罪 or 無罪 top to bottom in a brush face, one character per stroke, upside down with
 * her topknot as the tip, then signs it: the square 筆 seal lands at the lower left of the column, as a seal
 * follows vertical writing, with ふで under it so the joke reads. The reading sits right of the column, since
 * furigana on vertical brush writing would crowd the strokes.
 */
function brushVerdict(verdict: { text: string; kana: string }, at: (ms: number) => string): HTMLElement {
  const chars = [...verdict.text];
  return h(
    'div',
    { class: 'yc-brush' },
    h('div', { class: 'yc-brush-sign' }, h('span', { class: 'yc-seal', lang: 'ja', style: at(STAMP_AT_MS - SEAL_MS) }, '筆'), h('span', { class: 'yc-seal-kana yc-pop', lang: 'ja', style: at(STAMP_AT_MS) }, 'ふで')),
    h(
      'div',
      { class: 'yc-brush-col' },
      h('p', { class: 'yc-brush-ja', lang: 'ja', 'aria-label': verdict.text }, ...chars.map((ch, i) => h('span', { class: 'yc-stroke', style: at(BRUSH_AT_MS + i * STROKE_MS) }, ch))),
      missing.has(FUDE_WRITES)
        ? null
        : h('img', { class: 'yc-brush-pen', src: ART(FUDE_WRITES), alt: '', draggable: 'false', style: `${at(BRUSH_AT_MS)}; animation-duration: ${chars.length * STROKE_MS + 250}ms`, onerror: (e: Event) => (missing.add(FUDE_WRITES), (e.target as HTMLElement).remove()) }),
    ),
    h('p', { class: 'yc-brush-kana yc-pop', lang: 'ja', style: at(STAMP_AT_MS) }, verdict.kana),
  );
}

function verdictBeat(view: RoomView, game: CourtView): HTMLElement | null {
  const v = game.verdict;
  if (!v) return null;
  const s = SIDE[v.winner];

  // Tokens alternate pans (a 3–3 tie never fills one side first), all in before the stamp. A TV that joins late
  // doesn't replay from zero: every delay counts from when the beat began.
  const since = Math.max(0, serverNow() - game.stepAt);
  // The stamp's sound at the seal's contact, counted from when the beat began (a TV that joins late skips it).
  const left = STAMP_AT_MS - since;
  if (left > -150) onceFor(`verdict:${game.round}`, () => sfx('right', Math.max(0, left) / 1000));
  const most = Math.max(v.pros, v.def, 1);
  const step = Math.min(500, TOKENS_MS / most);
  const at = (ms: number) => `animation-delay: ${ms - since}ms`;
  const pan = (side: Side, n: number) =>
    h(
      'div',
      { class: `yc-pan yc-side-${side}`, 'data-key': `pan:${side}` },
      h('p', { class: 'yc-lawyer-tag' }, icon(side), ' ', h('span', { lang: 'ja' }, ruby(SIDE[side].verdict))),
      h('div', { class: 'yc-tokens', 'aria-label': `${n} vote${n === 1 ? '' : 's'}` }, ...Array.from({ length: n }, (_, i) => h('span', { class: 'yc-token yc-drop', style: at(i * step + (side === 'def' ? step / 2 : 0)) }))),
      h('p', { class: 'yc-pan-n yc-pop', style: at(Math.min(Math.max(0, n - 1) * step + 300, BRUSH_AT_MS - 400)) }, String(n)),
    );
  const pts = (id: string) => v.points.find((p) => p.playerId === id)?.points ?? 0;
  const lawyers = game.cast ? [game.cast.pros, game.cast.def] : [];
  const checks = v.check.right;
  return h(
    'div',
    { class: 'yc-center yc-verdictbeat' },
    h(
      'div',
      { class: 'yc-floor' },
      h('div', { class: 'yc-scale' }, pan('pros', v.pros), h('p', { class: 'yc-score-n yc-pop', style: at(STAMP_AT_MS) }, `${v.pros} – ${v.def}`), pan('def', v.def)),
      h(
      'div',
      { class: `yc-hanko yc-unfurl`, style: at(BRUSH_AT_MS - 120) },
      h('p', { class: 'yc-label' }, h('span', { lang: 'ja' }, ruby({ text: '判決', kana: 'はんけつ' })), ' · VERDICT'),
      brushVerdict(s.verdict, at),
      h('p', { class: 'yc-hanko-en yc-pop', style: at(STAMP_AT_MS) }, v.tie ? `Not guilty · ${v.pros} to ${v.def}, and a tie is not guilty` : `${s.en[0]!.toUpperCase()}${s.en.slice(1)} · ${Math.max(v.pros, v.def)} to ${Math.min(v.pros, v.def)}`),
      v.tie ? h('p', { class: 'yc-tie yc-pop', lang: 'ja', style: at(STAMP_AT_MS) }, ruby({ text: '疑わしきは 罰せず。', kana: 'うたがわしきは ばっせず。' }), h('span', { class: 'yc-muted' }, ' When in doubt, no punishment.')) : null,
      ),
    ),
    h(
      'div',
      { class: 'yc-points-row yc-pop', style: at(POINTS_AT_MS) },
      h('p', { class: 'yc-small' }, 'Check: ', pic(v.check.answer, 'yc-pic-small'), h('span', { lang: 'ja' }, ` ${v.check.answer.word.kana}`), ` (${v.check.answer.word.en})`, v.check.valid ? (checks.length ? ` · right: ${checks.map((id) => nameOf(view, id)).join(', ')} +${POINTS.check}` : ' · nobody got it') : ' · not said, so it doesn’t score'),
      ...lawyers.map((id) => h('p', { class: 'yc-small', 'data-key': `pts:${id}` }, seat(view, id), ` +${pts(id)}`)),
    ),
    h('p', { class: 'yc-coda yc-pop', lang: 'ja', style: at(CODA_AT_MS) }, ruby(v.coda), h('span', { class: 'yc-coda-en' }, ` ${v.coda.en}`)),
  );
}

function boothBeat(view: RoomView, game: CourtView): HTMLElement | null {
  const b = game.booth;
  if (!b) return null;
  const at = b.line.indexOf(b.chunk);
  const shown = at >= 0 ? [b.line.slice(0, at), h('mark', { class: 'yc-chunk' }, b.chunk), b.line.slice(at + b.chunk.length)] : [b.line];
  return h(
    'div',
    { class: 'yc-center yc-booth' },
    h('div', { class: 'yc-booth-card' }, h('p', { class: 'yc-booth-tag' }, '🎙 REPLAY · ', nameOf(view, b.playerId).toUpperCase()), h('p', { class: 'yc-booth-line', lang: 'ja' }, ...shown)),
    h('p', { class: 'yc-booth-note yc-pop', style: 'animation-delay: 2500ms' }, h('mark', { class: 'yc-chunk yc-chunk-small', lang: 'ja' }, b.chunk), ' ', b.note),
    h('p', { class: 'yc-booth-map yc-pop', style: 'animation-delay: 4000ms' }, '🚃 ', b.tag),
  );
}

function badgeState(game: CourtView, playerId: string): string {
  const c = game.cast!;
  const lawyer = c.pros === playerId || c.def === playerId;
  const judge = c.judges.includes(playerId);
  switch (game.step) {
    case 'ask':
      return c.witness === playerId ? (game.testimony ? '✓ answered' : 'answering…') : '';
    case 'testify':
      return c.witness === playerId && game.testimony ? '✓ answered' : '';
    case 'plan':
      if (lawyer) return game.locked.ready.includes(playerId) ? '✓ ready' : 'planning…';
      return judge && game.locked.hunches.includes(playerId) ? '✓ hunch' : '';
    case 'record':
      return lawyer ? (game.locked.sent.includes(playerId) ? '✓ sent' : '● REC') : '';
    case 'play':
      return game.play?.playerId === playerId ? '▶ playing' : '';
    case 'check':
      return judge ? (game.locked.checks.includes(playerId) ? '✓' : 'checking…') : '';
    case 'vote':
      return judge ? (game.locked.votes.includes(playerId) ? '✓ voted' : 'voting…') : '';
    // The verdict's points show in the beat itself, after the stamp: the ribbon mustn't give the result away first.
    default:
      return '';
  }
}

function center(view: RoomView, game: CourtView): HTMLElement | null {
  switch (game.step) {
    case 'case':
      return caseBeat(game);
    case 'ask':
      return askBeat(view, game);
    case 'testify':
      return testifyBeat(view, game);
    case 'plan':
      return planBeat(view, game);
    case 'record':
      return recordBeat(view, game);
    case 'play':
      return playBeat(view, game);
    case 'check':
      return checkBeat(view, game);
    case 'gist':
    case 'vote':
      return voteBeat(view, game);
    case 'verdict':
      return verdictBeat(view, game);
    case 'booth':
      return boothBeat(view, game);
    default:
      return null;
  }
}

export const yokaiCourtStage: StageMode<CourtView> = {
  render(view, game) {
    if (view.phase === 'intro') return intro();
    if (!game.step) return h('div', { class: 'yc-stage' });
    return h('div', { class: `yc-stage yc-step-${game.step}` }, header(view, game), center(view, game));
  },
  badge(game, playerId) {
    const c = game.cast;
    if (!c || !game.step) return '';
    // Roles sit in the score ribbon, so nothing is cut off at the bottom of the beat. Same pixel icons as the court.
    const role: Role | null = c.pros === playerId ? 'pros' : c.def === playerId ? 'def' : c.witness === playerId ? 'witness' : c.judges.includes(playerId) ? 'judge' : null;
    const state = badgeState(game, playerId);
    if (!role) return state;
    return h('span', { class: 'yc-badge' }, icon(role, 'yc-role-icon yc-badge-icon'), ` ${ROLE_NAME[role]}${state ? ` · ${state}` : ''}`);
  },
  holdScoresUntil(view, game) {
    // The ribbon keeps last case's totals until the verdict's points land (after the tally, the brush and the seal).
    return view.phase === 'score' && game.step === 'verdict' ? game.stepAt + POINTS_AT_MS : null;
  },
  heldPoints(game, playerId) {
    return game.verdict?.points.find((p) => p.playerId === playerId)?.points ?? 0;
  },
  hostRow(view, game) {
    // The verdict keeps Fude-san's row up from the start, so her line at the seal doesn't push the court down.
    return view.phase === 'score' && game.step === 'verdict' ? { host: 'fude', side: null } : null;
  },
  hostHoldMs(view) {
    if (view.phase !== 'reveal') return 0;
    const left = clipLeft();
    return left > 0 ? Math.round(left * 1000) + 300 : 0;
  },
};
