// Happyōkai! on the phone. Three jobs, and they change every talk:
//
//   presenter  backstage: pick a title, rehearse the opening, 🙋 ready. On stage: the slide's script or its
//              word, sentence frames and ready sentences (tap one, or read it out for more), tap to talk,
//              next slide. Question time: choose a question, then answer it. Then a private report.
//   assistant  pick each next slide (🙂 fits the title, 🎲 random, むちゃぶり wild), play one mishap, push a
//              cue card to the presenter's phone.
//   audience   stamp while they talk, ask one question (say it out loud for more), grade the talk.
//
// Everyone votes for the best talk at the end.

import { h, ruby } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import { STAMP_GAP_MS, type StampKind } from '../../../shared/src/modes/happyokai/happyokai.js';
import type { HappyokaiView } from '../../../shared/src/modes/views.js';
import { speakBox, canSpeak } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<HappyokaiView>;
type Me = NonNullable<HappyokaiView['me']>;

const nameOf = (ctx: Ctx, id: string | null | undefined): string => ctx.view.players.find((p) => p.id === id)?.name ?? '';

const buzz = (ms = 30) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

const STAMP_BUTTONS: { kind: StampKind; emoji: string; kana: string; en: string }[] = [
  { kind: 'omoshiroi', emoji: '😂', kana: 'おもしろい！', en: 'Funny!' },
  { kind: 'hee', emoji: '😮', kana: 'へえー！', en: 'Oh really!' },
  { kind: 'sugoi', emoji: '✨', kana: 'すごい！', en: 'Amazing!' },
  { kind: 'naruhodo', emoji: '🤔', kana: 'なるほど', en: 'I see' },
  { kind: 'ee', emoji: '😱', kana: 'えーっ？', en: 'What?!' },
  { kind: 'hakushu', emoji: '👏', kana: 'パチパチ！', en: 'Applause' },
];

const CHOICE_LABEL = { fit: '🙂 ぴったり', random: '🎲 ランダム', wild: '🤪 むちゃぶり' } as const;
const CHOICE_EN = { fit: 'Fits the title', random: 'Random', wild: 'Something wild' } as const;

/** Which question card this phone picked, so it survives a redraw. */
let pickedCard = { seq: -1, key: -1 };
/** Cue cards this assistant has sent on this slide (shown as ✓ Sent). */
let sentCues = { at: '', keys: new Set<number>() };
/** The last stamp this phone sent: the room takes one a second, so the pad cools down in between. */
let lastStamp = 0;
/** The grade flowers, as the TV draws them. */
const flowerImg = (n: number): HTMLElement => h('img', { class: 'hk-flower', src: `/stage/assets/icons/hk-flower-${n}.png`, alt: '', draggable: 'false' });

// ---- the presenter ----

function titlePicker(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  return h(
    'div',
    { class: 'screen hk-p' },
    h('p', { class: 'big' }, '🎤 You’re up!'),
    game.assistantId ? h('p', { class: 'hint' }, `${nameOf(ctx, game.assistantId)} is your assistant: they pick the slides. You’ll see each one when the room does.`) : null,
    h('p', {}, 'Pick a title for your talk:'),
    h(
      'div',
      { class: 'hk-titles' },
      me.titleChoices.map((t) =>
        h(
          'button',
          { type: 'button', class: `hk-title-btn${game.title?.text === t.jp.text ? ' on' : ''}`, onclick: () => (buzz(), void send({ kind: 'title', key: t.key })) },
          t.deck ? h('span', { class: 'hk-deck', lang: 'ja' }, `${t.deck.text} · ${t.deck.en}`) : null,
          jpView({ ...t.jp, romaji: t.romaji }, me.level, { as: 'tile' }),
        ),
      ),
    ),
    me.rehearse
      ? h(
          'div',
          { class: 'hk-rehearse' },
          h('p', { class: 'hk-label-p' }, 'Rehearse your opening, out loud:'),
          jpView(me.rehearse.opening, me.level, { cls: 'hk-script' }),
          h('p', { class: 'hk-label-p' }, 'And your closing:'),
          jpView(me.rehearse.closing, me.level, { cls: 'hk-script small' }),
          h('button', { type: 'button', class: 'primary hk-go', onclick: () => (buzz(), void send({ kind: 'go' })) }, game.backstage?.ready ? '✓ Ready! Waiting for the lights…' : '🙋 I’m ready'),
        )
      : null,
  );
}

