// Happyōkai! on the TV: a school recital hall with a projector screen. The TV is the slide deck; the
// presenter's phone holds the script, and the room reacts from theirs.
//
//   intro    how a talk works: a title, slides you've never seen, questions, はなまる.
//   prompt   backstage: who's up and who's their assistant, the title once it's picked. On photo beats
//            Chōchin-san shows his holiday photos on the screen instead.
//   answer   the talk: the slide (title, picture, mishap or the closing bow), a candle burning down for the
//            slide's time, the presenter's captions under it, and the room's stamps rising up its right edge.
//   encore   question time: who has a question ready, the one the presenter chose, and their answer.
//   reveal   はなまる: the audience grade on their phones; the TV only counts.
//   score    the report card: the stamp, the flowers, the teacher's comment.
//   finale   the best-talk vote.
//
// Timers run as CSS animations from the server's own times (negative delays, named `--*-delay` so patch()
// keeps them), the same way as Bento Haus.

import { h, seatShape } from '../../../shared/src/dom.js';
import type { CaptionView, SlideView, StampKind } from '../../../shared/src/modes/happyokai/happyokai.js';
import type { HappyokaiView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { sfx } from '../music/sfx.js';
import type { StageMode } from './types.js';

let clockOffset = Number.NEGATIVE_INFINITY;
let lastAt = -1;
function serverNow(game: HappyokaiView): number {
  if (game.at !== lastAt) {
    lastAt = game.at;
    clockOffset = Math.max(clockOffset, game.at - Date.now());
  }
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
}

/** The stamps the room sends, as the TV draws them. */
export const STAMP_FACES: Record<StampKind, { emoji: string; kana: string }> = {
  omoshiroi: { emoji: '😂', kana: 'おもしろい！' },
  hee: { emoji: '😮', kana: 'へえー！' },
  sugoi: { emoji: '✨', kana: 'すごい！' },
  naruhodo: { emoji: '🤔', kana: 'なるほど' },
  ee: { emoji: '😱', kana: 'えーっ？' },
  hakushu: { emoji: '👏', kana: 'はくしゅ' },
};

const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);

function chip(view: RoomView, id: string | null | undefined, role?: string): HTMLElement | null {
  const p = playerOf(view, id);
  if (!p) return null;
  return h(
    'span',
    { class: 'hk-chip', style: `--seat: var(--seat-${p.seat});` },
    h('span', { class: 'hk-seat' }, `${seatShape(p.seat)}${p.seat}`),
    p.name,
    role ? h('small', {}, ` ${role}`) : null,
  );
}

/** A slide picture, or its emoji if the picture doesn't load. */
function picture(src: string | null, emoji: string, cls = 'hk-pic'): HTMLElement {
  if (!src) return h('span', { class: `${cls} hk-emoji`, 'aria-hidden': 'true' }, emoji);
  const img = h('img', { class: cls, src, alt: '', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: `${cls} hk-emoji`, 'aria-hidden': 'true' }, emoji)), { once: true });
  return img;
}

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'hk-stage hk-intro' },
    h('p', { class: 'hk-logo', lang: 'ja' }, 'はっぴょうかい！'),
    h('p', { class: 'hk-subtitle' }, 'Happyōkai! · a surprise talk in Japanese, on slides you’ve never seen'),
    h(
      'ol',
      { class: 'hk-steps' },
      h('li', {}, h('strong', {}, '🎤 Pick a title backstage'), ' and rehearse your opening: ', h('span', { lang: 'ja' }, '「タイトルは〜です」')),
      h('li', {}, h('strong', {}, '🖼️ Your assistant picks each slide.'), ' You see it when the room does. Say something about it, any way you can.'),
      h('li', {}, h('strong', {}, '😂 Everyone else stamps'), ' as you talk, then asks you one question.'),
      h('li', {}, h('strong', {}, '💮 はなまる:'), ' the room grades the talk. Every sentence counts, read or your own.'),
    ),
  );
}

