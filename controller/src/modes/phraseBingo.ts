// Phrase Bingo Theater on the phone. Actors: study the secret lines, then during the scene hold
// to talk and slip each one in (peeking at the Japanese costs the memory bonus). Audience: a 3×3
// bingo card; tap a line you heard, pick who said it. Everyone: shout the scene's phrase back.

import { h, ruby } from '../../../shared/src/dom.js';
import { scenePic } from '../../../shared/src/art.js';
import type { PhraseBingoView } from '../../../shared/src/modes/views.js';
import type { CellView, PhraseCard, SecretView } from '../../../shared/src/modes/phraseBingo/phraseBingo.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<PhraseBingoView>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';

/** The cell picked on the bingo card, waiting for "who said it?" (kept across redraws). */
let picked: { seq: number; phraseId: string } | null = null;

function phraseBlock(p: PhraseCard, big = true): HTMLElement {
  // Romaji comes only for かな players, so it tells us the level (components/jp.ts).
  return jpView(p, p.romaji ? 'kana' : 'n5', { cls: `pb-line${big ? '' : ' small'}` });
}

/** A line on the bingo card: kana at the Kana level (romaji under it), else furigana over the kanji. */
function cellText(cell: PhraseCard): Node {
  return cell.romaji ? document.createTextNode(cell.kana) : ruby(cell);
}

function sceneHeader(game: PhraseBingoView): HTMLElement | null {
  const sc = game.scene;
  if (!sc) return null;
  return h('div', { class: 'pb-scene-p' }, scenePic(sc, 'pb-emoji-p'), h('div', {}, h('p', { class: 'pb-setting-p', lang: 'ja' }, sc.setting.text), h('p', { class: 'hint' }, sc.setting.en)));
}

function roleLine(game: PhraseBingoView): HTMLElement | null {
  const role = game.me?.actor?.role;
  if (!role) return null;
  return h('p', { class: 'pb-role-p' }, 'You play ', h('strong', { lang: 'ja' }, role.text), ` (${role.en})`);
}

function card(ctx: Ctx, mode: 'show' | 'play' | 'result'): HTMLElement {
  const { view, game, send } = ctx;
  const c = game.me!.card!;
  const line = new Set(c.line ?? []);
  const selected = () => (picked && picked.seq === view.phaseSeq ? picked.phraseId : null);
  const cellEl = (cell: CellView, i: number) => {
    const sel = selected();
    const cls = ['pb-cell', cell.daubed ? 'daubed' : '', line.has(i) ? 'line' : '', cell.buzz ? `buzzed ${cell.buzz.result ?? ''}` : '', sel === cell.id ? 'sel' : ''].filter(Boolean).join(' ');
    const body = [
      h('span', { class: 'pb-cell-jp', lang: 'ja' }, cellText(cell)),
      h('span', { class: 'pb-cell-en' }, cell.romaji ?? cell.en),
      cell.buzz ? h('span', { class: 'pb-cell-buzz' }, `${cell.buzz.result === 'caught' ? '🎯' : cell.buzz.result === 'miss' ? '✗' : '🫵'} ${nameOf(view, cell.buzz.actorId)}`) : null,
    ];
    const canTap = mode === 'play' && !cell.buzz && c.buzzesLeft > 0;
    if (!canTap) return h('div', { class: cls }, body);
    return h(
      'button',
      {
        type: 'button',
        class: cls,
        onclick: () => {
          picked = { seq: view.phaseSeq, phraseId: cell.id };
          rerender();
        },
      },
      body,
    );
  };
  const grid = h('div', { class: 'pb-card' }, c.cells.map(cellEl));
  const holder = h('div', { class: 'pb-card-wrap' }, grid);

  const who = () => {
    const sel = selected();
    const cell = sel ? c.cells.find((x) => x.id === sel) : undefined;
    if (mode !== 'play' || !cell) return null;
    return h(
      'div',
      { class: 'pb-who' },
      h('p', {}, 'Who said ', h('strong', { lang: 'ja' }, '「', cellText(cell), '」'), '?'),
      h(
        'div',
        { class: 'pb-who-grid' },
        game.cast.map((a) =>
          h(
            'button',
            {
              type: 'button',
              class: 'option pb-who-btn',
              onclick: () => {
                picked = null;
                void send({ kind: 'buzz', phraseId: cell.id, actorId: a.playerId, round: game.round });
              },
            },
            nameOf(view, a.playerId),
          ),
        ),
      ),
      h('button', { type: 'button', class: 'linkish', onclick: () => ((picked = null), rerender()) }, 'Cancel'),
    );
  };
  // Picking a cell only changes this phone, so redraw the picker in place.
  const rerender = () => {
    holder.replaceChildren(h('div', { class: 'pb-card' }, c.cells.map(cellEl)));
    const w = who();
    if (w) holder.append(w);
  };
  const w = who();
  if (w) holder.append(w);
  return holder;
}

