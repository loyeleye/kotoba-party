// Kana Yōkai Raid on the phone: mark your chapters, then attack the yōkai the server deals
// you. Shout attacks use speakBox (hold-to-talk with a typed fallback) plus four tappable
// sounds as the quiet fallback; listening attacks voice the sound with the phone's ja-JP
// speech synthesis, or show it written when there's no Japanese voice. Ink Storm draws on
// inkPad, then asks to say what you drew.

import { h, ruby } from '../../../shared/src/dom.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import type { AttackView, KanaRaidView, LastResult, RaidOption } from '../../../shared/src/modes/kanaRaid/kanaRaid.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { inkPad } from '../components/inkPad.js';
import { canSpeak, micChip, speakBox } from '../components/speak.js';
import { canVoice, hearButton as voiceButton, say } from '../components/voice.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';
import { account } from '../account.js';

// ---------- speech synthesis ----------

const hearButton = (text: string, label = '🔊 Hear it', big = false): HTMLElement | null => voiceButton(text, label, `raid-hear${big ? ' big' : ''}`);

/** The sound, voiced; written out too when the phone can't voice Japanese. */
function listen(a: AttackView, auto: boolean): HTMLElement {
  if (auto && a.hear) setTimeout(() => say(a.hear!), 250);
  return h(
    'div',
    { class: 'raid-listen' },
    a.hear ? hearButton(a.hear, '🔊 Hear it again', true) : null,
    !canVoice() && a.hearText ? h('p', { class: 'raid-heartext', lang: 'ja' }, a.hearText) : null,
  );
}

// ---------- screens ----------

const PROMPTS: Record<AttackView['kind'], string> = {
  shout: 'Shout its sound!',
  twin: 'Tap its twin from the other alphabet',
  lookalike: 'Shapeshifter! What does it really say?',
  echo: 'Echo: which voice is its own?',
  pair: 'Which word did you hear?',
  draw: 'Ink Storm! Draw its true form',
  piece: 'Break your piece of the boss!',
  blow: 'Finishing blow: read the whole word together!',
};

export const kanaRaidPhone: PhoneMode<KanaRaidView> = {
  key: (view, game) => {
    const me = game.me;
    return [
      view.phaseSeq,
      me?.ready,
      me?.chapters.join(','),
      me?.attack?.id,
      me?.attack?.step,
      me?.last?.attackId,
      me?.coach?.tip,
      game.ink,
      game.boss?.stage,
      game.waveResult ? 1 : 0,
      me?.recap ? 1 : 0,
    ].join('|');
  },

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    if (!me) return waiting('Watch the stage!', 'You’re cheering this raid on.');
    switch (view.phase) {
      case 'intro':
        return chapterPick(ctx);
      case 'prompt':
        return banner(game);
      case 'answer':
      case 'finale':
        return battle(ctx);
      case 'reveal':
      case 'score': {
        const mine = game.waveResult?.players.find((p) => p.playerId === ctx.me.id);
        return h(
          'div',
          { class: 'screen raid' },
          h('p', { class: 'big' }, game.waveResult ? (game.waveResult.escaped ? `Wave ${game.waveResult.wave} over!` : `Wave ${game.waveResult.wave} cleared!`) : 'Wave over'),
          mine
            ? h('p', { class: 'raid-stat' }, `${mine.hits} hit${mine.hits === 1 ? '' : 's'} · +${mine.points} pts`, mine.bonus ? h('small', {}, ` (+${mine.bonus} for speaking)`) : null)
            : null,
          mine && mine.misses ? h('p', { class: 'hint' }, `${mine.misses} miss${mine.misses === 1 ? '' : 'es'}: those go on your haunted list, no points lost.`) : null,
          h('p', { class: 'hint' }, 'Look at the stage!'),
        );
      }
      case 'encore':
        return recap(game);
      default:
        return waiting('Look at the stage!');
    }
  },
};

