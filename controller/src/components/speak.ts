// "Say it to send it": hold to talk (or tap, tap: the player's choice), see what was heard, then send. Every spoken step has a quiet
// fallback (type, or tap kana on the built-in pad) per the design doc.
//
// Speech goes to our own server, which passes it to Whisper (components/mic.ts, server/src/stt.ts). There is
// no browser recogniser: Chrome's sends the audio to Google. Until a speech server is set up, phones
// show the typed box and kana pad only.

import { h } from '../../../shared/src/dom.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import type { Level } from '../../../shared/src/protocol.js';
import { kanaPad } from './kanaPad.js';
import { MicClip, hear, speechReady, type Heard } from './mic.js';
import { heardPrefix, heardRomaji, levelText, tapWording } from './speakLabels.js';

// The phone's player level, set by main.ts before each screen draws.
let level: Level = 'n5';
export const setSpeakLevel = (l: Level): void => {
  level = l;
};

// How this phone's talk buttons work: hold while speaking (the default), or tap to start and tap again to
// stop. Each player picks it under the header's 🎤 (main.ts micSheet); it's kept on the phone, not the room.
export type TalkMode = 'hold' | 'tap';
const TALK_MODE_KEY = 'kotoba:talkMode';
let talkMode: TalkMode = (() => {
  try {
    return localStorage.getItem(TALK_MODE_KEY) === 'tap' ? 'tap' : 'hold';
  } catch {
    return 'hold';
  }
})();
export const getTalkMode = (): TalkMode => talkMode;
export function setTalkMode(m: TalkMode): void {
  talkMode = m;
  try {
    if (m === 'hold') localStorage.removeItem(TALK_MODE_KEY);
    else localStorage.setItem(TALK_MODE_KEY, m);
  } catch {
    /* private mode: it lasts for this visit */
  }
}

/** Button content for a label, worded for the player's level (see speakLabels.ts), and for tapping when `tap`. */
function labelled(text: string, tap = false): (HTMLElement | string)[] {
  const t0 = levelText(text, level);
  const t = tap ? tapWording(t0) : t0;
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

// While a talk button is held the phone must not redraw (a new button would drop the take), so
// main.ts holds redraws until the take ends.
let talking = 0;
const talkEnded: (() => void)[] = [];
export const isTalking = (): boolean => talking > 0;
export function onTalkEnd(fn: () => void): void {
  talkEnded.push(fn);
}
function setTalking(on: boolean): void {
  talking = Math.max(0, talking + (on ? 1 : -1));
  if (!on && talking === 0) for (const fn of talkEnded) fn();
}

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

/** What to tell the player when nothing usable came back. `tap`: their talk button is tap to start, tap to stop. */
export function missed(why: Exclude<Heard, { ok: true }>['why'] | 'blocked', tap = false): string {
  if (why === 'blocked') return 'Microphone blocked: type your answer below instead.';
  if (why === 'busy') return 'Still working on the last one…';
  if (why === 'failed') return 'Couldn’t check that just now. Try again, or type it.';
  return tap ? 'Didn’t catch that. Tap, speak, then tap again.' : 'Didn’t catch that. Hold the button while you speak.';
}

/** A hold this short was a tap: say how holding works, and where tapping lives. */
const TAP_LIKE_MS = 350;
const HOLD_NUDGE = 'Keep holding while you speak. Rather tap to start and stop? Switch to Tap to talk under 🎤.';

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
  /** Send what was heard straight away, without a Send step (fast calls, like a kitchen's). */
  autoSend?: boolean;
  /**
   * Called as soon as a take is recorded, before the (sometimes slow) speech check: a game can
   * move the player on and take the answer when `onSend` fires later (Kana Raid's say steps).
   */
  onRecorded?: () => void;
  /** Keep the half-typed text (and the keyboard) across redraws, for screens that redraw mid-typing. */
  draftKey?: string;
  /**
   * Tap to start, tap again to stop (up to TOGGLE_TALK_MS), instead of holding: for several sentences in a row,
   * where holding a button the whole time gets in the way (Happyōkai!'s talk). Every talk button works this
   * way when the player picked Tap to talk.
   */
  toggle?: boolean;
  /** A small talk button beside other controls, never docked under the thumb (the Gallery's "🎤 or say it"). */
  mini?: boolean;
  onSend(u: Utterance): void;
}

const MAX_TALK_MS = 6_000;
/** A toggled take: the mic's own limit (mic.ts MAX_SECONDS). */
const TOGGLE_TALK_MS = 15_000;

