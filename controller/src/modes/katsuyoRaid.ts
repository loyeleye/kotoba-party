// Katsuyō Raid (活用レイド) on the phone: the Green Car Kana Yōkai Raid. The badge check, then the verb and its
// badge big (say the form, or tap it among its sibling forms), Wave 2's heard form (tap its badge, then say the
// plain verb), Wave 3's picture and gist (say a chunk with a word of your own), Ink Storm's kanji pad, and the
// boss: break your piece, then say the whole line from its gist. Every spoken answer can be typed; the tap
// fallback is always open on an N3 stretch badge. Art: placeholders (text badges and emoji).

import { h, ruby } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import { KANJI_LIMITS } from '../../../shared/src/japanese/strokes.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import type { BadgeView, KatsuyoAttackView, KatsuyoLast, KatsuyoRaidView } from '../../../shared/src/modes/kanaRaid/katsuyoRaid.js';
import type { BadgeId } from '../../../content/src/katsuyo/verbs.js';
import { inkPad } from '../components/inkPad.js';
import { canSpeak, micChip, speakBox } from '../components/speak.js';
import { canVoice, hearButton as voiceButton, say } from '../components/voice.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

const hearButton = (text: string, label = '🔊 Hear it', big = false): HTMLElement | null => voiceButton(text, label, `raid-hear${big ? ' big' : ''}`);

function sash(b: BadgeView | undefined | null): HTMLElement | null {
  if (!b) return null;
  return h('span', { class: `ky-badge ${b.side}`, lang: 'ja' }, `${b.icon} ${b.ja}`, h('small', {}, ` ${b.en}`), b.side === 'n3' ? h('em', { class: 'ky-n3tag' }, 'N3') : null);
}

const PROMPTS: Record<KatsuyoAttackView['kind'], string> = {
  form: 'Say the verb in its badge’s form!',
  badge: 'Which badge is this form wearing?',
  chunk: 'Say it in Japanese, with the verb in its badge’s form and a word of your own',
  draw: 'Ink Storm! Write the missing kanji from memory',
  piece: 'Break your piece: say its form!',
  blow: 'Finishing blow: say the whole line from memory!',
};

export const katsuyoRaidPhone: PhoneMode<KatsuyoRaidView> = {
  key: (view, game) => {
    const me = game.me;
    return [view.phaseSeq, me?.ready, me?.badges.join(','), me?.attack?.id, me?.attack?.step, me?.last?.attackId, me?.said?.attackId, game.ink, game.boss?.stage, game.boss?.defeated, game.waveResult ? 1 : 0, me?.recap ? 1 : 0].join('|');
  },

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    if (!me) return waiting('Watch the stage!', 'You’re cheering this raid on.');
    switch (view.phase) {
      case 'intro':
        return badgeCheck(ctx);
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
          mine ? h('p', { class: 'raid-stat' }, `${mine.hits} hit${mine.hits === 1 ? '' : 's'} · +${mine.points} pts`, mine.bonus ? h('small', {}, ` (+${mine.bonus} for speaking)`) : null) : null,
          mine && mine.misses ? h('p', { class: 'hint' }, `${mine.misses} miss${mine.misses === 1 ? '' : 'es'}: those go on your haunted list. Spoken misses cost nothing.`) : null,
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

function badgeCheck({ game, send, isVip }: PhoneContext<KatsuyoRaidView>): HTMLElement {
  const me = game.me!;
  const on = new Set<BadgeId>(me.badges);
  const toggle = (id: BadgeId) => {
    const next = new Set(on);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void send({ kind: 'badges', badges: [...next] });
  };
  const side = (s: 'n4' | 'n3') =>
    game.chart
      .filter((b) => b.side === s)
      .map((b) =>
        h(
          'button',
          { type: 'button', class: `ky-badge-pick${on.has(b.id) ? ' on' : ''}`, 'aria-pressed': on.has(b.id) ? 'true' : 'false', onclick: () => toggle(b.id) },
          sash(b),
          h('span', { class: 'ky-badge-ex', lang: 'ja' }, b.example.kana),
        ),
      );
  return h(
    'div',
    { class: 'screen raid' },
    h('p', { class: 'big' }, 'Your badges tonight'),
    h('p', { class: 'hint' }, me.level === 'n3' ? 'N3: you get N4 and N3 badges in turn. Untick any you want to skip.' : 'N4: your N4 badges are on. Tick N3 badges for optional stretch (worth a bit more, and you can always tap).'),
    h('p', { class: 'raid-subhead' }, 'N4'),
    h('div', { class: 'ky-badge-grid' }, side('n4')),
    h('p', { class: 'raid-subhead' }, 'N3'),
    h('div', { class: 'ky-badge-grid' }, side('n3')),
    isVip && game.inkAvailable
      ? h(
          'button',
          { type: 'button', class: `raid-ink-toggle${game.ink ? ' on' : ''}`, 'aria-pressed': game.ink ? 'true' : 'false', onclick: () => void send({ kind: 'ink', on: !game.ink }) },
          h('span', { lang: 'ja' }, '墨の嵐 '),
          game.ink ? 'Ink Storm wave: on (write kanji on your phones)' : 'Ink Storm wave: off',
        )
      : null,
    me.ready ? h('p', { class: 'raid-ready' }, '✓ Ready! You can still change your badges.') : h('button', { type: 'button', class: 'primary', onclick: () => void send({ kind: 'ready' }) }, 'Ready!'),
  );
}

function banner(game: KatsuyoRaidView): HTMLElement {
  const w = game.waveInfo;
  return h(
    'div',
    { class: 'screen raid raid-banner' },
    h('p', { class: 'raid-wave' }, game.wave > game.waves ? 'BOSS' : `WAVE ${game.wave}`),
    w ? h('p', { class: 'big' }, ruby({ text: w.titleJa, kana: w.titleKana }), ' ', w.title) : null,
    w ? h('p', { class: 'hint' }, w.how) : null,
  );
}

function speak(a: KatsuyoAttackView, send: (move: unknown) => Promise<boolean>, label: string, later = false): HTMLElement {
  const extra = later ? { autoSend: true, onRecorded: () => void send({ kind: 'attack', attackId: a.id, pending: true }) } : {};
  return speakBox({ label, placeholder: 'Type it in kana', kanaPadOpen: false, maxLength: 60, ...extra, onSend: (u: Utterance) => void send({ kind: 'attack', attackId: a.id, say: u }) });
}

function options(a: KatsuyoAttackView, send: (move: unknown) => Promise<boolean>, cls = ''): HTMLElement {
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
    ),
  );
  box.append(...buttons);
  return box;
}

