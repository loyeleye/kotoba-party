// Murder at the Onsen on the phone: pick a suspect and ask your question in Japanese (say it,
// type it, or build it from tiles), the notebook, and the accusation 「はんにんは ○○さんです！」.
//
// An N4 player may be the turn's deputy: offered the part while someone asks ("not this time"
// keeps the ordinary part), then, after the answer, they say or type the report from the frame
// (＿と いっていました / ＿に ＿られました), or build it from shuffled word tiles if they need the words.
//
// The screen key only covers what this player is doing, so another player's accusation never
// rebuilds the talk button mid-sentence. The tile draft and the picked suspect live in module
// state, so a redraw keeps them.

import { h, mount } from '../../../shared/src/dom.js';
import { suspectPic, victimPic } from '../../../shared/src/art.js';
import type { JpText, Level, OnsenIntent } from '../../../content/src/types.js';
import type { OnsenView } from '../../../shared/src/modes/views.js';
import type { QuestionTile } from '../../../shared/src/modes/onsenMurder/questions.js';
import { calledName, joinTiles } from '../../../shared/src/modes/onsenMurder/questions.js';
import { joinReport, PASSIVE_NOTE, type ReportTile } from '../../../shared/src/modes/onsenMurder/deputy.js';
import { roleOffer } from '../components/roleOffer.js';
import { boothGist, galleryTile } from '../components/gallery.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<OnsenView>;

const INTENT_ICON: Record<OnsenIntent, string> = { where: '📍', what: '❓', who: '👀', when: '🕙', victim: '💬', item: '🔎' };
/** From N5 up, the tiles open after a say-it-first window (design doc: retrieval before recognition). */
const SAY_FIRST_MS = 5_000;

// ---- module state that survives redraws ----

let picked: { scope: string; suspectId: string | null } = { scope: '', suspectId: null };
let draft: { scope: string; tiles: QuestionTile[] } = { scope: '', tiles: [] };
const sayFirstFrom = new Map<string, number>();
let reportDraft: { scope: string; tiles: ReportTile[] } = { scope: '', tiles: [] };

/** When this answer's reveal first drew, so the fade-ins keep their timing when the screen redraws mid-answer. */
let revealAt = { scope: '', at: 0 };
function revealDelay(scope: string, ms: number): string {
  if (revealAt.scope !== scope) revealAt = { scope, at: Date.now() };
  return `animation-delay: ${ms - (Date.now() - revealAt.at)}ms`;
}

function reportDraftFor(scope: string): ReportTile[] {
  if (reportDraft.scope !== scope) reportDraft = { scope, tiles: [] };
  return reportDraft.tiles;
}

function pickedFor(scope: string): string | null {
  if (picked.scope !== scope) picked = { scope, suspectId: null };
  return picked.suspectId;
}

function draftFor(scope: string): QuestionTile[] {
  if (draft.scope !== scope) draft = { scope, tiles: [] };
  return draft.tiles;
}

// ---- pieces ----

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';

/** This phone's level, set on each render: every Japanese line follows it (components/jp.ts). */
let level: Level | null = null;

function jpLine(t: JpText): HTMLElement {
  return jpView(t, level, { cls: 'om-p-jp' });
}

function suspectButtons(game: OnsenView, selected: string | null, onPick: (id: string) => void): HTMLElement {
  return h(
    'div',
    { class: `om-p-suspects n${game.suspects.length}` },
    game.suspects.map((s) =>
      h(
        'button',
        { type: 'button', class: `om-p-suspect${s.id === selected ? ' on' : ''}`, onclick: () => onPick(s.id) },
        suspectPic(s, 'om-p-face'),
        h('span', { class: 'om-p-name', lang: 'ja' }, calledName(s).text),
        level === 'kana' ? h('small', { class: 'om-p-romaji' }, toRomaji(calledName(s).kana)) : null,
        h('small', {}, s.role.en),
        s.asked.length ? h('small', { class: 'om-p-asked' }, s.asked.map((i) => INTENT_ICON[i]).join('')) : null,
      ),
    ),
  );
}

