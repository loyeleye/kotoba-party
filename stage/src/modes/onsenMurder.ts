// Murder at the Onsen on the TV: the case file, the suspects, the question and the suspect's
// answer (held back for a beat, then the English), the shared notebook, the accusation and the
// confession. Suspects speak with the browser's Japanese voice, each at their own pitch.

import { h } from '../../../shared/src/dom.js';
import type { OnsenView } from '../../../shared/src/modes/views.js';
import type { SuspectView } from '../../../shared/src/modes/onsenMurder/onsenMurder.js';
import type { JpText, OnsenIntent } from '../../../content/src/types.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

export const INTENT_ICON: Record<OnsenIntent, string> = { where: '📍', what: '❓', who: '👀', when: '🕙', victim: '💬', item: '🔎' };

// ---- speech ----

function jaVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();

const spoken = new Set<string>();
/** Says `kana` once per key, after `delayMs`, in a suspect's voice. */
function sayOnce(key: string, kana: string, voice: { pitch: number; rate: number }, delayMs: number): void {
  if (spoken.has(key)) return;
  spoken.add(key);
  const v = jaVoice();
  if (!v) return;
  setTimeout(
    () => {
      const u = new SpeechSynthesisUtterance(kana);
      u.lang = 'ja-JP';
      u.voice = v;
      u.pitch = Math.max(0, Math.min(2, voice.pitch));
      u.rate = Math.max(0.5, Math.min(1.5, voice.rate * 0.9));
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    },
    Math.max(0, delayMs),
  );
}

// ---- beats: the answer appears after the suspect "thinks", then the English ----

let beat = { key: '', at: 0 };
/** Ms since this beat began (first render of `key`). Survives re-renders. */
function sinceBeat(key: string): number {
  if (beat.key !== key) beat = { key, at: Date.now() };
  return Date.now() - beat.at;
}
/** An inline style that fades an element in `delayMs` after the beat began, across re-renders. */
const appearAfter = (delayMs: number, elapsed: number): string => `animation-delay: ${delayMs - elapsed}ms`;

// ---- pieces ----

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';
const san = (s: SuspectView): string => `${s.name.text}さん`;

function jpBlock(t: JpText, cls = ''): HTMLElement {
  return h('div', { class: `om-jp ${cls}` }, h('span', { class: 'om-ja', lang: 'ja' }, t.text), t.kana !== t.text ? h('span', { class: 'om-kana', lang: 'ja' }, t.kana) : null, h('span', { class: 'om-en' }, t.en));
}

function suspectCard(view: RoomView, game: OnsenView, s: SuspectView, opts: { active?: boolean; confused?: boolean; votes?: string[]; culprit?: boolean; dim?: boolean } = {}): HTMLElement {
  const cls = ['om-suspect', opts.active ? 'active' : '', opts.culprit ? 'culprit' : '', opts.dim ? 'dim' : ''].filter(Boolean).join(' ');
  return h(
    'div',
    { class: cls },
    h('span', { class: 'om-face' }, s.emoji),
    h('span', { class: 'om-name', lang: 'ja' }, san(s)),
    h('span', { class: 'om-role' }, `${s.name.en} · ${s.role.en}`),
    s.asked.length && !opts.votes ? h('span', { class: 'om-asked' }, s.asked.map((i) => INTENT_ICON[i]).join(' ')) : null,
    opts.confused ? h('span', { class: 'om-bubble om-confused', lang: 'ja' }, 'え？ もう いちど おねがいします。', h('small', {}, 'Huh? Once more, please.')) : null,
    opts.votes
      ? h(
          'span',
          { class: 'om-votes' },
          opts.votes.length ? opts.votes.map((id) => h('span', { class: `om-voter seat-${view.players.find((p) => p.id === id)?.seat ?? 0}` }, nameOf(view, id))) : h('span', { class: 'muted' }, 'no votes'),
        )
      : null,
    opts.culprit ? h('span', { class: 'om-stamp', lang: 'ja' }, 'はんにん') : null,
  );
}

function lineup(view: RoomView, game: OnsenView, opts: { activeId?: string | null; confusedId?: string | null } = {}): HTMLElement {
  return h(
    'div',
    { class: `om-lineup n${game.suspects.length}` },
    game.suspects.map((s) => suspectCard(view, game, s, { active: s.id === opts.activeId, confused: s.id === opts.confusedId })),
  );
}

function notebook(view: RoomView, game: OnsenView, opts: { reveal?: boolean; freshStyle?: string } = {}): HTMLElement {
  const fresh = game.current?.newClue ? game.current.clue?.text : undefined;
  return h(
    'div',
    { class: 'om-notebook' },
    h('p', { class: 'om-nb-title' }, '📝 てちょう · Notebook', h('span', { class: 'muted' }, ` ${game.notebook.length}`)),
    game.notebook.length
      ? h(
          'ol',
          { class: 'om-clues' },
          game.notebook.map((c) =>
            h(
              'li',
              { class: `${opts.reveal && c.key ? 'key' : ''} ${fresh === c.jp.text ? 'fresh om-appear' : ''}`.trim(), style: fresh === c.jp.text ? opts.freshStyle : null },
              h('span', { class: 'om-clue-ja', lang: 'ja' }, c.jp.text),
              h('span', { class: 'om-clue-en' }, c.jp.en, h('span', { class: 'muted' }, ` · ${nameOf(view, c.by)}`)),
            ),
          ),
        )
      : h('p', { class: 'muted om-empty' }, 'No clues yet. Ask good questions!'),
  );
}