function chapterPick({ game, send, isVip }: PhoneContext<KanaRaidView>): HTMLElement {
  const me = game.me!;
  const chosen = new Set(me.chapters);
  const toggle = (n: number) => {
    const next = new Set(chosen);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    if (next.size === 0) return;
    void send({ kind: 'chapters', chapters: [...next].sort((a, b) => a - b) });
  };
  return h(
    'div',
    { class: 'screen raid' },
    h('p', { class: 'big' }, 'Which chapters have you studied?'),
    h('p', { class: 'hint' }, 'Yōkai will only attack you with kana from these. New to kana? Just keep chapter 1.'),
    h(
      'div',
      { class: 'raid-chapters' },
      game.chapters.map((c) =>
        h(
          'button',
          { type: 'button', class: `raid-chapter${chosen.has(c.number) ? ' on' : ''}`, 'aria-pressed': chosen.has(c.number) ? 'true' : 'false', onclick: () => toggle(c.number) },
          h('span', { class: 'raid-chapter-n' }, c.number),
          h('span', { class: 'raid-chapter-t' }, c.title),
          h('span', { class: 'raid-chapter-s', lang: 'ja' }, c.sample),
        ),
      ),
    ),
    isVip && game.inkAvailable
      ? h(
          'button',
          { type: 'button', class: `raid-ink-toggle${game.ink ? ' on' : ''}`, 'aria-pressed': game.ink ? 'true' : 'false', onclick: () => void send({ kind: 'ink', on: !game.ink }) },
          h('span', { lang: 'ja' }, '墨の嵐 '),
          game.ink ? 'Ink Storm wave: on (draw kana on your phones)' : 'Ink Storm wave: off',
        )
      : game.ink
        ? h('p', { class: 'hint small' }, '🖌 Tonight’s raid has an Ink Storm: you’ll draw kana on your phone.')
        : null,
    me.ready
      ? h('p', { class: 'raid-ready' }, '✓ Ready! You can still change your chapters.')
      : h('button', { type: 'button', class: 'primary', onclick: () => void send({ kind: 'ready' }) }, 'Ready!'),
  );
}

function banner(game: KanaRaidView): HTMLElement {
  const w = game.waveInfo;
  return h(
    'div',
    { class: 'screen raid raid-banner' },
    h('p', { class: 'raid-wave' }, game.wave > game.waves ? 'BOSS' : `WAVE ${game.wave}`),
    w ? h('p', { class: 'big' }, ruby({ text: w.titleJa, kana: w.titleKana }), ' ', w.title) : null,
    w ? h('p', { class: 'hint' }, w.how) : null,
  );
}

/** Ink Storm: your drawing next to how it's written (replayed stroke by stroke). */
function inkReplay(ink: NonNullable<LastResult['ink']>): HTMLElement {
  return h(
    'div',
    { class: 'raid-ink-replay' },
    h('figure', {}, inkSvg(ink.mine, { class: 'mine', strokeMs: 250 }), h('figcaption', {}, 'yours')),
    h('figure', {}, inkSvg(ink.ref, { class: 'ref', grid: true, numbers: true, strokeMs: 600, elapsedMs: -300 }), h('figcaption', {}, 'how it’s written')),
  );
}

// A say scored after you moved on shows for a few seconds (the phone redraws often, so time it here).
const saidSeen = new Map<string, number>();
function saidLine(said: LastResult | null): HTMLElement | null {
  if (!said) return null;
  const first = saidSeen.get(said.attackId) ?? Date.now();
  if (saidSeen.size > 20) saidSeen.clear();
  saidSeen.set(said.attackId, first);
  if (Date.now() - first > 5_000) return null;
  return h(
    'p',
    { class: `raid-said ${said.ok ? 'ok' : 'miss'}` },
    '🎤 ',
    h('span', { lang: 'ja' }, said.char),
    said.ok ? (said.points ? ` said it! +${said.points}` : ' ✓') : ` ${said.tip ?? 'not quite.'}`,
  );
}

function lastStrip(last: LastResult | null): HTMLElement | null {
  if (!last) return null;
  if (last.kind === 'draw' && last.ink) {
    return h(
      'div',
      { class: `raid-last ${last.ok ? 'ok' : 'miss'} ink` },
      last.ok ? h('strong', {}, last.ink.clean ? 'Clean strike!' : 'Hit!') : h('span', { class: 'raid-last-char', lang: 'ja' }, last.char),
      last.ok && last.points ? ` +${last.points}` : '',
      last.combo >= 2 ? h('span', { class: 'raid-combo-tag' }, ` COMBO ×${last.combo}`) : null,
      last.tip ? h('span', { class: 'raid-last-tip' }, last.tip) : null,
      last.ink.clean ? null : inkReplay(last.ink),
      last.retryNext ? h('small', {}, 'One more try:') : null,
    );
  }
  if (last.ok) {
    const what = last.kind === 'blow' ? 'You read it!' : last.kind === 'draw' ? (last.points ? 'Said it!' : 'On to the next!') : last.splash ? 'Splash hit!' : 'Hit!';
    return h(
      'div',
      { class: 'raid-last ok' },
      h('strong', {}, what),
      last.points ? ` +${last.points}` : '',
      last.combo >= 2 ? h('span', { class: 'raid-combo-tag' }, ` COMBO ×${last.combo}`) : null,
    );
  }
  return h(
    'div',
    { class: 'raid-last miss' },
    h('span', { class: 'raid-last-char', lang: 'ja' }, last.char),
    last.points < 0 ? h('span', { class: 'raid-last-lost' }, ` −${-last.points}`) : null,
    h('span', { class: 'raid-last-tip' }, last.tip ?? 'So close! It’ll be back.'),
    last.hear ? hearButton(last.hear, '🔊') : null,
    last.retryNext ? h('small', {}, 'One more try:') : null,
  );
}