function notebook(game: OnsenView, open = false): HTMLElement {
  return h(
    'details',
    { class: 'om-p-notebook', ...(open ? { open: true } : {}) },
    h('summary', {}, `📝 Notebook (${game.notebook.length} clue${game.notebook.length === 1 ? '' : 's'})`),
    game.notebook.length
      ? h(
          'ol',
          {},
          game.notebook.map((c) => h('li', {}, h('span', { lang: 'ja' }, c.jp.text), h('small', {}, c.jp.en))),
        )
      : h('p', { class: 'hint' }, 'No clues yet.'),
  );
}

function caseCard(game: OnsenView): HTMLElement {
  const c = game.caseFile;
  return h(
    'div',
    { class: 'om-p-case' },
    victimPic(c.id, c.victim.emoji, 'om-p-victim'),
    h('div', {}, h('p', { class: 'om-p-title', lang: 'ja' }, c.title.text, h('small', {}, ` ${c.title.en}`)), h('p', { class: 'hint' }, c.victim.found.en), h('p', { class: 'hint' }, `Evidence: ${c.item.emoji} ${c.item.name.en}`)),
  );
}

// ---- asking ----

function tileBuilder(ctx: Ctx, scope: string, suspectId: string): HTMLElement {
  const { game, me, send } = ctx;
  const mine = game.mine!;
  const kana = me.level === 'kana';
  const tiles = draftFor(scope);
  const preview = h('p', { class: 'om-p-preview', lang: 'ja' });
  const sendBtn = h('button', { type: 'button', class: 'secondary om-p-send' }, 'Ask with tiles') as HTMLButtonElement;
  const undo = h('button', { type: 'button', class: 'secondary' }, '⌫') as HTMLButtonElement;
  const draw = () => {
    const text = joinTiles(tiles);
    preview.textContent = text || 'Tap tiles to build a question';
    preview.classList.toggle('empty', !text);
    sendBtn.disabled = !text;
    undo.disabled = !tiles.length;
  };
  sendBtn.onclick = () => {
    const text = joinTiles(tiles);
    if (text) void send({ kind: 'ask', suspectId, utterance: { via: 'tap', text } });
  };
  undo.onclick = () => {
    tiles.pop();
    draw();
  };
  draw();
  const grid = h(
    'div',
    { class: 'om-p-tiles' },
    mine.tiles.map((t) =>
      h(
        'button',
        {
          type: 'button',
          class: `om-p-tile ${t.kind}`,
          onclick: () => {
            if (tiles.length < 8) tiles.push(t);
            draw();
          },
        },
        h('span', { lang: 'ja' }, t.text),
        h('small', {}, kana ? `${toRomaji(t.kana)} · ${t.en}` : t.en),
      ),
    ),
  );
  return h('div', { class: 'om-p-builder' }, preview, h('div', { class: 'om-p-row' }, sendBtn, undo), grid, h('p', { class: 'hint' }, 'Tip: build it, then say it with the green button for the 🎤 bonus.'));
}

function tilesPanel(ctx: Ctx, scope: string, suspectId: string): HTMLElement {
  const holder = h('div', { class: 'om-p-tilespanel' });
  if (ctx.me.level === 'kana') {
    holder.append(tileBuilder(ctx, scope, suspectId));
    return holder;
  }
  if (!sayFirstFrom.has(scope)) sayFirstFrom.set(scope, Date.now());
  if (sayFirstFrom.size > 50) sayFirstFrom.delete(sayFirstFrom.keys().next().value!);
  const wait = Math.max(0, SAY_FIRST_MS - (Date.now() - sayFirstFrom.get(scope)!));
  const btn = h('button', { type: 'button', class: 'linkish' }, wait ? 'Say it first… tiles open in a moment' : '🧩 Stuck? Build it from tiles') as HTMLButtonElement;
  btn.disabled = wait > 0;
  btn.onclick = () => mount(holder, tileBuilder(ctx, scope, suspectId));
  if (wait) setTimeout(() => ((btn.disabled = false), (btn.textContent = '🧩 Stuck? Build it from tiles')), wait);
  if (draft.scope === scope && draft.tiles.length) holder.append(tileBuilder(ctx, scope, suspectId));
  else holder.append(btn);
  return holder;
}

