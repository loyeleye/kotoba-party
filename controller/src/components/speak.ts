// "Say it to send it": hold to talk, see what was heard, then send. Every spoken step has a quiet
// fallback (type, or tap kana on the built-in pad) per the design doc.
//
// Speech goes to our own server, which runs Whisper (components/mic.ts, server/src/stt.ts). There is
// no browser recogniser: Chrome's sends the audio to Google. Until a speech server is set up, phones
// show the typed box and kana pad only.

import { h } from '../../../shared/src/dom.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import type { Level } from '../../../shared/src/protocol.js';
import { kanaPad } from './kanaPad.js';
import { MicClip, hear, speechReady, type Heard } from './mic.js';
import { heardPrefix, levelText } from './speakLabels.js';

// The phone's player level, set by main.ts before each screen draws.
let level: Level = 'n5';
export const setSpeakLevel = (l: Level): void => {
  level = l;
};

/** Button content for a label, worded for the player's level (see speakLabels.ts). */
function labelled(text: string): (HTMLElement | string)[] {
  const t = levelText(text, level);
  const main = h('span', { class: 'say-main', lang: t.ja ? 'ja' : 'en' }, t.main);
  return t.sub ? [main, h('small', { class: 'say-sub', lang: t.ja ? 'en' : 'ja' }, t.sub)] : [main];
}

// Quiet mode is the player's lobby choice ("I can't talk right now"); main.ts passes it in. A mic the
// browser refused stays refused for the rest of the visit, so later screens lead with typing too.
let quiet = false;
let micBlocked = false;
export const setQuiet = (q: boolean): void => {
  quiet = q;
};
export const isQuiet = (): boolean => quiet;

export const canSpeak = (): boolean => speechReady() && !quiet && !micBlocked;

type MicState = 'ready' | 'quiet' | 'blocked' | 'no-service';
const micState = (): MicState => (quiet ? 'quiet' : micBlocked ? 'blocked' : speechReady() ? 'ready' : 'no-service');
const CHIP: Record<MicState, string> = {
  ready: '🎤 Mic ready',
  quiet: '⌨️ Quiet mode: type or tap',
  blocked: '🚫 Mic blocked: type or tap',
  'no-service': '⌨️ No speech check tonight: type or tap',
};

/** One line saying how this phone answers right now, so the copy below it never asks for the impossible. */
export function micChip(): HTMLElement {
  const st = micState();
  return h('p', { class: `mic-chip mic-${st}`, role: 'status' }, CHIP[st]);
}

/** What to tell the player when nothing usable came back. */
export function missed(why: Exclude<Heard, { ok: true }>['why'] | 'blocked'): string {
  if (why === 'blocked') return 'Microphone blocked: type your answer below instead.';
  if (why === 'busy') return 'Still working on the last one…';
  if (why === 'failed') return 'Couldn’t check that just now. Try again, or type it.';
  return 'Didn’t catch that. Hold the button while you speak.';
}

export interface SpeakOptions {
  /** Button label, e.g. "Hold and say your answer". */
  label?: string;
  /** Placeholder for the typed fallback. */
  placeholder?: string;
  /** Open the kana pad by default (Kana level players). */
  kanaPadOpen?: boolean;
  /** Hide the typed fallback (rare: e.g. a pure shout). */
  speechOnly?: boolean;
  maxLength?: number;
  onSend(u: Utterance): void;
}

const MAX_TALK_MS = 6_000;

export function speakBox(opts: SpeakOptions): HTMLElement {
  const box = h('div', { class: 'speak' }, micChip());
  const heard = h('p', { class: 'heard' });
  const actions = h('div', { class: 'speak-actions' });

  if (canSpeak()) {
    let clip: MicClip | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const talk = h('button', { type: 'button', class: 'talk' }, labelled(opts.label ?? 'Hold to talk')) as HTMLButtonElement;

    const stop = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      talk.classList.remove('live');
      const c = clip;
      clip = null;
      if (!c) return;
      const wav = c.stop();
      if (c.blocked) {
        micBlocked = true;
        return void (heard.textContent = missed('blocked'));
      }
      heard.textContent = '…';
      const r = await hear(wav);
      if (clip) return; // pressed again while this one was being checked
      if (!r.ok) return void (heard.textContent = missed(r.why));
      heard.textContent = `${heardPrefix(level)}: ${r.text}`;
      actions.replaceChildren(
        h('button', { type: 'button', class: 'primary', onclick: () => opts.onSend({ via: 'speech', text: r.text }) }, labelled('Send')),
        h('button', { type: 'button', class: 'secondary', onclick: () => ((heard.textContent = ''), actions.replaceChildren()) }, labelled('Say it again')),
      );
    };
    const start = (e: Event) => {
      e.preventDefault();
      if (clip) return;
      heard.textContent = '';
      actions.replaceChildren();
      const c = new MicClip();
      clip = c;
      talk.classList.add('live');
      void c.ready.then((ok) => {
        if (clip === c) heard.textContent = ok ? '🎤 …' : missed(c.blocked ? 'blocked' : 'failed');
      });
      timer = setTimeout(() => void stop(), MAX_TALK_MS);
    };
    talk.addEventListener('pointerdown', start);
    talk.addEventListener('pointerup', () => void stop());
    talk.addEventListener('pointercancel', () => void stop());
    talk.addEventListener('pointerleave', () => talk.classList.contains('live') && void stop());
    talk.addEventListener('contextmenu', (e) => e.preventDefault());
    box.append(talk, heard, actions);
  }

  if (!opts.speechOnly || !canSpeak()) box.append(typedFallback(opts, canSpeak()));
  return box;
}

function typedFallback(opts: SpeakOptions, collapsed: boolean): HTMLElement {
  const input = h('input', { maxlength: opts.maxLength ?? 80, placeholder: opts.placeholder ?? 'Type it', lang: 'ja', enterkeyhint: 'send', autocomplete: 'off' }) as HTMLInputElement;
  const padHolder = h('div', {});
  let padOpen = false;
  const togglePad = () => {
    padOpen = !padOpen;
    padHolder.replaceChildren(...(padOpen ? [kanaPad(input)] : []));
  };
  if (opts.kanaPadOpen) togglePad();
  const form = h(
    'form',
    {
      class: 'typed',
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (input.value.trim()) opts.onSend({ via: 'typed', text: input.value.trim() });
      },
    },
    h('div', { class: 'typed-row' }, input, h('button', { type: 'button', class: 'secondary pad-toggle', onclick: togglePad }, 'かな'), h('button', { type: 'submit', class: 'secondary' }, 'Send')),
    padHolder,
  );
  if (!collapsed) return form;
  const details = h('details', { class: 'quiet' }, h('summary', {}, 'Can’t talk right now? Type it instead'), form);
  return details;
}