function lastStrip(last: KatsuyoLast | null): HTMLElement | null {
  if (!last) return null;
  if (last.kind === 'draw' && last.ink && !last.ink.clean) {
    return h(
      'div',
      { class: `raid-last ${last.ok ? 'ok' : 'miss'} ink` },
      h('strong', {}, last.ok ? 'Hit!' : last.label),
      last.ok && last.points ? ` +${last.points}` : '',
      last.tip ? h('span', { class: 'raid-last-tip' }, last.tip) : null,
      h(
        'div',
        { class: 'raid-ink-replay' },
        h('figure', {}, inkSvg(last.ink.mine, { class: 'mine', strokeMs: 250 }), h('figcaption', {}, 'yours')),
        h('figure', {}, inkSvg(last.ink.ref, { class: 'ref', grid: true, numbers: true, strokeMs: 600, elapsedMs: -300 }), h('figcaption', {}, 'how it’s written')),
      ),
    );
  }
  if (last.ok) {
    const what = last.kind === 'blow' ? 'You said it!' : last.counted ? 'Chunk strike! ✦ counts toward the path' : last.splash ? 'Splash hit!' : 'Hit!';
    return h('div', { class: 'raid-last ok' }, h('strong', {}, what), last.points ? ` +${last.points}` : '', last.combo >= 2 ? h('span', { class: 'raid-combo-tag' }, ` COMBO ×${last.combo}`) : null, last.tip ? h('span', { class: 'raid-last-tip' }, last.tip) : null);
  }
  return h(
    'div',
    { class: 'raid-last miss' },
    h('span', { class: 'raid-last-char', lang: 'ja' }, last.label),
    last.points < 0 ? h('span', { class: 'raid-last-lost' }, ` −${-last.points}`) : null,
    h('span', { class: 'raid-last-tip' }, last.tip ?? 'So close! It’ll be back.'),
    last.hear ? hearButton(last.hear, '🔊') : null,
    last.retryNext ? h('small', {}, 'One more try:') : null,
  );
}