function menu(game: OnsenView): HTMLElement {
  const mine = game.mine!;
  return h(
    'details',
    { class: 'om-p-menu' },
    h('summary', {}, 'What could I ask?'),
    h(
      'ul',
      {},
      mine.menu.map((m) => h('li', {}, `${INTENT_ICON[m.intent]} ${m.en}`, m.jp ? h('span', { class: 'om-p-menu-jp', lang: 'ja' }, ` ${m.jp.text}`, h('small', {}, ` ${toRomaji(m.jp.kana)}`)) : null)),
    ),
  );
}

function askScreen(ctx: Ctx): HTMLElement {
  const { view, game, me, send } = ctx;
  const mine = game.mine!;
  const scope = `${view.phaseSeq}`;
  const root = h('div', { class: 'screen om-p' });
  const draw = () => {
    const suspectId = mine.miss?.suspectId && pickedFor(scope) === null ? mine.miss.suspectId : pickedFor(scope);
    const suspect = game.suspects.find((s) => s.id === suspectId);
    const pick = (id: string) => {
      picked = { scope, suspectId: id };
      draw();
    };
    if (!suspect) {
      mount(root, h('p', { class: 'big' }, 'Your turn! Who will you question?'), suspectButtons(game, null, pick), menu(game), notebook(game));
      return;
    }
    mount(
      root,
      h('p', { class: 'big' }, h('span', {}, `Ask ${suspect.emoji} `), h('span', { lang: 'ja' }, calledName(suspect).text)),
      h('button', { type: 'button', class: 'linkish om-p-change', onclick: () => ((picked = { scope, suspectId: null }), draw()) }, 'Change suspect'),
      mine.miss
        ? h(
            'div',
            { class: 'om-p-miss' },
            h('p', {}, `${suspect.emoji} 「え？　もう いちど おねがいします。」`, h('small', {}, ` Huh? Once more, please. (heard “${mine.miss.heard}”)`)),
            mine.miss.hint ? h('div', {}, h('p', { class: 'hint' }, 'Did you mean:'), jpLine(mine.miss.hint)) : h('p', { class: 'hint' }, 'Start with a question word: どこ (where), なに (what), だれ (who), なんじ (what time), どんな (what kind).'),
          )
        : null,
      speakBox({
        label: 'Hold and ask your question',
        placeholder: 'Type your question (kana)',
        kanaPadOpen: false,
        onSend: (utterance) => void send({ kind: 'ask', suspectId: suspect.id, utterance }),
      }),
      tilesPanel(ctx, scope, suspect.id),
      menu(game),
      h('p', { class: 'hint' }, 'Asking aloud earns a 🎤 bonus. A new clue is +100.'),
    );
  };
  draw();
  return root;
}

// ---- the deputy (N4 hard role) ----

/** While someone asks: the offer, or what the deputy chose. */
function deputyOffer(ctx: Ctx): HTMLElement | null {
  const d = ctx.game.mine?.deputy;
  if (!d) return null;
  if (d.status === 'declined') return h('p', { class: 'hint om-p-deputy' }, '🕵️ No deputy work this turn. Just watch!');
  const frames = [h('p', { class: 'om-p-frame', lang: 'ja' }, '＿と いっていました ／ ＿に ＿られました'), h('p', { class: 'hint om-p-note' }, PASSIVE_NOTE)];
  if (d.status === 'ready')
    return h('div', { class: 'om-p-deputy' }, h('p', {}, h('strong', {}, '🕵️ Deputy for this turn.'), ' Ready! Listen to the answer.'), ...frames);
  return h(
    'div',
    { class: 'om-p-deputy' },
    roleOffer({
      kicker: '🕵️ Chōchin-san needs a deputy this turn.',
      role: { text: 'じょしゅ', kana: 'じょしゅ', en: 'Deputy' },
      pitch: 'After the answer, tell the room what the suspect said, with one of these:',
      onTake: () => void ctx.send({ kind: 'deputy', accept: true }),
      onDecline: () => void ctx.send({ kind: 'deputy', accept: false }),
      extra: frames,
    }),
  );
}

