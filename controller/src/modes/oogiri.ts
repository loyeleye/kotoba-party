// Oogiri Night on the phone: say it first, build with tiles (picking verb forms), say it to
// send it, vote, encore, and read your own private tip.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import type { AnswerCard, OogiriView, PromptCard, SlotView, TileView } from '../../../shared/src/modes/oogiri/oogiri.js';
import { canSpeak, speakBox } from '../components/speak.js';
import { kanaPad } from '../components/kanaPad.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

const ROUND_INFO: Record<string, { title: string; ja: string; how: string }> = {
  'head-to-head': { title: 'Head to Head', ja: 'たいけつ', how: 'You get two prompts. Each one goes to you and one rival. Japanese only!' },
  'photo-caption': { title: 'Photo Caption', ja: 'しゃしん', how: 'Caption the photo. Set phrases help; English is allowed (no Japanese bonus).' },
  ippon: { title: 'IPPON Round', ja: 'IPPON', how: 'One prompt for everyone. Points ×2, Japanese bonus ×2!' },
};

const STYLE_TEXT: Record<string, string> = {
  'memory-spoken': 'You said it from memory: top bonus!',
  'memory-typed': 'You typed it from memory. Next time try saying it!',
  spoken: 'You said it to send it. Nice!',
  tried: 'You said it out loud: that counts for trying.',
  typed: 'Typed. Say it to send it next time for a bigger bonus.',
  tiles: 'Tiles. Say it to send it next time for a bigger bonus.',
  english: 'English answer: no Japanese bonus, but the laughs count!',
};

function promptCard(p: PromptCard, small = false): HTMLElement {
  return h(
    'div',
    { class: `oo-prompt ${small ? 'small' : ''}` },
    p.photo ? h('p', { class: 'oo-photo' }, '📷 ', p.photo) : null,
    h('p', { class: 'oo-jp', lang: 'ja' }, p.text),
    p.kana !== p.text ? h('p', { class: 'oo-kana', lang: 'ja' }, p.kana) : null,
    p.romaji ? h('p', { class: 'oo-romaji' }, p.romaji) : null,
    h('p', { class: 'oo-en' }, p.en),
  );
}

// ---- answer: say it first ----

function sayFirst(slot: SlotView, send: PhoneContext['send']): HTMLElement {
  const countdown = h('p', { class: 'oo-count' }, `Tiles in ${Math.round(slot.sayFirstMs / 1000)}…`);
  const el = h(
    'div',
    { class: 'screen oo-answer' },
    h('p', { class: 'oo-step' }, `Prompt ${slot.index + 1} of ${slot.count}`),
    promptCard(slot.prompt),
    h('p', { class: 'big oo-sayfirst' }, 'Say it first! 🎤'),
    h('p', { class: 'hint' }, 'From memory, what goes in the blank? Saying it now earns the most.'),
    speakBox({
      label: 'Hold and say your answer',
      placeholder: 'Type what goes in the blank',
      maxLength: MAX_ANSWER_LENGTH,
      onSend: (u) => void send({ kind: 'answer', slot: slot.index, said: u }),
    }),
    countdown,
  );
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (!el.isConnected) return clearInterval(timer);
    const left = slot.sayFirstMs - (Date.now() - startedAt);
    if (left > 0) countdown.textContent = `Tiles in ${Math.ceil(left / 1000)}…`;
    else {
      clearInterval(timer);
      countdown.textContent = 'Here come the tiles…';
      void send({ kind: 'tiles', slot: slot.index });
    }
  }, 200);
  return el;
}

// ---- answer: tiles ----

interface Piece {
  tile: TileView;
  form?: string;
}

function pieceText(p: Piece, frameSlot: string | null): string {
  if (frameSlot === 'verb-stem' && p.tile.stem) return p.tile.stem;
  if (frameSlot === 'verb-te' && p.tile.te) return p.tile.te;
  return p.tile.options?.find((o) => o.form === p.form)?.text ?? p.tile.text;
}

