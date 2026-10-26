// Word Gauntlet on the phone: write a fake meaning, hunt for the real one, take your
// telephone step, then play the shiritori showdown out loud.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { WordGauntletView } from '../../../shared/src/modes/views.js';
import { toRomaji } from '../../../shared/src/modes/wordGauntlet/romaji.js';
import { follows, repeatKey, wordReading } from '../../../shared/src/modes/wordGauntlet/shiritori.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<WordGauntletView>;

// Steps on the vote screen appear in time with the stage, timed from when this phase first showed.
let phaseShown = { seq: -1, at: 0 };
function delay(view: RoomView, ms: number): string {
  if (phaseShown.seq !== view.phaseSeq) phaseShown = { seq: view.phaseSeq, at: performance.now() };
  return `animation-delay:${Math.round(ms - (performance.now() - phaseShown.at))}ms`;
}

export const wordGauntletPhone: PhoneMode<WordGauntletView> = {
  key(view, game, playerId) {
    const f = game.fake;
    const t = game.telephone;
    const sh = game.shiritori;
    return [
      view.phaseSeq,
      game.segment,
      f ? [f.mine?.fake, f.mine?.pick, f.mine?.said, f.options?.length, f.results ? 1 : 0].join(',') : '',
      t ? [t.mine?.sent, t.mine?.vote, t.mine?.prev ? 1 : 0, t.current, t.reveal ? 1 : 0, t.points ? 1 : 0].join(',') : '',
      sh
        ? [sh.turn === playerId, sh.turn, sh.mine?.hint?.length ?? -1, sh.mine?.tokens, sh.mine?.vote, sh.alive.includes(playerId), sh.challenge?.voted.length ?? -1, sh.winnerId].join(',')
        : '',
    ].join('|');
  },

  render(ctx) {
    const { view, game } = ctx;
    if (view.phase === 'intro' || !game.segment) {
      return waiting('ことばの関門 · Word Gauntlet', 'Three rounds: fake meanings, a translation telephone, then a spoken shiritori showdown. Watch the screen!');
    }
    if (game.segment === 'fake') return fakeScreen(ctx);
    if (game.segment === 'telephone') return telephoneScreen(ctx);
    return shiritoriScreen(ctx);
  },
};

const isKanaLevel = (ctx: Ctx) => ctx.me.level === 'kana';
const nameOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? '…';

function word(text: string, kana: string, romaji: string | null, extra?: string): HTMLElement {
  return h(
    'div',
    { class: 'wg-word' },
    h('p', { class: 'wg-kanji', lang: 'ja' }, text),
    kana && kana !== text ? h('p', { class: 'wg-kana', lang: 'ja' }, kana) : null,
    romaji ? h('p', { class: 'wg-romaji' }, romaji) : null,
    extra ? h('p', { class: 'hint' }, extra) : null,
  );
}

// ---- Round 1: Fake Kanji ----