/** After the answer: build the report from the tiles, or say or type it. */
function deputyReport(ctx: Ctx): HTMLElement | null {
  const { view, game, send } = ctx;
  const d = game.mine?.deputy;
  if (!d || d.status === 'declined') return null;
  if (d.status === 'reported')
    return h('div', { class: 'om-p-deputy' }, h('p', {}, h('strong', {}, d.points ? `🕵️ Reported! +${d.points}` : '🕵️ Reported! The room heard it.')), d.line ? jpLine(d.line) : null);
  if (d.status === 'missed')
    return h('div', { class: 'om-p-deputy' }, h('p', {}, '🕵️ Nice try, deputy. The report:'), d.line ? jpLine(d.line) : null);
  if (!d.canReport) return null;
  const scope = `${view.phaseSeq}`;
  const picked = reportDraftFor(scope);
  const preview = h('p', { class: 'om-p-preview', lang: 'ja' });
  const sendBtn = h('button', { type: 'button', class: 'secondary om-p-send' }, 'Report with tiles') as HTMLButtonElement;
  const undo = h('button', { type: 'button', class: 'secondary' }, '⌫') as HTMLButtonElement;
  const grid = h('div', { class: 'om-p-tiles' });
  const draw = () => {
    const text = joinReport(picked);
    preview.textContent = text || 'Tap the words in order';
    preview.classList.toggle('empty', !text);
    sendBtn.disabled = picked.length !== d.need;
    undo.disabled = !picked.length;
    mount(
      grid,
      d.tiles
        .filter((t) => !picked.some((x) => x.id === t.id))
        .map((t) =>
          h(
            'button',
            {
              type: 'button',
              class: 'om-p-tile word',
              onclick: () => {
                picked.push(t);
                draw();
              },
            },
            h('span', { lang: 'ja' }, t.text),
          ),
        ),
    );
  };
  sendBtn.onclick = () => {
    void send({ kind: 'report', tiles: picked.map((t) => t.id) });
    picked.length = 0;
  };
  undo.onclick = () => {
    picked.pop();
    draw();
  };
  draw();
  return h(
    'div',
    // Fades in once the answer and its subtitle are up, so the tiles don't give the answer away first.
    { class: 'om-p-deputy report', style: revealDelay(`${view.phaseSeq}`, game.thinkMs + game.subtitleMs) },
    h('p', {}, h('strong', {}, '🕵️ Deputy: tell the room what they said.'), d.n3 ? h('span', { class: 'om-p-n3-tag' }, ' N3') : null),
    d.frame ? h('p', { class: 'om-p-frame', lang: 'ja' }, d.frame) : null,
    d.notes.map((n) => h('p', { class: 'hint om-p-note' }, n)),
    d.heard ? h('p', { class: 'om-p-missline' }, `Heard “${d.heard}”. ${d.triesLeft} try left.`) : null,
    d.line ? h('div', {}, h('p', { class: 'hint' }, 'Like this:'), jpLine(d.line)) : null,
    // Green Car, an N4 deputy: the N3 retelling as a stretch; either line counts.
    d.stretch
      ? h(
          'div',
          { class: 'om-p-stretch' },
          h('p', { class: 'hint' }, h('span', { class: 'om-p-n3-tag' }, 'N3 stretch '), 'or pass it on like this:'),
          h('p', { class: 'om-p-frame', lang: 'ja' }, d.stretch.frame),
          h('p', { class: 'hint om-p-note' }, d.stretch.note),
          d.stretch.line ? jpLine(d.stretch.line) : null,
        )
      : null,
    speakBox({
      label: 'Hold and report it',
      placeholder: d.frame ?? '…と いっていました',
      kanaPadOpen: false,
      onSend: (utterance) => void send({ kind: 'report', utterance }),
    }),
    // The tiles are the fallback: say it from the frame first, build it if you need the words.
    h(
      'details',
      {
        class: 'om-p-tiles-help',
        ...(d.heard || d.peeked ? { open: true } : {}),
        // Opening the tiles before a first try: the server notes the report as read, not recalled.
        ontoggle: (e: Event) => {
          if ((e.target as HTMLDetailsElement).open && !d.heard && !d.peeked) void send({ kind: 'report-peek' });
        },
      },
      h('summary', {}, 'Need the words? Build it from tiles (one is a spare)'),
      h('div', { class: 'om-p-builder' }, preview, h('div', { class: 'om-p-row' }, sendBtn, undo), grid),
    ),
    d.heard ? null : h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'deputy', accept: false }) }, 'Not this time after all'),
    h('p', { class: 'hint' }, 'Saying it aloud earns the 🎤 bonus.'),
  );
}