function builder(slot: SlotView, send: PhoneContext['send'], level: string): HTMLElement {
  const pieces: Piece[] = [];
  let frameId: string | null = null;
  let picking: TileView | null = null;

  const preview = h('p', { class: 'oo-preview', lang: 'ja' });
  const tilesEl = h('div', { class: 'oo-tiles' });
  const formsEl = h('div', { class: 'oo-forms' });
  const framesEl = h('div', { class: 'oo-frames' });
  const typed = h('input', { maxlength: 40, placeholder: slot.englishOk ? 'Or type (Japanese or English)' : 'Or type it (かな)', lang: 'ja', autocomplete: 'off' }) as HTMLInputElement;
  const padHolder = h('div', {});
  let padOpen = false;
  const togglePad = () => {
    padOpen = !padOpen;
    padHolder.replaceChildren(...(padOpen ? [kanaPad(typed)] : []));
  };
  if (level === 'kana') togglePad();

  const frame = () => slot.frames.find((f) => f.id === frameId) ?? null;
  const fillText = () => {
    const f = frame();
    const inner = [...pieces.map((p) => pieceText(p, f?.slot ?? null)), typed.value.trim()].filter(Boolean).join(' ');
    if (!f) return inner;
    return f.text.replace(/＿+/, inner || '＿＿＿');
  };
  const draw = () => {
    const text = fillText();
    preview.textContent = text || 'Tap tiles to build your answer';
    preview.classList.toggle('empty', !text);
    const f = frame();
    tilesEl.replaceChildren(
      ...slot.tiles.map((t) => {
        const used = pieces.some((p) => p.tile.key === t.key);
        const blocked = !!f && f.slot !== 'noun' && !(f.slot === 'verb-stem' ? t.stem : t.te);
        return h(
          'button',
          {
            type: 'button',
            class: `oo-tile ${used ? 'on' : ''} ${t.role === 'callback' ? 'callback' : ''}`,
            disabled: blocked && !used,
            onclick: () => {
              if (used) {
                pieces.splice(
                  pieces.findIndex((p) => p.tile.key === t.key),
                  1,
                );
                picking = null;
              } else if (pieces.length >= 3) return;
              else if (t.options && !(f && f.slot !== 'noun')) picking = t;
              else {
                if (f && f.slot !== 'noun') pieces.length = 0;
                pieces.push({ tile: t });
              }
              draw();
            },
          },
          h('span', { class: 'oo-tile-jp', lang: 'ja' }, t.text),
          t.kana !== t.text ? h('small', { lang: 'ja' }, t.kana) : null,
          t.romaji ? h('small', { class: 'oo-romaji' }, t.romaji) : null,
          h('small', {}, t.en),
          t.ask ? h('span', { class: 'oo-ask' }, `→ ${t.ask.label}`) : null,
          t.role === 'callback' ? h('span', { class: 'oo-cb' }, '↺ tonight') : null,
        );
      }),
    );
    formsEl.replaceChildren(
      ...(picking
        ? [
            h('p', { class: 'hint' }, `Pick the ${picking.ask?.label ?? ''} form of ${picking.text}:`),
            h(
              'div',
              { class: 'oo-form-row' },
              picking.options!.map((o) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'oo-form',
                    onclick: () => {
                      pieces.push({ tile: picking!, form: o.form });
                      picking = null;
                      draw();
                    },
                  },
                  h('span', { lang: 'ja' }, o.text),
                  h('small', {}, o.en),
                ),
              ),
            ),
          ]
        : []),
    );
    framesEl.replaceChildren(
      ...slot.frames.map((fr) =>
        h(
          'button',
          {
            type: 'button',
            class: `oo-frame ${fr.id === frameId ? 'on' : ''}`,
            onclick: () => {
              frameId = frameId === fr.id ? null : fr.id;
              // A verb frame takes one verb: drop pieces that can't go in.
              const nf = frame();
              if (nf && nf.slot !== 'noun') {
                const keep = pieces.find((p) => (nf.slot === 'verb-stem' ? p.tile.stem : p.tile.te));
                pieces.length = 0;
                if (keep) pieces.push({ tile: keep.tile });
              }
              draw();
            },
          },
          h('span', { lang: 'ja' }, fr.text),
          h('small', {}, fr.en),
        ),
      ),
    );
  };
  typed.addEventListener('input', draw);
  draw();

  const submit = (said?: Utterance) => {
    const f = frame();
    const move: Record<string, unknown> = {
      kind: 'answer',
      slot: slot.index,
      tiles: pieces.map((p) => ({ key: p.tile.key, form: f && f.slot !== 'noun' ? undefined : p.form })),
    };
    if (frameId) move.frame = frameId;
    if (typed.value.trim()) move.typed = { via: 'typed', text: typed.value.trim() };
    if (said) move.said = said;
    if (!pieces.length && !typed.value.trim()) {
      preview.textContent = 'Pick a tile or type something first';
      return;
    }
    void send(move);
  };

  const lockIn = canSpeak()
    ? h(
        'div',
        { class: 'oo-lock' },
        speakBox({ label: 'Hold and say it to send it 🎤', speechOnly: true, onSend: (u) => submit(u) }),
        h('button', { type: 'button', class: 'secondary oo-quiet', onclick: () => submit() }, 'Send without saying it (smaller bonus)'),
      )
    : h('div', { class: 'oo-lock' }, h('button', { type: 'button', class: 'primary', onclick: () => submit() }, 'Send'));

  return h(
    'div',
    { class: 'screen oo-answer' },
    h('p', { class: 'oo-step' }, `Prompt ${slot.index + 1} of ${slot.count}`),
    promptCard(slot.prompt, true),
    preview,
    slot.frames.length ? h('div', {}, h('p', { class: 'hint' }, 'Set phrases:'), framesEl) : null,
    tilesEl,
    formsEl,
    h('div', { class: 'typed-row oo-typed' }, typed, h('button', { type: 'button', class: 'secondary pad-toggle', onclick: togglePad }, 'かな')),
    padHolder,
    lockIn,
  );
}