function backstage(view: RoomView, game: HappyokaiView): HTMLElement {
  const b = game.backstage;
  const photo = b?.photo ? h('figure', { class: 'hk-screen hk-photo', 'data-key': `photo-${b.photo}` }, picture(b.picture, '🏮'), h('figcaption', { lang: 'ja' }, `チョーチンの なつやすみ ${b.photo}/3`)) : null;
  return h(
    'div',
    { class: 'hk-stage hk-backstage' },
    h('p', { class: 'hk-tag' }, `Backstage · talk ${game.talk} of ${game.totalTalks}${b?.last ? ' · the last one' : ''}`),
    h(
      'div',
      { class: 'hk-who' },
      h('p', {}, h('span', { class: 'hk-label' }, 'Presenter'), chip(view, game.presenterId)),
      game.assistantId ? h('p', {}, h('span', { class: 'hk-label' }, 'Assistant'), chip(view, game.assistantId)) : null,
    ),
    game.title
      ? h('p', { class: 'hk-title-card', lang: 'ja', 'data-key': 'title' }, h('small', {}, 'タイトル'), `「${game.title.text}」`, h('span', { class: 'hk-en' }, game.title.en))
      : h('p', { class: 'hk-waiting' }, 'Choosing a title… ', h('span', { lang: 'ja' }, 'どれに しようかな'), ' 🤔'),
    photo,
    h('p', { class: `hk-ready${b?.ready ? ' on' : ''}` }, b?.ready ? '🙋 Ready! Lights down…' : '📄 Rehearsing the opening on their phone'),
  );
}

/** The candle: burns down over the slide's time. */
function candle(game: HappyokaiView, slide: SlideView): HTMLElement {
  const gone = serverNow(game) - slide.at;
  return h(
    'span',
    { class: 'hk-candle', 'aria-hidden': 'true', 'data-key': `candle-${game.step}`, style: `--total: ${slide.ms}ms; --burn-delay: ${-gone}ms;` },
    h('span', { class: 'hk-wax' }, h('span', { class: 'hk-flame' })),
  );
}

function mishapFace(slide: SlideView, game: HappyokaiView, view: RoomView): HTMLElement {
  const m = slide.mishap!;
  switch (m.id) {
    case 'blackout':
      return h('div', { class: 'hk-slide hk-blackout' }, h('span', { class: 'hk-blink', lang: 'ja' }, 'NO SIGNAL'));
    case 'wrong':
      return h('div', { class: 'hk-slide hk-wrong' }, picture(slide.picture, '🏮'), h('p', { class: 'hk-stamp-label', lang: 'ja' }, 'チョーチンの なつやすみ'));
    case 'graph': {
      const up = slide.up !== false;
      return h(
        'div',
        { class: `hk-slide hk-graph ${up ? 'up' : 'down'}` },
        h('p', { class: 'hk-graph-title', lang: 'ja' }, slide.word ? `${slide.word.kana} の にんき` : 'にんき', h('small', {}, slide.word ? ` popularity of ${slide.word.en}` : ' popularity')),
        h(
          'div',
          { class: 'hk-bars', 'aria-hidden': 'true' },
          (up ? [22, 30, 26, 55, 70, 98] : [98, 80, 86, 45, 30, 8]).map((n, i) => h('span', { style: `--h: ${n}%; --i: ${i}` })),
        ),
        h('p', { class: 'hk-graph-arrow' }, up ? '📈' : '📉'),
      );
    }
    case 'upside':
      return h('div', { class: 'hk-slide hk-upside' }, picture(slide.picture, slide.emoji));
    case 'message':
      return h(
        'div',
        { class: 'hk-slide hk-message-slide' },
        picture(slide.picture, '🖥️'),
        h('div', { class: 'hk-toast', 'data-key': 'toast' }, h('b', { lang: 'ja' }, `💬 ${slide.message?.from.text ?? ''}`), h('span', { lang: 'ja' }, slide.message?.text.text ?? '')),
      );
  }
  return h('div', { class: 'hk-slide' }, m.emoji, view.phase);
}