function options(a: AttackView, send: (move: unknown) => Promise<boolean>, cls = ''): HTMLElement {
  const box = h('div', { class: `raid-options ${cls}` });
  const buttons = a.options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: 'raid-option',
        lang: 'ja',
        onclick: () => {
          for (const b of buttons) (b as HTMLButtonElement).disabled = true;
          void send({ kind: 'attack', attackId: a.id, pick: o.id }).then((ok) => {
            if (!ok) for (const b of buttons) (b as HTMLButtonElement).disabled = false;
          });
        },
      },
      h('span', {}, o.label),
      o.sub ? h('small', {}, o.sub) : null,
      // Training wheels on (chapter 1, or the かな level drawing): every choice carries its sound too.
      a.romaji && !o.sub ? h('small', { class: 'raid-opt-romaji', lang: 'en' }, toRomaji(o.label)) : null,
    ),
  );
  box.append(...buttons);
  return box;
}

function glyph(a: AttackView): HTMLElement {
  return h('div', { class: 'raid-glyph-wrap' }, h('p', { class: `raid-glyph${[...(a.show ?? '')].length > 1 ? ' wide' : ''}`, lang: 'ja' }, a.show ?? ''), a.romaji ? h('p', { class: 'raid-romaji' }, a.romaji) : null);
}

function speak(a: AttackView, send: (move: unknown) => Promise<boolean>, label: string, later = false): HTMLElement {
  // Mic on: just the talk button (no "Can't talk right now?"). Mic off: speakBox shows the typed box.
  // `later` (the say steps): once you've spoken you move on to the next yōkai while the phone
  // checks the recording; the result comes back as its own line.
  const extra = later ? { autoSend: true, onRecorded: () => void send({ kind: 'attack', attackId: a.id, pending: true }) } : {};
  return speakBox({ label, placeholder: 'Type it in kana', kanaPadOpen: false, maxLength: 20, speechOnly: true, ...extra, onSend: (u: Utterance) => void send({ kind: 'attack', attackId: a.id, say: u }) });
}

// ---------- picking a yōkai (waves 1–2) ----------

// The server's clock, from the view's `at` (as on the stage): a view arrives after it was made,
// so the largest `at - Date.now()` is the best offset.
let clockOffset = Number.NEGATIVE_INFINITY;
const serverNow = (game: KanaRaidView) => {
  clockOffset = Math.max(clockOffset, game.at - Date.now());
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
};
let aimTimer: ReturnType<typeof setInterval> | null = null;

/**
 * The yōkai on stage you can attack, front (nearest the gate) first: tap one to attack it.
 * Yōkai walk on and get away between updates, so the row redraws itself on the phone's clock.
 */
function aimStrip(game: KanaRaidView, current: string | null, send: (move: unknown) => Promise<boolean>): HTMLElement {
  const row = h('div', { class: 'raid-aim', role: 'group', 'aria-label': 'Pick a yōkai to attack' });
  const mine = new Set(game.me?.aimable ?? []);
  let shown = '';
  const draw = () => {
    if (!row.isConnected && shown) {
      if (aimTimer) clearInterval(aimTimer);
      aimTimer = null;
      return;
    }
    const now = serverNow(game);
    const here = game.horde.filter((y) => mine.has(y.id) && y.state === 'alive' && y.spawnAt <= now && y.escapeAt > now + 500)
      // In the order they stand on the TV: furthest along (nearest the gate) first.
      .sort((x, y) => (now - y.spawnAt) / (y.escapeAt - y.spawnAt) - (now - x.spawnAt) / (x.escapeAt - x.spawnAt));
    const key = here.map((y) => y.id).join(',') || '-';
    if (key === shown) return;
    shown = key;
    row.replaceChildren(
      h('span', { class: 'raid-aim-label' }, 'Pick a yōkai:'),
      ...here.map((y) =>
        h(
          'button',
          {
            type: 'button',
            class: `raid-aim-btn${y.id === current ? ' on' : ''}`,
            lang: 'ja',
            'aria-pressed': String(y.id === current),
            onclick: () => void send({ kind: 'aim', yokaiId: y.id }),
          },
          y.char,
        ),
      ),
    );
  };
  draw();
  if (aimTimer) clearInterval(aimTimer);
  aimTimer = setInterval(draw, 400);
  return row;
}