function myLines(ctx: Ctx, me: Me): HTMLElement | null {
  if (!me.lines.length) return null;
  return h(
    'ul',
    { class: 'hk-mylines', 'aria-label': 'What the TV shows' },
    me.lines.map((l) =>
      h(
        'li',
        { class: l.hidden ? 'hidden' : '' },
        ruby(l),
        l.hidden ? h('small', {}, ' hidden') : h('button', { type: 'button', class: 'linkish hk-hide', 'aria-label': 'Take this off the TV', onclick: () => void ctx.send({ kind: 'hide', lineId: l.id }) }, '🙈 Hide'),
      ),
    ),
  );
}

function talkBox(ctx: Ctx, me: Me, placeholder: string): HTMLElement {
  return speakBox({
    toggle: true,
    label: 'Tap to talk',
    placeholder,
    maxLength: MAX_ANSWER_LENGTH * 2,
    kanaPadOpen: me.level === 'kana' && !canSpeak(),
    draftKey: `hk-${ctx.view.phaseSeq}-${ctx.game.step}`,
    onSend: (utterance) => void ctx.send({ kind: 'say', utterance }),
  });
}

function nextButton(ctx: Ctx, me: Me): HTMLElement {
  const last = ctx.game.slide?.kind === 'close';
  return h(
    'button',
    { type: 'button', class: `secondary hk-next${me.canNext ? '' : ' dim'}`, onclick: () => (buzz(), void ctx.send({ kind: 'next' })) },
    last ? '🙇 Finish the talk' : '▶ Next slide',
  );
}

function presenting(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const slide = game.slide;
  const kanpe = me.ready.find((r) => r.key === me.kanpe);
  const others = me.ready.filter((r) => r !== kanpe);
  const head = h('p', { class: 'hk-step' }, `Slide ${game.step + 1} of ${game.steps}`, slide?.mishap ? h('span', { lang: 'ja' }, ` · ${slide.mishap.emoji} `, ruby(slide.mishap.name), '!') : null);
  if (me.script) {
    return h(
      'div',
      { class: 'screen hk-p' },
      head,
      h('p', { class: 'hk-label-p' }, slide?.mishap ? 'Uh-oh! Keep going. Try:' : 'Say:'),
      jpView(me.script, me.level, { cls: 'hk-script' }),
      myLines(ctx, me),
      dock(ctx, me, me.script.kana),
    );
  }
  return h(
    'div',
    { class: 'screen hk-p' },
    head,
    me.word ? h('div', { class: 'hk-word' }, h('span', { class: 'hk-label-p' }, 'Look at the TV! It’s:'), jpView(me.word, me.level, { cls: 'hk-word-jp' })) : null,
    me.frames.length ? h('ul', { class: 'hk-frames', lang: 'ja' }, me.frames.map((f) => h('li', {}, f))) : null,
    kanpe ? h('div', { class: 'hk-ready-list' }, readyButton(ctx, me, kanpe)) : null,
    others.length
      ? h(
          'details',
          { class: 'hk-ready-list hk-stuck' },
          h('summary', {}, `Stuck? ${others.length} sentences to read out (or tap)`),
          others.map((r) => readyButton(ctx, me, r)),
        )
      : null,
    myLines(ctx, me),
    dock(ctx, me, me.frames[0] ?? '〜です。'),
  );
}

function readyButton(ctx: Ctx, me: Me, r: Me['ready'][number]): HTMLElement {
  return h(
    'button',
    { type: 'button', class: `hk-ready-btn${me.kanpe === r.key ? ' kanpe' : ''}`, onclick: () => (buzz(), void ctx.send({ kind: 'ready', key: r.key })) },
    me.kanpe === r.key ? h('span', { class: 'hk-kanpe-tag' }, '📋 from your assistant') : null,
    jpView(r, me.level, { as: 'tile' }),
  );
}

/** The talk button and Next, pinned to the bottom of the phone so they never scroll away. */
function dock(ctx: Ctx, me: Me, placeholder: string): HTMLElement {
  return h('div', { class: 'hk-dock' }, talkBox(ctx, me, placeholder), nextButton(ctx, me));
}

// ---- the assistant ----