// ---- accusing ----

function accuseScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const mine = game.mine!;
  if (mine.accusation) {
    const s = game.suspects.find((x) => x.id === mine.accusation!.suspectId);
    return h(
      'div',
      { class: 'screen om-p' },
      h('p', { class: 'big' }, `You accused ${s?.emoji ?? ''} ${s ? calledName(s).text : ''}`),
      h('p', { class: 'hint' }, mine.accusation.said ? 'Said like a real detective! 🎤' : 'Vote locked in.'),
      waiting('Waiting for the others…'),
      notebook(game, true),
    );
  }
  const scope = `${view.phaseSeq}`;
  const root = h('div', { class: 'screen om-p' });
  const draw = () => {
    const chosen = pickedFor(scope) ?? mine.accuseTry?.suspectId ?? null;
    const suspect = game.suspects.find((s) => s.id === chosen);
    const pick = (id: string) => {
      picked = { scope, suspectId: id };
      draw();
    };
    const line = suspect ? mine.lines.find((l) => l.suspectId === suspect.id)?.line : undefined;
    const stretch = suspect ? mine.stretchLines?.find((l) => l.suspectId === suspect.id)?.line : undefined;
    mount(
      root,
      h('p', { class: 'big' }, '🔦 Who did it?'),
      suspectButtons(game, chosen, pick),
      suspect && line
        ? h(
            'div',
            { class: 'om-p-accuse' },
            h('p', { class: 'hint' }, 'Say it out loud:', mine.accuseN3 ? h('span', { class: 'om-p-n3-tag' }, ' N3') : null),
            jpLine(line),
            stretch ? h('div', { class: 'om-p-stretch' }, h('p', { class: 'hint' }, h('span', { class: 'om-p-n3-tag' }, 'N3 stretch '), 'or say it like this:'), jpLine(stretch)) : null,
            mine.accuseTry && mine.accuseTry.suspectId === suspect.id
              ? h('p', { class: 'om-p-missline' }, `Heard “${mine.accuseTry.heard}”. ${mine.accuseN3 ? 'Say the name with ＿に ちがいない or ＿はずが ない.' : 'Say はんにん and the name.'} ${mine.accuseTry.triesLeft} try left.`)
              : null,
            speakBox({
              label: 'Hold and accuse!',
              placeholder: mine.accuseN3 ? 'はんにんは …さんに ちがいない' : 'はんにんは …さんです',
              onSend: (utterance) => void send({ kind: 'accuse', suspectId: suspect.id, utterance }),
            }),
            h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'accuse', suspectId: suspect.id }) }, 'Vote without saying it'),
          )
        : h('p', { class: 'hint' }, mine.accuseN3 ? 'Pick a suspect, then say 「はんにんは（name）さんに ちがいない！」 or your line for the 🎤 bonus.' : 'Pick a suspect, then say 「はんにんは（name）さんです！」 for the 🎤 bonus.'),
      notebook(game, true),
    );
  };
  draw();
  return root;
}