function secretRow(ctx: Ctx, x: SecretView, live: boolean): HTMLElement {
  const { send, game } = ctx;
  const status = x.said ? (x.smooth === false ? `🎯 caught by ${x.caughtBy!.map((id) => nameOf(ctx.view, id)).join(', ')}` : x.smooth ? '⭐ smooth' : '✓ said') : live ? '' : 'not said';
  return h(
    'div',
    { class: `pb-secret-p${x.said ? ' said' : ''}` },
    x.jp ? phraseBlock(x.jp, !live) : h('div', { class: 'pb-line hidden' }, h('p', { class: 'pb-line-en' }, x.en), h('p', { class: 'pb-line-hint', lang: 'ja' }, x.hint)),
    status ? h('p', { class: 'pb-status' }, status) : null,
    live && !x.said && !x.jp
      ? h('button', { type: 'button', class: 'secondary pb-peek', onclick: () => void send({ kind: 'peek', phraseId: x.id, round: game.round }) }, '👀 Peek (no memory bonus)')
      : null,
  );
}

function actorScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const a = game.me!.actor!;
  switch (view.phase) {
    case 'prompt':
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, '🎭 You’re in the scene!'),
        sceneHeader(game),
        roleLine(game),
        h('p', { class: 'hint' }, `Your secret lines (${a.secrets.length}). Slip each one into the scene. Learn them now: they hide when the scene starts.`),
        a.secrets.map((x) => (x.jp ? phraseBlock(x.jp) : null)),
        a.ready
          ? h('p', { class: 'hint pb-ready-p' }, '✓ Ready. Waiting for the other actors…')
          : h('button', { type: 'button', class: 'primary', onclick: () => void send({ kind: 'ready', round: game.round }) }, 'I’m ready'),
      );
    case 'answer': {
      const left = a.secrets.filter((x) => !x.said).length;
      const last = a.last;
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, '🎬 Action!'),
        roleLine(game),
        h('div', { class: 'pb-secrets' }, a.secrets.map((x) => secretRow(ctx, x, true))),
        last
          ? h('p', { class: `pb-heard ${last.matched ? 'ok' : ''}` }, last.matched ? `✓ Slipped in! (heard “${last.heard}”)` : `Heard “${last.heard}”: not one of your lines. Keep acting!`)
          : null,
        left
          ? speakBox({
              label: 'Hold and say your line',
              placeholder: 'Type the line (kana)',
              onSend: (utterance) => void send({ kind: 'say', utterance, round: game.round }),
            })
          : h('p', { class: 'big pb-done' }, 'All lines in! 🎉 Keep the scene going.'),
        h('p', { class: 'hint' }, 'Say the line out loud in the scene, as you say it into the phone. The TV shows that you slipped one in, never which.'),
      );
    }
    default:
      return resultScreen(ctx);
  }
}