function slideFace(view: RoomView, game: HappyokaiView, slide: SlideView): HTMLElement {
  if (slide.mishap) return mishapFace(slide, game, view);
  if (slide.kind === 'title')
    return h(
      'div',
      { class: 'hk-slide hk-title-slide' },
      h('p', { class: 'hk-slide-title', lang: 'ja' }, game.title?.text ?? ''),
      h('p', { class: 'hk-slide-en' }, game.title?.en ?? ''),
      h('p', { class: 'hk-slide-by' }, chip(view, game.presenterId)),
    );
  if (slide.kind === 'close')
    return h('div', { class: 'hk-slide hk-close-slide' }, h('p', { class: 'hk-slide-title', lang: 'ja' }, 'ごせいちょう ありがとう ございました'), h('p', { class: 'hk-slide-en' }, 'Thank you for listening'), h('p', { class: 'hk-bow', 'aria-hidden': 'true' }, '🙇'));
  return h('div', { class: 'hk-slide hk-picture-slide' }, picture(slide.picture, slide.emoji), h('span', { class: 'hk-slide-no' }, `${game.step}`));
}

function captionStrip(captions: readonly CaptionView[], empty: string): HTMLElement {
  return h(
    'ol',
    { class: 'hk-captions', 'aria-live': 'polite' },
    captions.length
      ? captions.map((c, i) => h('li', { class: `hk-cap ${c.kind}${c.hidden ? ' hidden' : ''}${i === captions.length - 1 ? ' last' : ''}`, 'data-key': c.id, lang: 'ja' }, c.hidden ? '🙈 …' : c.text))
      : h('li', { class: 'hk-cap idle', lang: 'ja' }, empty),
  );
}

function stampColumn(game: HappyokaiView): HTMLElement {
  const now = serverNow(game);
  return h(
    'div',
    { class: 'hk-stamps', 'aria-hidden': 'true' },
    game.stamps
      .filter((s) => now - s.at < 4_000)
      .map((s) =>
        h(
          'span',
          { class: `hk-stamp ${s.kind}`, 'data-key': `s${s.id}`, style: `--rise-delay: ${-(now - s.at)}ms; --x: ${(s.id * 67) % 170}px;` },
          h('b', {}, STAMP_FACES[s.kind].emoji),
          h('span', { lang: 'ja' }, STAMP_FACES[s.kind].kana),
        ),
      ),
  );
}

function stampTally(game: HappyokaiView): HTMLElement {
  return h(
    'p',
    { class: 'hk-tally' },
    (Object.keys(STAMP_FACES) as StampKind[]).filter((k) => game.stampCount[k] > 0).map((k) => h('span', { 'data-key': k }, `${STAMP_FACES[k].emoji} ${game.stampCount[k]}`)),
  );
}

/** The hall: the projector on the left, what's being said and the room's stamps on the right. */
function hall(view: RoomView, game: HappyokaiView, body: HTMLElement, side: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'hk-stage hk-hall' },
    h(
      'div',
      { class: 'hk-head' },
      h('p', { class: 'hk-tag' }, `Talk ${game.talk} of ${game.totalTalks} · `, h('span', { lang: 'ja' }, game.title ? `「${game.title.text}」` : '')),
      h('p', { class: 'hk-who' }, chip(view, game.presenterId, '🎤'), game.assistantId ? chip(view, game.assistantId, '🖱️') : null),
    ),
    h('div', { class: 'hk-room' }, body, side),
  );
}