function caseStrip(game: OnsenView): HTMLElement {
  const c = game.caseFile;
  return h(
    'div',
    { class: 'om-case' },
    h('span', { class: 'om-victim' }, c.victim.emoji),
    h('div', { class: 'om-case-text' }, h('span', { class: 'om-title', lang: 'ja' }, c.title.text), h('span', { class: 'om-sub' }, `${c.title.en} · ${c.victim.found.en}`)),
    h('span', { class: 'om-item', title: c.item.name.en }, c.item.emoji, h('small', { lang: 'ja' }, c.item.name.text)),
  );
}

// ---- screens ----

function introScreen(view: RoomView, game: OnsenView): HTMLElement {
  const c = game.caseFile;
  return h(
    'div',
    { class: 'om-stage om-intro' },
    h('p', { class: 'om-kicker', lang: 'ja' }, '温泉殺人事件 · Murder at the Onsen'),
    h('div', { class: 'om-file' }, h('span', { class: 'om-victim big' }, c.victim.emoji), h('div', {}, jpBlock(c.title, 'om-file-title'), jpBlock(c.setting), jpBlock({ ...c.victim.found, text: `${c.victim.name.text}は ${c.victim.found.text}`, kana: `${c.victim.name.kana}は ${c.victim.found.kana}` }))),
    lineup(view, game),
    h('p', { class: 'om-line' }, `Take turns questioning the suspects in Japanese, on your phone. Then name the culprit! Evidence: ${c.item.emoji} ${c.item.name.en}.`),
    game.fallback ? h('p', { class: 'muted' }, '(placeholder case: no cases loaded)') : null,
  );
}

function turnScreen(view: RoomView, game: OnsenView): HTMLElement {
  const turn = game.turn;
  const who = nameOf(view, turn?.playerId);
  return h(
    'div',
    { class: 'om-stage' },
    caseStrip(game),
    h(
      'div',
      { class: 'om-layout' },
      h(
        'div',
        { class: 'om-main' },
        h('p', { class: 'om-banner' }, `🎤 ${who}’s turn: pick a suspect and ask in Japanese`, h('span', { class: 'muted' }, ` · question ${turn?.no ?? 0} of ${turn?.total ?? 0}`)),
        lineup(view, game, { confusedId: turn?.miss?.suspectId ?? null }),
        turn?.miss ? h('p', { class: 'om-line muted' }, `Heard “${turn.miss.heard}”. One more try…`) : h('p', { class: 'om-line muted' }, 'Asked so far: 📍 where · ❓ doing what · 👀 who they saw · 🕙 bedtime · 💬 the victim · 🔎 the evidence'),
      ),
      notebook(view, game),
    ),
  );
}

function answerScreen(view: RoomView, game: OnsenView): HTMLElement {
  const cur = game.current;
  if (!cur) return turnScreen(view, game);
  const suspect = game.suspects.find((s) => s.id === cur.suspectId)!;
  const elapsed = sinceBeat(`ask:${cur.no}`);
  sayOnce(`ask:${cur.no}`, cur.answer.kana, suspect.voice, game.thinkMs - elapsed);
  const asked = h(
    'div',
    { class: 'om-q' },
    h('span', { class: 'om-who' }, `${nameOf(view, cur.playerId)} → ${san(suspect)}${cur.via === 'speech' ? ' 🎤' : cur.via === 'tap' ? ' 🧩' : ''}`),
    h('span', { class: 'om-heard', lang: 'ja' }, `「${cur.heard}」`),
    h('span', { class: 'om-natural' }, cur.guessed ? 'Best guess: ' : 'Natural: ', h('span', { lang: 'ja' }, cur.natural.text), h('span', { class: 'muted' }, ` · ${cur.natural.en}`)),
  );
  const thinking = h('span', { class: 'om-think', style: `animation-delay: ${-elapsed}ms; --think: ${game.thinkMs}ms` }, '…');
  const answer = h(
    'div',
    { class: 'om-a' },
    h('span', { class: 'om-face' }, suspect.emoji),
    h(
      'div',
      { class: 'om-bubble om-answer' },
      thinking,
      h('span', { class: 'om-ja om-appear', lang: 'ja', style: appearAfter(game.thinkMs, elapsed) }, cur.answer.text),
      cur.answer.kana !== cur.answer.text ? h('span', { class: 'om-kana om-appear', lang: 'ja', style: appearAfter(game.thinkMs, elapsed) }, cur.answer.kana) : null,
      h('span', { class: 'om-en om-appear', style: appearAfter(game.thinkMs + game.subtitleMs, elapsed) }, cur.answer.en),
    ),
  );
  const clue =
    cur.clue && cur.newClue
      ? h('div', { class: 'om-newclue om-appear', style: appearAfter(game.thinkMs + game.subtitleMs + 600, elapsed) }, `📝 New clue! +${cur.points}`, jpBlock(cur.clue))
      : cur.repeat
        ? h('p', { class: 'om-line muted om-appear', style: appearAfter(game.thinkMs, elapsed) }, 'Already asked: no new clue.')
        : cur.clue
          ? h('p', { class: 'om-line muted om-appear', style: appearAfter(game.thinkMs, elapsed) }, 'Already in the notebook.')
          : null;
  // Keyed by the question, so the next one replays the think-then-answer beat from the start.
  return h(
    'div',
    { class: 'om-stage', 'data-key': `ask:${cur.no}` },
    caseStrip(game),
    h('div', { class: 'om-layout' }, h('div', { class: 'om-main' }, asked, answer, clue), notebook(view, game, { freshStyle: appearAfter(game.thinkMs + game.subtitleMs + 600, elapsed) })),
  );
}