function fakeScreen(ctx: Ctx): HTMLElement {
  const { view, game, send, flash } = ctx;
  const f = game.fake!;
  const romaji = isKanaLevel(ctx) ? f.word.romaji : null;
  const title = h('p', { class: 'wg-tag' }, `Round 1 · Fake Kanji · word ${f.index} of ${f.total}`);
  switch (view.phase) {
    case 'prompt':
      return h('div', { class: 'screen' }, title, word(f.word.text, f.word.kana, romaji), h('p', { class: 'hint' }, 'Nobody knows this one. Get ready to make up what it means!'));
    case 'answer': {
      if (f.mine?.fake) return h('div', { class: 'screen' }, title, word(f.word.text, f.word.kana, romaji), waiting('Fake sent!', `“${f.mine.fake}”. Waiting for the others…`));
      const input = h('input', { maxlength: MAX_ANSWER_LENGTH, placeholder: 'A fake meaning, in English', autocomplete: 'off', enterkeyhint: 'send' }) as HTMLInputElement;
      return h(
        'form',
        {
          class: 'screen',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            void send({ kind: 'fake', text }).then((ok) => {
              if (!ok) flash('Too close to the real meaning (or already sent)! Try a sneakier fake.');
            });
          },
        },
        title,
        word(f.word.text, f.word.kana, romaji),
        h('p', { class: 'prompt' }, 'What does it mean? Write a fake meaning that sounds real.'),
        input,
        h('button', { class: 'primary', type: 'submit' }, 'Send my fake'),
      );
    }
    case 'reveal': {
      if (f.mine?.pick) return h('div', { class: 'screen' }, title, waiting('Locked in!', 'Waiting for the others…'));
      const options = f.options ?? [];
      return h(
        'div',
        { class: 'screen' },
        title,
        word(f.word.text, f.word.kana, romaji),
        h('p', { class: 'prompt' }, 'Which meaning is real?'),
        options.map((o) =>
          o.id === f.mine?.optionId
            ? h('button', { class: 'option wg-own', disabled: true }, `${o.text} (yours)`)
            : h('button', { class: 'option', onclick: () => void send({ kind: 'pick', optionId: o.id }) }, o.text),
        ),
      );
    }
    default: {
      const golden = f.golden;
      const results = f.results ?? [];
      const mine = ctx.me.id;
      const real = results.find((r) => r.real);
      const found = !!real?.pickedBy.some((p) => p.id === mine);
      const myOption = results.find((r) => r.authors.some((a) => a.id === mine));
      const fooled = myOption && !myOption.real ? myOption.pickedBy.filter((p) => p.id !== mine).length : 0;
      const points = f.points?.[mine] ?? 0;
      const parts = [found ? 'You found the real one!' : 'You were fooled this time.', fooled ? `Your fake fooled ${fooled}.` : null].filter(Boolean).join(' ');
      return h(
        'div',
        { class: 'screen' },
        title,
        golden ? word(golden.jp.text, golden.jp.kana, isKanaLevel(ctx) ? toRomaji(golden.jp.kana) : null, golden.jp.en) : null,
        h('p', { class: 'big' }, `+${points}`),
        h('p', { class: 'hint' }, parts),
        f.mine?.said
          ? h('p', { class: 'wg-good' }, f.mine.said === 'speech' ? 'You said the golden word! It’s in your phrasebook.' : 'Typed it! Say it out loud next time for a bigger bonus.')
          : golden
            ? h(
                'div',
                { class: 'screen' },
                h('p', { class: 'prompt' }, `Golden word! Say it with the room: ${golden.jp.kana}`),
                speakBox({
                  label: `Hold and say ${golden.jp.kana}`,
                  placeholder: golden.jp.kana,
                  kanaPadOpen: isKanaLevel(ctx),
                  onSend: (u) =>
                    void send({ kind: 'say', utterance: u }).then((ok) => {
                      if (!ok) flash(`Not quite: it’s ${golden.jp.kana}${isKanaLevel(ctx) ? ` (${toRomaji(golden.jp.kana)})` : ''}. Try again!`);
                    }),
                }),
              )
            : null,
      );
    }
  }
}

// ---- Round 2: Lost in Translation ----

function telephoneScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const t = game.telephone!;
  const title = h('p', { class: 'wg-tag' }, 'Round 2 · Lost in Translation · double points');
  const mine = t.mine;
  const myStep = mine?.step ?? null;
  const toLabel = (to: 'en' | 'jp' | null) => (to === 'en' ? 'English' : 'Japanese');
  switch (view.phase) {
    case 'prompt':
      return h(
        'div',
        { class: 'screen' },
        title,
        waiting(
          myStep === null ? 'Watch the sentence travel!' : `You’re step ${myStep + 1} of ${t.order.length}`,
          myStep === null ? '' : `You’ll see only the step before yours and turn it into ${toLabel(mine?.to ?? null)}.`,
        ),
      );
    case 'answer': {
      if (mine?.prev && !mine.sent) return telephoneStep(ctx, title);
      if (mine?.sent) return h('div', { class: 'screen' }, title, waiting('Sent!', `“${mine.sent}”. Now watch it drift…`));
      const current = t.order[t.current];
      return h(
        'div',
        { class: 'screen' },
        title,
        waiting(`${nameOf(view, current?.playerId)} is translating…`, myStep !== null && myStep > t.current ? `Your turn is step ${myStep + 1}. Get ready!` : ''),
      );
    }
    case 'reveal': {
      const reveal = t.reveal;
      if (!reveal) return waiting('Watch the screen!');
      if (mine?.vote !== null && mine?.vote !== undefined) return h('div', { class: 'screen' }, title, waiting('Vote in!', 'Waiting for the others…'));
      const steps = reveal.steps.filter((st) => st.text !== null);
      return h(
        'div',
        { class: 'screen' },
        title,
        h('p', { class: 'prompt' }, 'Vote for your favourite step'),
        h('p', { class: 'hint wg-start', lang: 'ja' }, `Start: ${reveal.starter.text}`),
        steps.map((st, i) => {
          const own = st.playerId === ctx.me.id;
          return h(
            'button',
            {
              class: `option wg-step ${own ? 'wg-own' : ''}`,
              style: delay(view, (st.index + 1) * t.revealStepMs),
              disabled: own,
              lang: st.to === 'jp' ? 'ja' : 'en',
              onclick: () => void send({ kind: 'vote', step: st.index }),
            },
            h('small', {}, `${st.index + 1}. ${nameOf(view, st.playerId)} → ${toLabel(st.to)}${own ? ' (yours)' : ''}`),
            h('span', {}, st.text ?? ''),
          );
        }),
      );
    }
    default: {
      const points = t.points?.[ctx.me.id] ?? 0;
      const votes = myStep !== null ? (t.votes?.[myStep] ?? 0) : 0;
      return waiting(`+${points}`, myStep !== null ? `${votes} vote${votes === 1 ? '' : 's'} for your step.` : '');
    }
  }
}