function assisting(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const presenter = nameOf(ctx, game.presenterId);
  const at = `${ctx.view.phaseSeq}:${game.step}`;
  if (sentCues.at !== at) sentCues = { at, keys: new Set() };
  const pickedSlide = me.choices.find((c) => c.id === me.picked);
  const pickedMishap = me.mishaps.find((m) => m.id === me.picked);
  const picked = pickedSlide ? `“${pickedSlide.word?.en ?? 'Your slide'}”` : pickedMishap ? `${pickedMishap.emoji} ${pickedMishap.name.en}` : null;
  return h(
    'div',
    { class: 'screen hk-a' },
    h('p', { class: 'big' }, '🖱️ You’re the assistant'),
    me.choices.length
      ? [
          h('p', {}, `Pick ${presenter}’s next slide:`),
          h(
            'div',
            { class: 'hk-choices' },
            me.choices.map((c) => {
              const pic = h('img', { class: 'hk-thumb', src: c.picture ?? '', alt: '', draggable: 'false' }) as HTMLImageElement;
              pic.onerror = () => pic.replaceWith(h('span', { class: 'hk-thumb emoji' }, c.emoji));
              return h(
                'button',
                { type: 'button', class: `hk-choice ${c.choice}${me.picked === c.id ? ' on' : ''}`, onclick: () => (buzz(), void send({ kind: 'pick', slideId: c.id })) },
                pic,
                h('span', { class: 'hk-choice-tag', lang: 'ja' }, CHOICE_LABEL[c.choice]),
                h('small', {}, `${CHOICE_EN[c.choice]} · ${c.word?.en ?? ''}`),
              );
            }),
          ),
        ]
      : h('p', { class: 'hint' }, game.slide?.kind === 'close' ? 'That’s the last slide. Get ready to clap!' : 'Next slide coming…'),
    me.mishaps.length
      ? h(
          'div',
          { class: 'hk-mishaps' },
          h('p', { class: 'hk-label-p' }, '😈 Or play a mishap instead (once per talk)'),
          h('div', { class: 'hk-mishap-row' }, me.mishaps.map((m) => h('button', { type: 'button', class: `secondary${me.picked === m.id ? ' on' : ''}`, onclick: () => (buzz(), void send({ kind: 'pick', mishapId: m.id })) }, `${m.emoji} `, ruby(m.name), h('small', {}, ` ${m.name.en}`)))),
        )
      : null,
    picked ? h('p', { class: 'hk-ok' }, `✓ ${picked} goes up when ${presenter} taps Next (or the candle burns out).`) : null,
    me.cueCards.length
      ? h(
          'details',
          { class: 'hk-cues' },
          h('summary', {}, `📋 Help ${presenter}: send a cue card to their phone`),
          me.cueCards.map((c) => {
            const sent = sentCues.keys.has(c.key);
            return h(
              'button',
              {
                type: 'button',
                class: `secondary hk-cue${sent ? ' sent' : ''}`,
                onclick: () => {
                  buzz();
                  sentCues.keys.add(c.key);
                  void send({ kind: 'kanpe', key: c.key });
                  ctx.redraw();
                },
              },
              sent ? h('b', {}, '✓ Sent ') : null,
              ruby(c),
              h('small', {}, c.en),
            );
          }),
        )
      : null,
  );
}

// ---- the room ----

function stamps(ctx: Ctx): HTMLElement {
  const close = ctx.view.phase === 'encore' || ctx.game.slide?.kind === 'close';
  const pad = h('div', { class: 'hk-stamp-pad' });
  const tap = (kind: StampKind, btn: HTMLElement) => {
    const t = Date.now();
    if (t - lastStamp < STAMP_GAP_MS) return;
    lastStamp = t;
    buzz(20);
    void ctx.send({ kind: 'stamp', stamp: kind });
    // The tap shows at once: a +1 on the button, and the pad cools down until the room takes another.
    btn.classList.remove('sent');
    void btn.offsetWidth;
    btn.classList.add('sent');
    pad.classList.add('cool');
    setTimeout(() => pad.classList.remove('cool'), STAMP_GAP_MS);
  };
  pad.append(
    ...STAMP_BUTTONS.filter((s) => s.kind !== 'hakushu' || close).map((s) => {
      const btn: HTMLElement = h('button', { type: 'button', class: `hk-stamp-btn ${s.kind}`, onclick: () => tap(s.kind, btn) }, h('img', { src: `/stage/assets/icons/hk-stamp-${s.kind}.png`, alt: s.emoji, draggable: 'false' }), h('span', { lang: 'ja' }, s.kana), h('small', {}, s.en));
      return btn;
    }),
  );
  return pad;
}