// ---- reveal / encore / score ----

function answerList(answers: AnswerCard[], opts: { vote?: (a: AnswerCard) => void; hide?: (a: AnswerCard) => void; votedFor?: string | null }): HTMLElement {
  return h(
    'div',
    { class: 'oo-answers' },
    answers.map((a) => {
      const canVote = opts.vote && !a.mine && !a.hidden;
      return h(
        'div',
        { class: `oo-ans ${a.mine ? 'mine' : ''} ${a.id === opts.votedFor ? 'on' : ''} ${a.hidden ? 'hidden' : ''}` },
        h(
          canVote ? 'button' : 'div',
          { type: canVote ? 'button' : null, class: 'oo-ans-main', onclick: canVote ? () => opts.vote!(a) : null },
          h('span', { class: 'oo-ans-jp', lang: 'ja' }, a.text),
          a.en ? h('small', {}, a.en) : null,
          a.mine ? h('small', { class: 'oo-tag' }, 'yours') : null,
        ),
        opts.hide && !a.hidden ? h('button', { type: 'button', class: 'oo-hide', onclick: () => opts.hide!(a) }, 'Hide') : null,
      );
    }),
  );
}

function reveal(ctx: PhoneContext<OogiriView>): HTMLElement {
  const { game, send, isVip } = ctx;
  const m = game.matchup!;
  const me = game.me!;
  const mine = m.answers.some((a) => a.mine);
  const hide = isVip ? (a: AnswerCard) => void send({ kind: 'hide', answerId: a.id }) : undefined;
  const title = me.canVote ? 'Tap the funniest' : me.votedFor ? 'Vote in! 座布団 sent' : mine ? 'Your answer is up! Stay cool…' : 'Watch the screen';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'oo-step' }, `${game.kind === 'ippon' ? 'IPPON Round' : `Matchup ${m.index + 1} of ${m.count}`}`),
    promptCard(m.prompt, true),
    h('p', { class: 'big' }, title),
    answerList(m.answers, { vote: me.canVote ? (a) => void send({ kind: 'vote', answerId: a.id }) : undefined, hide, votedFor: me.votedFor }),
    isVip ? h('p', { class: 'hint' }, 'VIP: tap Hide to take an answer off the screen.') : null,
  );
}

function encore(ctx: PhoneContext<OogiriView>): HTMLElement {
  const { game, send } = ctx;
  const me = game.me!;
  const m = game.matchup!;
  const mineCard = m.answers.find((a) => a.mine);
  if (me.encore === 'winner' || me.encore === 'author') {
    const winner = me.encore === 'winner';
    const box = h('div', { class: 'oo-encore-box' });
    const start = h(
      'button',
      {
        type: 'button',
        class: `primary oo-encore-go ${winner ? '' : 'small'}`,
        onclick: () =>
          box.replaceChildren(
            h('p', { class: 'hint' }, 'From memory, say your answer for the room!'),
            speakBox({ label: 'Hold and say it 🎤', placeholder: 'Or type it', onSend: (u) => void send({ kind: 'encore', said: u }) }),
          ),
      },
      winner ? 'I’ll say it! 🎤' : 'Encore too! 🎤',
    );
    box.append(start);
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, winner ? (m.ippon ? 'IPPON!! 🎉' : 'You won this one! 🏆') : 'Encore?'),
      h('p', { class: 'hint' }, winner ? 'Say it out loud for a spotlight bonus.' : 'Anyone can encore. Say it for a small bonus.'),
      box,
      h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'encore', pass: true }) }, 'Let Pon read it'),
    );
  }
  if (me.encore === 'done') return waiting('Thanks! 👏', mineCard ? `“${mineCard.text}”` : '');
  const top = m.answers.filter((a) => a.winner).map((a) => a.authorName).join(' & ');
  return waiting(m.ippon ? 'IPPON!! 🎉' : top ? `${top} won!` : 'No votes this time', 'Cheer for the encore!');
}