/** No Japanese voice on this phone: write the sound instead. */
const idle = (o: RaidOption) => (canVoice() ? '🔊' : (o.hear ?? ''));

/** Echo: numbered voices; the first tap plays one and picks it, a second tap on it strikes. */
let echoPicked: { attackId: string; option: string } | null = null;
function echoOptions(a: AttackView, send: (move: unknown) => Promise<boolean>): HTMLElement {
  const box = h('div', { class: 'raid-options echo' });
  const buttons = a.options.map((o) => {
    const b = h(
      'button',
      { type: 'button', class: `raid-option${echoPicked?.attackId === a.id && echoPicked.option === o.id ? ' picked' : ''}` },
      h('span', {}, o.label),
      h('small', { lang: 'ja' }, echoPicked?.attackId === a.id && echoPicked.option === o.id ? 'tap again to strike' : idle(o)),
    ) as HTMLButtonElement;
    b.addEventListener('click', () => {
      if (echoPicked?.attackId === a.id && echoPicked.option === o.id) {
        for (const x of buttons) x.disabled = true;
        void send({ kind: 'attack', attackId: a.id, pick: o.id }).then((ok) => {
          if (!ok) for (const x of buttons) x.disabled = false;
        });
        return;
      }
      if (o.hear) say(o.hear);
      echoPicked = { attackId: a.id, option: o.id };
      buttons.forEach((x, i) => {
        const on = a.options[i]!.id === o.id;
        x.classList.toggle('picked', on);
        x.querySelector('small')!.textContent = on ? 'tap again to strike' : idle(a.options[i]!);
      });
    });
    return b;
  });
  box.append(...buttons);
  return box;
}

/** With the mic off: the tap choices, under the line saying how the phone answers. */
function quietTap(a: AttackView, send: (move: unknown) => Promise<boolean>, hint: string): HTMLElement {
  return h('div', { class: 'speak' }, micChip(), h('p', { class: 'hint small' }, hint), options(a, send));
}