/** The VIP can take any caption off the TV (a mis-hearing, or something rude). */
function vipCaptions(ctx: Ctx): HTMLElement | null {
  if (!ctx.isVip || !ctx.game.captions.some((c) => !c.hidden)) return null;
  return h(
    'details',
    { class: 'hk-vip' },
    h('summary', {}, '★ VIP: hide a caption'),
    h('ul', { class: 'hk-mylines' }, ctx.game.captions.filter((c) => !c.hidden).map((c) => h('li', {}, ruby(c), h('button', { type: 'button', class: 'linkish hk-hide', onclick: () => void ctx.send({ kind: 'hide', lineId: c.id }) }, '🙈 Hide')))),
  );
}

function watching(ctx: Ctx): HTMLElement {
  return h(
    'div',
    { class: 'screen hk-w' },
    h('p', { class: 'hint' }, `🎤 ${nameOf(ctx, ctx.game.presenterId)} is presenting. React!`),
    stamps(ctx),
    vipCaptions(ctx),
  );
}

function asking(ctx: Ctx, me: Me): HTMLElement {
  const { game, view, send } = ctx;
  if (pickedCard.seq !== view.phaseSeq) pickedCard = { seq: view.phaseSeq, key: -1 };
  const key = pickedCard.key;
  if (me.asked && game.question?.chosen) return watching(ctx);
  return h(
    'div',
    { class: 'screen hk-w' },
    h('p', { class: 'big', lang: 'ja' }, '🙋 しつもん'),
    me.asked
      ? h('p', { class: 'hk-ok' }, '✓ Your hand is up: ', h('span', { lang: 'ja' }, me.asked), canSpeak() ? '. Ask it out loud for more points!' : '')
      : h('p', {}, `Pick a question for ${nameOf(ctx, game.presenterId)}:`),
    h(
      'div',
      { class: 'hk-questions' },
      me.questions.map((q) =>
        h(
          'button',
          {
            type: 'button',
            class: `hk-q-btn${key === q.key || me.asked === q.text ? ' on' : ''}`,
            onclick: () => {
              buzz();
              pickedCard = { seq: view.phaseSeq, key: q.key };
              void send({ kind: 'ask', key: q.key });
              ctx.redraw();
            },
          },
          jpView(q, me.level, { as: 'tile' }),
        ),
      ),
    ),
    key >= 0 || me.asked
      ? speakBox({
          label: 'Tap to ask it out loud',
          toggle: true,
          speechOnly: true,
          onSend: (utterance) => void send({ kind: 'ask', key: key >= 0 ? key : Math.max(0, me.questions.findIndex((q) => q.text === me.asked)), utterance }),
        })
      : null,
  );
}

function questionTime(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  if (me.role === 'presenter') {
    if (me.pickQuestion.length || !game.question?.chosen)
      return h(
        'div',
        { class: 'screen hk-p' },
        h('p', { class: 'big', lang: 'ja' }, '🙋 しつもん タイム'),
        me.pickQuestion.length ? h('p', {}, 'Choose a question to answer:') : h('p', { class: 'hint' }, 'Hands going up… choose one when you see it.'),
        h(
          'div',
          { class: 'hk-questions' },
          me.pickQuestion.map((q) => h('button', { type: 'button', class: 'hk-q-btn', onclick: () => (buzz(), void send({ kind: 'choose', playerId: q.playerId })) }, h('b', {}, `${nameOf(ctx, q.playerId)}: `), ruby(q), h('small', {}, ` ${q.en}`))),
        ),
      );
    const q = game.question.chosen;
    return h(
      'div',
      { class: 'screen hk-p' },
      h('p', { class: 'hk-label-p' }, `${nameOf(ctx, q.playerId)} asks:`),
      h('p', { class: 'hk-script', lang: 'ja' }, ruby(q), h('small', {}, ` ${q.en}`)),
      h('ul', { class: 'hk-frames', lang: 'ja' }, me.answerFrames.map((f) => h('li', {}, f))),
      talkBox(ctx, me, me.answerFrames[0] ?? '〜です。'),
      myLines(ctx, me),
      h('p', { class: 'hint' }, 'Stalling? Say いい しつもんですね！'),
    );
  }
  if (me.questions.length || me.asked) return asking(ctx, me);
  return watching(ctx);
}