function score(ctx: PhoneContext<OogiriView>): HTMLElement {
  const { game } = ctx;
  const tip = game.me?.tip;
  const natural = game.matchup?.natural;
  if (!tip) {
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, 'Shout it back! 📣'),
      natural ? h('div', { class: 'oo-natural' }, h('p', { class: 'oo-jp', lang: 'ja' }, natural.text), natural.kana !== natural.text ? h('p', { class: 'oo-kana', lang: 'ja' }, natural.kana) : null, h('p', { class: 'oo-en' }, natural.en)) : null,
    );
  }
  return h(
    'div',
    { class: 'screen oo-tip' },
    h('p', { class: 'big' }, `+${tip.points} · ${tip.votes} 座布団`),
    h('p', { class: 'hint' }, STYLE_TEXT[tip.style] ?? ''),
    h('p', { class: 'oo-label' }, 'Your sentence'),
    h('div', { class: 'oo-natural' }, h('p', { class: 'oo-jp', lang: 'ja' }, tip.mine.text), h('p', { class: 'oo-en' }, tip.mine.en)),
    tip.formTips.map((t) => h('p', { class: 'oo-formtip' }, '✏️ ', t)),
    h('p', { class: 'oo-label' }, 'Pon’s version'),
    h('div', { class: 'oo-natural' }, h('p', { class: 'oo-jp', lang: 'ja' }, tip.natural.text), tip.natural.kana !== tip.natural.text ? h('p', { class: 'oo-kana', lang: 'ja' }, tip.natural.kana) : null, h('p', { class: 'oo-en' }, tip.natural.en)),
    h('p', { class: 'oo-pattern' }, '💡 ', tip.pattern),
  );
}

export const oogiriPhone: PhoneMode<OogiriView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      JSON.stringify(game.me),
      game.matchup ? game.matchup.answers.map((a) => `${a.id}:${a.hidden ? 'h' : ''}:${a.encore ?? ''}`).join(',') : '',
      game.steal?.playerId ?? '',
    ].join('|'),

  render(ctx) {
    const { view, game, send } = ctx;
    const info = game.kind ? ROUND_INFO[game.kind] : undefined;
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, '大喜利ナイト！'),
          h('p', {}, 'Fill in the blank, vote for the funniest, say the winner out loud.'),
          h('p', { class: 'hint' }, 'Each vote is a 座布団 (cushion). Watch the screen: Pon explains.'),
        );
      case 'prompt':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'oo-step' }, `Round ${game.round} of ${game.totalRounds}`),
          h('p', { class: 'big' }, info?.title ?? ''),
          h('p', {}, info?.how ?? ''),
          game.multiplier > 1 ? h('p', { class: 'oo-double' }, `Points ×${game.multiplier}`) : null,
        );
      case 'answer': {
        const slot = game.me?.slot;
        if (!slot) {
          return h(
            'div',
            { class: 'screen' },
            h('p', { class: 'big' }, 'All in! ✅'),
            h('p', { class: 'hint' }, 'Waiting for the others…'),
            (game.me?.done ?? []).map((d) => h('p', { class: 'oo-done', lang: 'ja' }, d.answer)),
          );
        }
        return slot.sayFirst ? sayFirst(slot, send) : builder(slot, send, game.me!.level);
      }
      case 'reveal':
        return game.matchup ? reveal(ctx) : waiting('Look at the screen!');
      case 'encore':
        return game.matchup ? encore(ctx) : waiting('Look at the screen!');
      case 'score':
        return score(ctx);
      case 'penalty':
        return waiting('🦝 Pon steals a cushion!', game.steal ? `From ${game.steal.name}. Ha!` : '');
      default:
        return waiting('Look at the screen!');
    }
  },
};