const saidSeen = new Map<string, number>();
function saidLine(said: KatsuyoLast | null): HTMLElement | null {
  if (!said) return null;
  const first = saidSeen.get(said.attackId) ?? Date.now();
  if (saidSeen.size > 20) saidSeen.clear();
  saidSeen.set(said.attackId, first);
  if (Date.now() - first > 5_000) return null;
  return h('p', { class: `raid-said ${said.ok ? 'ok' : 'miss'}` }, '🎤 ', h('span', { lang: 'ja' }, said.label), said.ok ? (said.points ? ` +${said.points}` : ' ✓') : ` ${said.tip ?? 'not quite.'}`);
}

// The server's clock, as on the stage.
let clockOffset = Number.NEGATIVE_INFINITY;
const serverNow = (game: KatsuyoRaidView) => {
  clockOffset = Math.max(clockOffset, game.at - Date.now());
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
};
let aimTimer: ReturnType<typeof setInterval> | null = null;

/** Waves 1–2: the yōkai on stage you can attack, front first. */
function aimStrip(game: KatsuyoRaidView, current: string | null, send: (move: unknown) => Promise<boolean>): HTMLElement {
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
    const here = game.horde
      .filter((y) => mine.has(y.id) && y.state === 'alive' && y.spawnAt <= now && y.escapeAt > now + 500)
      .sort((x, y) => (now - y.spawnAt) / (y.escapeAt - y.spawnAt) - (now - x.spawnAt) / (x.escapeAt - x.spawnAt));
    const key = here.map((y) => y.id).join(',') || '-';
    if (key === shown) return;
    shown = key;
    row.replaceChildren(
      h('span', { class: 'raid-aim-label' }, 'Pick a yōkai:'),
      ...here.map((y) =>
        h('button', { type: 'button', class: `raid-aim-btn${y.id === current ? ' on' : ''}`, lang: 'ja', 'aria-pressed': String(y.id === current), onclick: () => void send({ kind: 'aim', yokaiId: y.id }) }, y.tag, y.badge ? h('small', {}, ` ${y.badge.icon}`) : null),
      ),
    );
  };
  draw();
  if (aimTimer) clearInterval(aimTimer);
  aimTimer = setInterval(draw, 400);
  return row;
}

function verbCard(a: KatsuyoAttackView): HTMLElement {
  return h('div', { class: 'ky-verb' }, a.verb ? h('p', { class: 'raid-glyph wide', lang: 'ja' }, a.verb.kana) : null, a.verb ? h('p', { class: 'hint small' }, a.verb.en) : null, sash(a.badge), a.stretch ? h('p', { class: 'hint small' }, 'N3 stretch: worth more, and you can tap.') : null);
}