// ---- the mode ----

export const onsenMurderPhone: PhoneMode<OnsenView> = {
  key: (view, game) =>
    [view.phaseSeq, game.turn?.playerId, JSON.stringify(game.mine && { ...game.mine, menu: null, tiles: null, lines: null }), game.notebook.length, game.current?.no, game.current?.answer.text, !!game.result].join('|'),

  render(ctx) {
    const { view, game, me } = ctx;
    level = ctx.me.level;
    const mine = game.mine;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen om-p' },
          h('p', { class: 'big', lang: 'ja' }, '温泉殺人事件'),
          caseCard(game),
          h('p', {}, 'Take turns questioning the suspects in Japanese. Each answer may hold a clue for the shared notebook.'),
          h('p', {}, 'At the end, everyone names the culprit: 「はんにんは（name）さんです！」'),
          h('p', { class: 'hint' }, 'Ask aloud for a bonus. Typing, or building from tiles, works too.'),
        );
      case 'answer':
        if (mine?.isTurn) return askScreen(ctx);
        return h(
          'div',
          { class: 'screen om-p' },
          h('p', { class: 'big' }, `${nameOf(view, game.turn?.playerId)} is asking…`),
          deputyOffer(ctx),
          h('p', { class: 'hint' }, 'Watch the TV. Who is lying?'),
          caseCard(game),
          notebook(game),
        );
      case 'reveal': {
        const cur = game.current;
        if (!cur) return waiting('Look at the TV!');
        const s = game.suspects.find((x) => x.id === cur.suspectId);
        const mineAsk = cur.playerId === me.id;
        return h(
          'div',
          { class: 'screen om-p' },
          h('p', { class: 'big' }, `${s?.emoji ?? ''} ${s ? calledName(s).text : ''} answers…`),
          h('div', { class: 'om-p-answer', style: revealDelay(`${view.phaseSeq}`, game.thinkMs) }, jpLine(cur.answer)),
          mineAsk ? h('p', { class: 'hint' }, cur.guessed ? `Best guess: ${cur.natural.text} (${cur.natural.en})` : `Natural: ${cur.natural.text} (${cur.natural.en})`) : null,
          cur.newClue && cur.clue ? h('p', { class: 'om-p-clue', style: revealDelay(`${view.phaseSeq}`, game.thinkMs + game.subtitleMs) }, `📝 New clue${mineAsk ? ` +${cur.points}` : ''}: `, h('span', { lang: 'ja' }, cur.clue.text)) : null,
          deputyReport(ctx),
          // Players without the deputy's seat: a reaction tile (or the curveball); Kana and N5 phones get the gist.
          mine?.gallery || mine?.gist
            ? h(
                'div',
                { class: 'om-p-mixed', style: revealDelay(`${view.phaseSeq}`, game.thinkMs + game.subtitleMs) },
                galleryTile(mine.gallery, (pick, utterance) => void ctx.send({ kind: 'gallery', pick, utterance })),
                boothGist(mine.gist),
              )
            : null,
        );
      }
      case 'encore':
        return mine ? accuseScreen(ctx) : waiting('Look at the TV!');
      case 'finale': {
        const r = game.result;
        if (!r) return waiting('Look at the TV!');
        const culprit = game.suspects.find((s) => s.id === r.culpritId);
        const myVote = r.votes.find((v) => v.playerId === me.id);
        return h(
          'div',
          { class: 'screen om-p' },
          h('p', { class: 'big', lang: 'ja' }, `はんにんは ${culprit ? calledName(culprit).text : ''}！ ${culprit?.emoji ?? ''}`),
          h('p', {}, myVote ? (myVote.correct ? '🔍 You got it! +300' : 'Not this time. Look at the TV for the confession.') : 'You didn’t vote this time.'),
          h('p', { class: 'hint' }, r.solution),
        );
      }
      default:
        return waiting('Look at the TV!');
    }
  },
};