function telephoneStep(ctx: Ctx, title: HTMLElement): HTMLElement {
  const { game, send, flash } = ctx;
  const mine = game.telephone!.mine!;
  const prev = mine.prev!;
  const shown =
    prev.lang === 'jp'
      ? word(prev.text, prev.reading ?? '', isKanaLevel(ctx) && prev.romaji ? prev.romaji : null)
      : h('div', { class: 'wg-word' }, h('p', { class: 'wg-en' }, prev.text));
  if (mine.to === 'en') {
    const input = h('input', { maxlength: MAX_ANSWER_LENGTH, placeholder: 'In English…', autocomplete: 'off', enterkeyhint: 'send' }) as HTMLInputElement;
    return h(
      'form',
      {
        class: 'screen',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          if (!/[A-Za-z]/.test(text)) return flash('Write this step in English.');
          void send({ kind: 'step', utterance: { via: 'typed', text } });
        },
      },
      title,
      h('p', { class: 'prompt' }, 'Translate into English:'),
      shown,
      input,
      h('button', { class: 'primary', type: 'submit' }, 'Pass it on'),
    );
  }
  return h(
    'div',
    { class: 'screen' },
    title,
    h('p', { class: 'prompt' }, 'Say it in Japanese:'),
    shown,
    speakBox({
      label: 'Hold and say it in Japanese',
      placeholder: '日本語で…',
      kanaPadOpen: isKanaLevel(ctx),
      maxLength: MAX_ANSWER_LENGTH,
      onSend: (u) => {
        if (!/[ぁ-ゖァ-ヺー㐀-鿿]/.test(u.text)) return flash('This step needs Japanese (kana or kanji).');
        void send({ kind: 'step', utterance: u });
      },
    }),
  );
}

// ---- Round 3: Shiritori Showdown ----