export function speakBox(opts: SpeakOptions): HTMLElement {
  const box = h('div', { class: 'speak' }, micChip());
  const heard = h('p', { class: 'heard' });
  const actions = h('div', { class: 'speak-actions' });

  if (canSpeak()) {
    let clip: MicClip | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pressAt = 0;
    const toggle = !!opts.toggle || talkMode === 'tap';
    const idle = labelled(opts.label ?? (toggle ? 'Tap to talk' : 'Hold to talk'), toggle);
    const talk = h('button', { type: 'button', class: `talk${toggle ? ' toggle' : ''}${opts.mini ? ' mini' : ''}` }, idle) as HTMLButtonElement;

    // While the button is held, a bar inside it follows the mic level, so the player sees it hears them.
    const meter = (c: MicClip) => {
      if (clip !== c) return void talk.style.setProperty('--level', '0');
      // Redrawn away while a tapped take was open: close the mic now, not at the time limit.
      if (!talk.isConnected) {
        clip = null;
        if (timer) clearTimeout(timer);
        return void c.stop();
      }
      talk.style.setProperty('--level', c.level.toFixed(2));
      requestAnimationFrame(() => meter(c));
    };
    const stop = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      const wasLive = talk.classList.contains('live');
      talk.classList.remove('live');
      talk.style.setProperty('--level', '0');
      if (toggle) talk.replaceChildren(...idle);
      const c = clip;
      clip = null;
      const wav = c?.stop();
      if (wasLive) setTalking(false);
      if (!c || wav === undefined) return;
      if (c.blocked) {
        micBlocked = true;
        return void (heard.textContent = missed('blocked'));
      }
      if (!toggle && Date.now() - pressAt < TAP_LIKE_MS) return void (heard.textContent = HOLD_NUDGE);
      opts.onRecorded?.();
      heard.textContent = '…';
      const r = await hear(wav, !!opts.onRecorded);
      // A game that moved on when the take was recorded still wants the answer, redrawn away or not.
      if (opts.onRecorded && !talk.isConnected) return void (r.ok && opts.onSend({ via: 'speech', text: r.text }));
      if (clip || !talk.isConnected) return; // pressed again while this one was being checked, or redrawn away
      if (!r.ok) return void (heard.textContent = missed(r.why, toggle));
      const romaji = level === 'kana' ? heardRomaji(r) : undefined;
      heard.textContent = `${heardPrefix(level)}: ${r.text}${romaji ? ` (${romaji})` : ''}`;
      // A tick pops in once: we heard you.
      heard.classList.remove('got');
      void heard.offsetWidth;
      heard.classList.add('got');
      if (opts.autoSend) return opts.onSend({ via: 'speech', text: r.text });
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
      pressAt = Date.now();
      talk.classList.add('live');
      setTalking(true);
      heard.classList.remove('got');
      void c.ready.then((ok) => {
        if (clip === c) heard.textContent = ok ? '🎤 …' : missed(c.blocked ? 'blocked' : 'failed');
        if (ok) meter(c);
      });
      timer = setTimeout(() => void stop(), toggle ? TOGGLE_TALK_MS : MAX_TALK_MS);
      if (toggle) talk.replaceChildren(...labelled('Tap to stop'));
    };
    if (toggle) {
      talk.addEventListener('pointerdown', (e) => (clip ? (e.preventDefault(), void stop()) : start(e)));
    } else {
      talk.addEventListener('pointerdown', start);
      talk.addEventListener('pointerup', () => void stop());
      talk.addEventListener('pointercancel', () => void stop());
      talk.addEventListener('pointerleave', () => talk.classList.contains('live') && void stop());
    }
    talk.addEventListener('contextmenu', (e) => e.preventDefault());
    box.append(talk, heard, actions);
  }

  if (!opts.speechOnly || !canSpeak()) box.append(typedFallback(opts, canSpeak()));
  return box;
}

// Half-typed text by draftKey, and which one had the keyboard, so a redraw doesn't lose either.
const drafts = new Map<string, string>();
let focusedDraft: string | null = null;

function typedFallback(opts: SpeakOptions, collapsed: boolean): HTMLElement {
  const input = h('input', { maxlength: opts.maxLength ?? 80, placeholder: opts.placeholder ?? 'Type it', lang: 'ja', enterkeyhint: 'send', autocomplete: 'off' }) as HTMLInputElement;
  const key = opts.draftKey;
  if (key) {
    input.value = drafts.get(key) ?? '';
    input.addEventListener('input', () => drafts.set(key, input.value));
    input.addEventListener('focus', () => (focusedDraft = key));
    // A blur from being redrawn away (no longer in the page) keeps the keyboard for the new box.
    input.addEventListener('blur', () => input.isConnected && focusedDraft === key && (focusedDraft = null));
    if (focusedDraft === key) requestAnimationFrame(() => input.isConnected && input.focus({ preventScroll: true }));
  }
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
        if (!input.value.trim()) return;
        if (key) drafts.delete(key);
        opts.onSend({ via: 'typed', text: input.value.trim() });
      },
    },
    h('div', { class: 'typed-row' }, input, h('button', { type: 'button', class: 'secondary pad-toggle', onclick: togglePad }, 'かな'), h('button', { type: 'submit', class: 'secondary' }, 'Send')),
    padHolder,
  );
  if (!collapsed) return form;
  if (key && drafts.get(key)) return h('details', { class: 'quiet', open: true }, h('summary', {}, 'Can’t talk right now? Type it instead'), form);
  const details = h('details', { class: 'quiet' }, h('summary', {}, 'Can’t talk right now? Type it instead'), form);
  return details;
}