function grade(ctx: Ctx, me: Me): HTMLElement {
  if (me.role === 'presenter') return waiting('🌸 The room is grading your talk…', 'Deep breaths.');
  if (me.graded !== null) return waiting('✓ Graded. Thank you, sensei!', 'Look at the TV.');
  if (!me.canGrade) return waiting('Look at the TV!');
  const opts = [
    { n: 1, ja: 'よく できました', en: 'Well done' },
    { n: 2, ja: 'たいへん よく できました', en: 'Very well done' },
    { n: 3, ja: 'はなまる', en: 'Top marks!' },
  ];
  return h(
    'div',
    { class: 'screen hk-w' },
    h('p', { class: 'big' }, `Grade ${nameOf(ctx, ctx.game.presenterId)}’s talk`),
    h('p', { class: 'hint' }, 'Did they keep talking? Did you understand? Did it make you laugh?'),
    h('div', { class: 'hk-grades' }, opts.map((o) => h('button', { type: 'button', class: `hk-grade g${o.n}`, onclick: () => (buzz(), void ctx.send({ kind: 'grade', n: o.n })) }, h('b', {}, flowerImg(o.n)), h('span', { lang: 'ja' }, o.ja), h('small', {}, o.en)))),
  );
}

function scored(ctx: Ctx, me: Me): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, me.points ? `+${me.points}` : 'Look at the TV!'),
    me.report
      ? h('p', {}, `You said ${me.report.sentences} sentence${me.report.sentences === 1 ? '' : 's'}, ${me.report.best} in a row at best. `, me.report.sentences >= 6 ? 'すごい！' : 'Next time, try one more on each slide.')
      : me.role === 'assistant'
        ? h('p', { class: 'hint' }, 'Assistant points: every sentence said on your slides.')
        : h('p', { class: 'hint' }, 'Questions asked out loud score more.'),
  );
}

function voting(ctx: Ctx, me: Me): HTMLElement {
  const v = ctx.game.vote;
  if (!v) return waiting('Look at the TV!');
  if (me.votedFor !== null) return waiting('✓ Voted!', 'Look at the TV.');
  if (!me.canVote) return waiting('🏆 The room is voting', 'You can’t vote for your own talk.');
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🏆 Best talk?'),
    h(
      'div',
      { class: 'hk-questions' },
      v.talks
        .filter((t) => t.presenterId !== ctx.me.id)
        .map((t) =>
          h(
            'button',
            { type: 'button', class: 'hk-q-btn', onclick: () => (buzz(), void ctx.send({ kind: 'vote', talk: t.index })) },
            h('b', {}, nameOf(ctx, t.presenterId)),
            t.title ? h('span', { lang: 'ja' }, ' 「', ruby(t.title), '」') : null,
            t.quote ? h('small', { lang: 'ja' }, ` 「${t.quote}」`) : null,
          ),
        ),
    ),
  );
}

export const happyokaiPhone: PhoneMode<HappyokaiView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      JSON.stringify(game.me),
      game.step,
      game.slide?.kind ?? '',
      game.title?.text ?? '',
      game.backstage?.ready ? 'r' : '',
      game.question?.chosen?.playerId ?? '',
      game.me?.role === 'audience' ? game.captions.map((c) => `${c.id}${c.hidden ? 'h' : ''}`).join(',') : '',
    ].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    if (!me) return waiting('Look at the TV!');
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'はっぴょうかい！'),
          h('p', {}, '🎤 Everyone gives a short talk in Japanese, on slides they’ve never seen.'),
          h('p', {}, '🖱️ Someone else picks your slides. 😂 Everyone else stamps and asks a question.'),
          h('p', { class: 'hint' }, 'Any sentence counts. Read one off your phone, or make your own for more.'),
        );
      case 'prompt':
        if (me.role === 'presenter') return titlePicker(ctx, me);
        if (me.role === 'assistant')
          return waiting(`🖱️ You’re ${nameOf(ctx, game.presenterId)}’s assistant`, 'You’ll pick each slide: 🙂 one that fits, 🎲 a random one, or 🤪 something wild. And one mishap.');
        return waiting(`🎤 Next up: ${nameOf(ctx, game.presenterId)}`, 'Stamp while they talk, then ask them a question.');
      case 'answer':
        if (me.role === 'presenter') return presenting(ctx, me);
        if (me.role === 'assistant') return h('div', { class: 'screen' }, assisting(ctx, me), stamps(ctx));
        return watching(ctx);
      case 'encore':
        return questionTime(ctx, me);
      case 'reveal':
        return grade(ctx, me);
      case 'score':
        return scored(ctx, me);
      case 'finale':
        return voting(ctx, me);
      default:
        return waiting('Look at the TV!');
    }
  },
};