function battle(ctx: PhoneContext<KatsuyoRaidView>): HTMLElement {
  const { game, send } = ctx;
  const me = game.me!;
  const a = me.attack;
  const head = lastStrip(me.last);
  if (!a) {
    const boss = game.boss;
    const sub = boss?.stage === 'blow' ? 'Waiting for everyone to say the line…' : boss ? 'Your pieces are broken! Cheer the others on.' : 'Watch the stage!';
    return h('div', { class: 'screen raid' }, head, saidLine(me.said), h('p', { class: 'big' }, 'Nice work!'), h('p', { class: 'hint' }, sub));
  }
  const ask = PROMPTS[a.kind];
  const sayStep = (a.kind === 'badge' || a.kind === 'draw') && a.step === 'say';
  const prompt = sayStep ? null : h('p', { class: 'raid-prompt' }, a.retry ? `Try again! ${ask}` : ask);
  const parts: (HTMLElement | null)[] = [head, saidLine(me.said), me.canAim ? aimStrip(game, a.yokaiId, send) : null, prompt];
  const pass = (label: string) => h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'attack', attackId: a.id, pass: true }) }, label);
  switch (a.kind) {
    case 'form':
    case 'piece': {
      parts.push(verbCard(a));
      // Mic on: say it (typing works too); mic off, or an N3 stretch: the four forms to tap.
      if (canSpeak()) parts.push(speak(a, send, 'Hold and say the form'));
      if (!canSpeak() || a.stretch) parts.push(h('div', { class: 'speak' }, canSpeak() ? null : micChip(), h('p', { class: 'hint small' }, 'Or tap its form (softer hit):'), options(a, send)));
      break;
    }
    case 'badge':
      if (a.step === 'tap') {
        if (a.read || !canVoice()) parts.push(h('p', { class: 'raid-heartext', lang: 'ja' }, a.hearText ?? ''));
        if (!a.read && a.hear) {
          setTimeout(() => say(a.hear!), 250);
          parts.push(hearButton(a.hear, '🔊 Hear it again', true));
        }
        parts.push(options(a, send, 'wide'));
      } else parts.push(h('p', { class: 'raid-say' }, 'Now say the plain verb (dictionary form)!'), speak(a, send, 'Hold and say the plain verb', true), pass('Skip saying it'));
      break;
    case 'chunk':
      parts.push(
        h('div', { class: 'ky-chunk' }, h('span', { class: 'ky-chunk-pic', 'aria-hidden': 'true' }, a.picture ?? ''), h('p', { class: 'ky-gist' }, `“${a.gist ?? ''}”`), sash(a.badge), a.verb ? h('p', { class: 'hint small', lang: 'ja' }, `verb: ${a.verb.kana} (${a.verb.en})`) : null),
        speak(a, send, 'Hold and say your chunk', true),
        pass('Pass: show Fude’s version'),
      );
      break;
    case 'draw':
      if (a.step === 'say') parts.push(h('p', { class: 'raid-say' }, 'Now say the word!'), a.word ? h('div', { class: 'raid-word', lang: 'ja' }, h('span', {}, a.word.text), h('small', {}, a.word.en)) : null, speak(a, send, 'Hold and say the word', true), pass('Skip: next yōkai'));
      else
        parts.push(
          h('div', { class: 'raid-draw-cue' }, h('span', { class: 'raid-mask', lang: 'ja' }, a.write?.blanked ?? '□'), h('span', { class: 'raid-draw-what' }, `“${a.write?.en ?? ''}”`, h('small', {}, ` (${a.write?.meaning ?? ''})`)), a.hear ? hearButton(a.hear, '🔊') : null),
          inkPad({ key: a.id, limits: KANJI_LIMITS, label: 'Drawing pad: write the kanji here', onSend: (ink) => send({ kind: 'attack', attackId: a.id, ink }) }),
        );
      break;
    case 'blow':
      parts.push(
        h('div', { class: 'ky-chunk boss' }, h('p', { class: 'ky-gist' }, `“${a.gist ?? ''}”`), sash(a.badge), a.verb ? h('p', { class: 'hint small', lang: 'ja' }, `use: ${a.verb.kana}`) : null),
        h('p', { class: 'hint' }, 'From memory, in your own words if you like: the badge’s form has to be in it.'),
        speak(a, send, 'Hold and say the whole line'),
        pass('Let the others say it'),
      );
      break;
  }
  return h('div', { class: `screen raid raid-${a.kind} ky-${a.kind}` }, parts);
}

function recap(game: KatsuyoRaidView): HTMLElement {
  const r = game.me?.recap;
  if (!r) return waiting('Raid over!', 'Look at the stage.');
  return h(
    'div',
    { class: 'screen raid' },
    h('p', { class: 'big' }, 'Your forms tonight'),
    h('div', { class: 'raid-chips', lang: 'ja' }, r.forms.slice(0, 40).map((f) => h('span', { class: `raid-chip ${f.ok ? 'ok' : 'miss'}` }, f.label, f.counted ? h('small', {}, ' ✦') : null))),
    h('p', { class: 'raid-subhead' }, 'Counted toward the path'),
    r.counted.length
      ? h('div', { class: 'ky-counted' }, r.counted.map((c) => h('p', {}, sash(c.badge), ` ×${c.n}`)))
      : h('p', { class: 'hint small' }, 'Nothing yet: bare forms are practice. Chunks with your own words, and the boss line from memory, count.'),
    r.bossLine ? h('div', { class: 'ky-chunk boss' }, h('p', { class: 'hint small' }, 'Tonight’s boss line:'), h('p', { class: 'ky-gist', lang: 'ja' }, r.bossLine.kana), h('small', {}, r.bossLine.en)) : null,
    r.haunted.length
      ? h(
          'div',
          { class: 'raid-haunted' },
          h('p', { class: 'raid-subhead' }, `Haunted list (${r.haunted.length})`),
          r.haunted.map((x) => h('div', { class: 'raid-haunt' }, h('span', { class: 'raid-chip miss', lang: 'ja' }, x.label), h('span', { class: 'raid-haunt-tip' }, x.tip ?? ''), hearButton(x.hear, '🔊'))),
        )
      : h('p', { class: 'hint' }, 'Nothing haunting you tonight!'),
  );
}