function talk(view: RoomView, game: HappyokaiView): HTMLElement {
  const slide = game.slide;
  if (!slide) return h('div', { class: 'hk-stage' });
  const dots = h(
    'p',
    { class: 'hk-dots', 'aria-label': `slide ${game.step + 1} of ${game.steps}` },
    Array.from({ length: game.steps }, (_, i) => h('span', { class: i < game.step ? 'done' : i === game.step ? 'now' : '' })),
  );
  const renzoku = game.renzoku >= game.renzokuAt ? h('p', { class: 'hk-renzoku', lang: 'ja', 'data-key': `rz-${game.step}` }, `れんぞく ×${game.renzoku}！`) : null;
  const screen = h(
    'div',
    { class: `hk-screen${slide.mishap ? ` mishap-${slide.mishap.id}` : ''}`, 'data-key': `slide-${game.step}` },
    slideFace(view, game, slide),
    renzoku,
  );
  const tail = slide.kind === 'title' ? '「タイトルは〜です」' : slide.kind === 'close' ? '「いじょうです。ありがとうございました！」' : slide.mishap ? '…！？' : '「これは〜です」';
  return hall(
    view,
    game,
    h('div', { class: 'hk-projector' }, screen, h('div', { class: 'hk-under' }, dots, candle(game, slide))),
    h('div', { class: 'hk-side' }, stampColumn(game), captionStrip(game.captions, tail), stampTally(game)),
  );
}

function questions(view: RoomView, game: HappyokaiView): HTMLElement {
  const q = game.question;
  const body = h(
    'div',
    { class: 'hk-projector' },
    h(
      'div',
      { class: 'hk-screen hk-qa', 'data-key': 'qa' },
      h('p', { class: 'hk-slide-title', lang: 'ja' }, 'しつもん タイム'),
      h('p', { class: 'hk-slide-en' }, 'Question time'),
      q?.chosen
        ? h('p', { class: 'hk-question', lang: 'ja', 'data-key': `q-${q.chosen.playerId}` }, chip(view, q.chosen.playerId), h('span', {}, `「${q.chosen.text}」`), h('small', {}, q.chosen.en))
        : h('p', { class: 'hk-hands' }, (q?.askers ?? []).length ? (q?.askers ?? []).map((id) => h('span', { 'data-key': id }, '🙋', chip(view, id))) : h('span', { class: 'hk-quiet' }, 'Pick a question on your phone and ask it out loud')),
    ),
  );
  return hall(view, game, body, h('div', { class: 'hk-side' }, stampColumn(game), captionStrip(game.captions, q?.chosen ? '「〜から です」' : '🙋 …'), stampTally(game)));
}

function grading(view: RoomView, game: HappyokaiView): HTMLElement {
  const g = game.grading ?? { count: 0, needed: 0 };
  return h(
    'div',
    { class: 'hk-stage hk-grading' },
    h('p', { class: 'hk-tag' }, `Talk ${game.talk} of ${game.totalTalks} · grading`),
    h('p', { class: 'hk-big', lang: 'ja' }, '💮 はなまる？'),
    h('p', { class: 'hk-subtitle' }, 'Grade ', chip(view, game.presenterId), '’s talk on your phone. One to three flowers.'),
    h('p', { class: 'hk-count' }, Array.from({ length: g.needed }, (_, i) => h('span', { class: i < g.count ? 'in' : '' }, i < g.count ? '🌸' : '·')), h('small', {}, ` ${g.count} / ${g.needed}`)),
  );
}