function audienceScreen(ctx: Ctx): HTMLElement {
  const { view, game } = ctx;
  const c = game.me!.card!;
  switch (view.phase) {
    case 'prompt':
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, '🍿 You’re in the audience'),
        sceneHeader(game),
        h('p', { class: 'hint' }, `Starring ${game.cast.map((a) => nameOf(view, a.playerId)).join(', ')}. Every secret line is on your card (plus a few decoys).`),
        card(ctx, 'show'),
        h('p', { class: 'hint' }, `During the scene: heard a line? Tap it, then pick who said it. ${c.buzzesLeft} buzzes.`),
      );
    case 'answer': {
      const slips = game.ticker.filter((t) => t.kind === 'slip');
      const lastSlip = slips[slips.length - 1];
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, '👂 Listen!'),
        lastSlip ? h('p', { class: 'pb-alert' }, `🔔 ${nameOf(view, lastSlip.playerId)} just slipped one in!`) : h('p', { class: 'hint' }, 'The TV rings 🔔 when an actor slips a line in.'),
        card(ctx, 'play'),
        h('p', { class: 'hint' }, c.buzzesLeft ? `${c.buzzesLeft} ${c.buzzesLeft === 1 ? 'buzz' : 'buzzes'} left. Results after the scene.` : 'No buzzes left. Results after the scene!'),
      );
    }
    default:
      return resultScreen(ctx);
  }
}

function resultScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const mine = game.me!;
  const pts = mine.points ?? 0;
  if (view.phase === 'encore') {
    const e = mine.echo;
    const p = game.highlight;
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, 'Say it with everyone!'),
      p ? phraseBlock(p) : null,
      e?.ok
        ? h('p', { class: 'pb-heard ok' }, '✓ Nice! 🎤')
        : e?.canEcho
          ? h(
              'div',
              {},
              e.heard ? h('p', { class: 'pb-heard' }, `Heard “${e.heard}”. ${e.triesLeft} more ${e.triesLeft === 1 ? 'try' : 'tries'}.`) : null,
              speakBox({ label: 'Hold and say it', placeholder: 'Type it (kana)', onSend: (utterance) => void send({ kind: 'echo', utterance, round: game.round }) }),
            )
          : h('p', { class: 'hint' }, 'Say it out loud anyway!'),
    );
  }
  const header = h('p', { class: 'big' }, view.phase === 'score' && mine.card?.line ? 'BINGO! 🎉' : pts ? `+${pts} this scene` : 'Scene over');
  const body = mine.actor
    ? h('div', { class: 'pb-secrets' }, mine.actor.secrets.map((x) => secretRow(ctx, x, false)))
    : mine.card
      ? card(ctx, 'result')
      : null;
  return h(
    'div',
    { class: 'screen' },
    header,
    view.phase === 'score' && mine.card?.line ? h('p', { class: 'hint' }, `A full line of lines that were said: +${pts} this scene in all.`) : null,
    body,
    mine.card ? h('p', { class: 'hint' }, 'Gold cells were said in the scene. 🎯 = your catch.') : null,
    view.phase === 'score' ? h('p', { class: 'hint' }, game.round < game.totalRounds ? 'Next scene coming up…' : 'That’s a wrap!') : null,
  );
}

export const phraseBingoPhone: PhoneMode<PhraseBingoView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      JSON.stringify(game.me),
      game.highlight?.id ?? '',
      // The audience sees who just slipped one in; actors don't need the ticker (and may be typing).
      game.me?.part === 'audience' ? game.ticker.length : '',
    ].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    if (view.phase === 'intro') {
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big', lang: 'ja' }, 'フレーズビンゴ劇場'),
        h('p', {}, 'Each scene, some of you act and the rest watch.'),
        h('p', {}, '🎭 Actors get secret Japanese lines. Act the scene out loud and slip each line in. To score it, hold the button and say it into your phone.'),
        h('p', {}, '🫵 The audience has a bingo card of lines. Heard one? Tap it and pick who said it.'),
        h('p', { class: 'hint' }, 'Lines nobody catches score double, so make them sound natural!'),
      );
    }
    if (!game.me) return waiting('Look at the TV!');
    if (game.me.part === 'actor' && game.me.actor) return actorScreen(ctx);
    if (game.me.card) return audienceScreen(ctx);
    return view.phase === 'prompt' || view.phase === 'answer' ? waiting('Watch the scene!', 'You’ll be in the next one.') : resultScreen(ctx);
  },
};