function accuseScreen(view: RoomView, game: OnsenView): HTMLElement {
  return h(
    'div',
    { class: 'om-stage' },
    caseStrip(game),
    h(
      'div',
      { class: 'om-layout' },
      h(
        'div',
        { class: 'om-main' },
        h('p', { class: 'om-banner om-accuse' }, '🔦 Who did it? Say it on your phone:'),
        h('p', { class: 'om-say', lang: 'ja' }, 'はんにんは ○○さんです！', h('small', {}, 'The culprit is ___!')),
        lineup(view, game),
        h(
          'p',
          { class: 'om-line' },
          `Accused: ${game.accused.length} / ${view.players.filter((p) => p.connected).length}`,
          game.accused.length ? h('span', { class: 'muted' }, ` · ${game.accused.map((id) => nameOf(view, id)).join(', ')}`) : null,
        ),
      ),
      notebook(view, game),
    ),
  );
}

function finaleScreen(view: RoomView, game: OnsenView): HTMLElement {
  const r = game.result;
  if (!r) return h('div', { class: 'om-stage' });
  const culprit = game.suspects.find((s) => s.id === r.culpritId)!;
  const elapsed = sinceBeat(`finale:${view.phaseSeq}`);
  sayOnce(`finale:${view.phaseSeq}`, r.confession.map((l) => l.kana).join(' '), culprit.voice, 2_500 - elapsed);
  const right = r.votes.filter((v) => v.correct).map((v) => nameOf(view, v.playerId));
  return h(
    'div',
    { class: 'om-stage om-finale' },
    h(
      'div',
      { class: `om-lineup n${game.suspects.length}` },
      game.suspects.map((s) =>
        suspectCard(view, game, s, {
          votes: r.votes.filter((v) => v.suspectId === s.id).map((v) => v.playerId),
          culprit: s.id === r.culpritId,
          dim: s.id !== r.culpritId,
        }),
      ),
    ),
    h(
      'div',
      { class: 'om-layout' },
      h(
        'div',
        { class: 'om-main' },
        h(
          'div',
          { class: 'om-reveal-head' },
          h('p', { class: 'om-banner om-reveal', lang: 'ja' }, `はんにんは ${san(culprit)} でした！`, h('span', { class: 'muted' }, ` The culprit was ${culprit.name.en}.`)),
          h('p', { class: 'om-line good' }, right.length ? `🔍 Solved by ${right.join(', ')} (+300)` : 'Nobody named the culprit this time!'),
        ),
        h(
          'div',
          { class: 'om-bubble om-confession' },
          r.confession.map((l, i) => h('div', { class: 'om-appear', style: appearAfter(1_500 + i * 2_200, elapsed) }, h('span', { class: 'om-ja', lang: 'ja' }, l.text), h('span', { class: 'om-en' }, l.en))),
        ),
        h(
          'div',
          { class: 'om-solution om-appear', style: appearAfter(1_500 + r.confession.length * 2_200, elapsed) },
          h('p', { class: 'om-line' }, r.solution),
          r.missed.length ? h('p', { class: 'om-line muted' }, `Key clues nobody found: ${r.missed.map((m) => m.en).join(' · ')}`) : null,
        ),
      ),
      notebook(view, game, { reveal: true }),
    ),
  );
}

export const onsenMurderStage: StageMode<OnsenView> = {
  badge(game, playerId) {
    const t = game.tally.find((x) => x.playerId === playerId);
    const turn = game.turn?.playerId === playerId ? '▶ ' : '';
    const acc = game.accused.includes(playerId) && !game.result ? ' ✓' : '';
    const right = game.result?.votes.find((v) => v.playerId === playerId)?.correct ? ' 🔍' : '';
    return `${turn}${t?.clues ? `📝${t.clues}` : ''}${acc}${right}`;
  },

  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return introScreen(view, game);
      case 'answer':
        return turnScreen(view, game);
      case 'reveal':
        return answerScreen(view, game);
      case 'encore':
        return accuseScreen(view, game);
      case 'finale':
        return finaleScreen(view, game);
      default:
        return h('div', { class: 'om-stage' }, caseStrip(game), notebook(view, game));
    }
  },
};