function shiritoriScreen(ctx: Ctx): HTMLElement {
  const { view, game, send, flash } = ctx;
  const sh = game.shiritori!;
  const me = ctx.me.id;
  const title = h('p', { class: 'wg-tag' }, 'Round 3 · Shiritori Showdown');
  const alive = sh.alive.includes(me);
  const needRomaji = isKanaLevel(ctx) ? sh.needOptions.map((k) => toRomaji(k)).join(' / ') : '';
  const needText = `${sh.needOptions.join(' / ')}${needRomaji ? ` (${needRomaji})` : ''}`;
  const lastWord = sh.chain.at(-1);
  const status = h(
    'p',
    { class: 'hint' },
    `${sh.mine?.tokens ?? 0} hint token${sh.mine?.tokens === 1 ? '' : 's'} · ${Math.round((sh.bankMs[me] ?? 0) / 1000)} s time bank`,
  );

  if (view.phase === 'prompt') {
    return h(
      'div',
      { class: 'screen' },
      title,
      h(
        'ul',
        { class: 'wg-rules' },
        h('li', {}, 'Say a word that starts with the last kana of the word before.'),
        h('li', {}, 'A word ending in ん knocks you out.'),
        h('li', {}, 'ー counts from the kana before it (コーヒー → ひ). Small kana count as big (きしゃ → や).'),
        h('li', {}, 'か or が, は or ば or ぱ: either is fine. No repeats.'),
      ),
      status,
    );
  }

  if (view.phase === 'answer') {
    if (sh.turn === me) {
      const used = new Set(sh.chain.map((w) => repeatKey(w.reading)));
      const hint = sh.mine?.hint;
      return h(
        'div',
        { class: 'screen' },
        title,
        h('p', { class: 'big wg-yourturn' }, 'Your turn!'),
        lastWord ? h('p', { class: 'hint', lang: 'ja' }, `After: ${lastWord.text}`) : null,
        h('p', { class: 'wg-need', lang: 'ja' }, sh.needOptions.join(' / ')),
        needRomaji ? h('p', { class: 'wg-romaji wg-center' }, needRomaji) : null,
        speakBox({
          label: `Hold and say a word starting with ${sh.needOptions[0]}`,
          placeholder: `${sh.needOptions[0]}…`,
          kanaPadOpen: isKanaLevel(ctx),
          maxLength: 40,
          onSend: (u) => {
            const reading = wordReading(u.text);
            // Kana we can check here; kanji goes to the server, which reads it.
            if (reading && !follows(sh.need, reading)) return flash(`Start with ${sh.needOptions.join(' or ')}!`);
            if (reading && used.has(repeatKey(reading))) return flash('Already said this game! Try another word.');
            void send({ kind: 'word', utterance: u }).then((ok) => {
              if (!ok) flash(`It must start with ${sh.needOptions.join(' or ')}, be new, and be in kana or kanji.`);
            });
          },
        }),
        hint
          ? h(
              'div',
              { class: 'wg-hint' },
              h('p', { class: 'hint' }, hint.length ? 'Hint words:' : 'No hint words for this kana. Be brave!'),
              hint.map((w) => h('p', { lang: 'ja' }, h('strong', {}, w.kana), isKanaLevel(ctx) ? ` (${toRomaji(w.kana)})` : '', h('small', {}, ` ${w.en}`))),
            )
          : (sh.mine?.tokens ?? 0) > 0
            ? h('button', { class: 'secondary', type: 'button', onclick: () => void send({ kind: 'hint' }) }, `Use a hint token (${sh.mine?.tokens} left)`)
            : null,
      );
    }
    return h(
      'div',
      { class: 'screen' },
      title,
      waiting(alive ? `${nameOf(view, sh.turn)}’s turn` : 'You’re out', alive ? `Next kana: ${needText}` : 'You’ll judge any word the room isn’t sure about.'),
      alive ? status : null,
    );
  }

  if (view.phase === 'reveal') {
    const c = sh.challenge;
    if (!c) return waiting('Watch the screen!');
    const judge = c.voters.includes(me);
    if (!judge || (sh.mine?.vote !== null && sh.mine?.vote !== undefined)) {
      return h('div', { class: 'screen' }, title, waiting(`Is “${c.text}” a word?`, judge ? 'Vote in. Waiting for the other judges…' : 'The judges are deciding…'));
    }
    return h(
      'div',
      { class: 'screen' },
      title,
      h('p', { class: 'prompt' }, `${nameOf(view, c.playerId)} said:`),
      word(c.text, c.reading, isKanaLevel(ctx) ? toRomaji(c.reading) : null),
      h('p', { class: 'hint' }, 'Is it a real Japanese word? A tie lets it through.'),
      h('div', { class: 'wg-judge' }, [
        h('button', { class: 'primary', type: 'button', onclick: () => void send({ kind: 'judge', accept: true }) }, 'Real word'),
        h('button', { class: 'secondary', type: 'button', onclick: () => void send({ kind: 'judge', accept: false }) }, 'Not a word'),
      ]),
    );
  }

  const won = sh.winnerId === me;
  const points = sh.points?.[me] ?? 0;
  return waiting(won ? 'しりとり王! You won the showdown!' : `${nameOf(view, sh.winnerId)} wins the showdown!`, `+${points} this round`);
}