function battle(ctx: PhoneContext<KanaRaidView>): HTMLElement {
  const { game, send } = ctx;
  const me = game.me!;
  const a = me.attack;
  const head = lastStrip(me.last);
  if (!a) {
    const boss = game.boss;
    const sub = boss?.stage === 'blow' ? 'Waiting for everyone to read it…' : boss ? 'Your pieces are broken! Cheer the others on.' : 'Watch the stage!';
    return h('div', { class: 'screen raid' }, head, h('p', { class: 'big' }, 'Nice work!'), h('p', { class: 'hint' }, sub));
  }
  const ask = a.clue ? 'Which spelling is right?' : PROMPTS[a.kind];
  const prompt = (a.kind === 'pair' || a.kind === 'draw') && a.step === 'say' ? null : h('p', { class: 'raid-prompt' }, a.retry ? (a.kind === 'draw' ? 'Try again: draw its true form' : `Try again! ${ask}`) : ask);
  const coach = me.coach ? h('p', { class: 'raid-coach' }, '🖌 Your ', h('span', { lang: 'ja' }, me.coach.char), ': ', me.coach.tip) : null;
  const parts: (HTMLElement | null)[] = [head, saidLine(me.said), coach, me.canAim ? aimStrip(game, a.yokaiId, send) : null, prompt];
  switch (a.kind) {
    case 'shout':
      // Mic on: shout it. Mic off: tap its sound (hits a little softer).
      parts.push(glyph(a), canSpeak() ? speak(a, send, 'Hold and shout its sound') : quietTap(a, send, 'Tap its sound (shouting hits harder):'));
      break;
    case 'twin':
      parts.push(glyph(a), options(a, send));
      break;
    case 'lookalike':
      parts.push(glyph(a), options(a, send));
      break;
    case 'echo':
      parts.push(glyph(a), h('p', { class: 'hint small' }, 'Tap each to hear it. Tap the right one again to strike.'), echoOptions(a, send));
      break;
    case 'pair':
      // Sound off: the meaning is the clue, the two spellings the choices (kanaRaid.ts pairAttack).
      if (a.step === 'tap' && a.clue) parts.push(h('p', { class: 'raid-clue' }, 'Which one means ', h('b', {}, `“${a.clue}”`), '?'), options(a, send, 'pair'));
      else if (a.step === 'tap') parts.push(listen(a, true), options(a, send, 'pair'));
      else
        parts.push(
          h('p', { class: 'raid-say' }, 'Now say it!'),
          a.word ? h('div', { class: 'raid-word', lang: 'ja' }, h('span', {}, a.word.kana), h('small', {}, a.word.en)) : null,
          a.hear ? hearButton(a.hear) : null,
          speak(a, send, 'Hold and say it', true),
          h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'attack', attackId: a.id, pass: true }) }, 'Skip saying it'),
        );
      break;
    case 'draw':
      if (a.step === 'say')
        parts.push(
          h('p', { class: 'raid-say' }, 'Now say what you drew!'),
          a.word ? h('div', { class: 'raid-word', lang: 'ja' }, h('span', {}, a.word.text)) : null,
          speak(a, send, 'Hold and say its sound', true),
          h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'attack', attackId: a.id, pass: true }) }, 'Skip: next yōkai'),
        );
      else
        parts.push(
          h(
            'div',
            { class: 'raid-draw-cue' },
            h('span', { class: 'raid-mask', lang: 'ja' }, a.show ?? ''),
            h('span', { class: 'raid-draw-what' }, `→ draw it in ${a.script === 'katakana' ? 'katakana' : 'hiragana'}`, a.romaji ? h('small', {}, ` (${a.romaji})`) : null),
            a.hear ? hearButton(a.hear, '🔊') : null,
          ),
          inkPad({ key: a.id, onSend: (ink) => send({ kind: 'attack', attackId: a.id, ink }) }),
        );
      break;
    case 'piece':
      parts.push(glyph(a));
      if (a.hear) parts.push(canSpeak() ? speak(a, send, 'Hold and say its sound') : quietTap(a, send, 'Tap its sound:'));
      else parts.push(h('p', { class: 'hint' }, `What does ${a.show} do in a word?`), options(a, send, 'wide'));
      break;
    case 'blow':
      parts.push(
        a.word ? h('div', { class: 'raid-word boss', lang: 'ja' }, h('span', {}, a.word.text), h('small', {}, a.word.en)) : null,
        h('p', { class: 'hint' }, 'Everyone at once, out loud!'),
        speak(a, send, 'Hold and read it aloud'),
        h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'attack', attackId: a.id, pass: true }) }, 'Let the others read it'),
      );
      break;
  }
  return h('div', { class: `screen raid raid-${a.kind}` }, parts);
}

function recap(game: KanaRaidView): HTMLElement {
  const r = game.me?.recap;
  if (!r) return waiting('Raid over!', 'Look at the stage.');
  return h(
    'div',
    { class: 'screen raid' },
    h('p', { class: 'big' }, 'Tonight’s yōkai'),
    h('p', { class: 'hint' }, `Seen ${r.seen.length} · got right ${r.correct.length}`),
    r.correct.length ? h('div', { class: 'raid-chips', lang: 'ja' }, r.correct.map((c) => h('span', { class: 'raid-chip ok' }, c))) : null,
    r.haunted.length
      ? h(
          'div',
          { class: 'raid-haunted' },
          h('p', { class: 'raid-subhead' }, `Haunted list (${r.haunted.length})`),
          r.haunted.map((x) => h('div', { class: 'raid-haunt' }, h('span', { class: 'raid-chip miss', lang: 'ja' }, x.char), h('span', { class: 'raid-haunt-tip' }, x.tip ?? ''), hearButton(x.hear, '🔊'))),
        )
      : h('p', { class: 'hint' }, 'Nothing haunting you tonight!'),
    h(
      'p',
      { class: 'hint small' },
      account()
        ? 'A yōkai is caught after 3 right answers from memory on separate days. Tonight’s went into your yōkai cards: review them under My progress.'
        : 'A yōkai is caught after 3 right answers from memory on separate days. Sign in on the join screen to keep your yōkai cards between games.',
    ),
  );
}