function reportCard(view: RoomView, game: HappyokaiView): HTMLElement {
  const c = game.card;
  if (!c) return h('div', { class: 'hk-stage' });
  const presenter = playerOf(view, game.presenterId);
  return h(
    'div',
    { class: 'hk-stage hk-report' },
    h('p', { class: 'hk-tag' }, `Report card · talk ${game.talk} of ${game.totalTalks}`),
    h(
      'div',
      { class: 'hk-card' },
      h('p', { class: 'hk-card-head', lang: 'ja' }, 'つうしんぼ', h('small', {}, ` ${presenter?.name ?? ''}`)),
      h('p', { class: 'hk-card-title', lang: 'ja' }, game.title ? `「${game.title.text}」` : ''),
      h('p', { class: 'hk-flowers', 'aria-label': `${c.flowers.length} grades` }, c.flowers.map((n, i) => h('span', { class: `f${n}`, style: `--i: ${i}` }, n === 3 ? '💮' : n === 2 ? '🌸' : '🌼'))),
      h('dl', { class: 'hk-facts' }, h('dt', {}, 'Sentences'), h('dd', {}, `${c.sentences}`), h('dt', {}, 'Longest run'), h('dd', {}, `${c.best}`), c.loudest ? [h('dt', {}, 'Loudest'), h('dd', {}, `${STAMP_FACES[c.loudest.kind].emoji} ×${c.loudest.n}`)] : null),
      h('p', { class: 'hk-comment', lang: 'ja' }, h('span', {}, c.comment.text), h('small', {}, c.comment.en)),
      h('p', { class: 'hk-hanko', lang: 'ja', style: `--stamp-delay: ${600 + c.flowers.length * 250}ms` }, c.stamp.text, h('small', {}, c.stamp.en)),
      h('p', { class: 'hk-points' }, `🎤 +${c.presenterPoints + c.speakPoints}`, game.assistantId ? h('span', {}, ` · 🖱️ +${c.assistantPoints}`) : null),
    ),
  );
}

function vote(view: RoomView, game: HappyokaiView): HTMLElement {
  const v = game.vote;
  if (!v) return h('div', { class: 'hk-stage' });
  return h(
    'div',
    { class: 'hk-stage hk-vote' },
    h('p', { class: 'hk-big', lang: 'ja' }, '🏆 ベスト はっぴょう'),
    h('p', { class: 'hk-subtitle' }, `Vote for the best talk on your phone (not your own) · ${v.count} / ${v.needed}`),
    h(
      'ol',
      { class: `hk-talks${v.talks.length > 4 ? ' many' : ''}`, style: `--n: ${v.talks.length}` },
      v.talks.map((t) =>
        h(
          'li',
          { 'data-key': `t${t.index}` },
          h('p', { class: 'hk-talk-title', lang: 'ja' }, t.title ? `「${t.title.text}」` : '…'),
          h('p', {}, chip(view, t.presenterId, '🎤'), t.assistantId && v.talks.length <= 4 ? chip(view, t.assistantId, '🖱️') : null),
          t.quote ? h('p', { class: 'hk-quote', lang: 'ja' }, `“${t.quote}”`) : null,
          h('p', { class: 'hk-votes' }, t.votes ? '🌸'.repeat(t.votes) : ''),
        ),
      ),
    ),
  );
}

// ---- sounds: a slide change, a mishap, the hanko ----

let heard: { phaseSeq: number; step: number; mishap: string | null } | null = null;
function listen(view: RoomView, game: HappyokaiView): void {
  const prev = heard;
  heard = { phaseSeq: view.phaseSeq, step: game.step, mishap: game.slide?.mishap?.id ?? null };
  if (!prev) return;
  if (prev.phaseSeq !== view.phaseSeq) {
    if (view.phase === 'score') sfx('right', 0.6 + (game.card?.flowers.length ?? 0) * 0.25);
    return;
  }
  if (view.phase !== 'answer' || prev.step === game.step) return;
  const m = game.slide?.mishap?.id;
  if (m === 'message') sfx('ring');
  else if (m === 'blackout') sfx('static');
  else if (m) sfx('wrong');
  else sfx('round');
}

export const happyokaiStage: StageMode<HappyokaiView> = {
  badge(game, playerId) {
    return game.presenterId === playerId ? '🎤' : game.assistantId === playerId ? '🖱️' : '';
  },

  render(view, game) {
    listen(view, game);
    let el: HTMLElement;
    switch (view.phase) {
      case 'intro':
        el = intro();
        break;
      case 'prompt':
        el = backstage(view, game);
        break;
      case 'answer':
        el = talk(view, game);
        break;
      case 'encore':
        el = questions(view, game);
        break;
      case 'reveal':
        el = grading(view, game);
        break;
      case 'score':
        el = reportCard(view, game);
        break;
      case 'finale':
        el = vote(view, game);
        break;
      default:
        el = h('div', { class: 'hk-stage' });
    }
    return el;
  },
};
