// "Say it to send it": hold to talk, see what the recogniser heard, then send. Every spoken
// step has a quiet fallback (type, or tap kana on the built-in pad) per the design doc.
//
// Speech uses the browser's recogniser where there is one (Chrome, Safari). The design doc
// plans server-side speech-to-text for Phase 3; this is the optional fast path until then.

import { h } from '../../../shared/src/dom.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { kanaPad } from './kanaPad.js';

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

const Recognition: RecognitionCtor | undefined =
  (globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (globalThis as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

export const canSpeak = (): boolean => !!Recognition && localStorage.getItem('kotoba:quiet') !== '1';

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
  const box = h('div', { class: 'speak' });
  const heard = h('p', { class: 'heard' });
  const actions = h('div', { class: 'speak-actions' });
  let transcript = '';

  if (canSpeak()) {
    let rec: RecognitionLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const talk = h('button', { type: 'button', class: 'talk' }, opts.label ?? 'Hold to talk') as HTMLButtonElement;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      talk.classList.remove('live');
      rec?.stop();
    };
    const start = (e: Event) => {
      e.preventDefault();
      if (rec) rec.abort();
      transcript = '';
      heard.textContent = '…';
      actions.replaceChildren();
      rec = new Recognition!();
      rec.lang = 'ja-JP';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (ev) => {
        transcript = Array.from(ev.results)
          .map((r) => r[0]?.transcript ?? '')
          .join('');
        heard.textContent = transcript ? `Heard: ${transcript}` : '…';
      };
      rec.onerror = (ev) => {
        heard.textContent = ev.error === 'not-allowed' ? 'Microphone blocked: type your answer below instead.' : 'Didn’t catch that. Try again, or type it.';
      };
      rec.onend = () => {
        rec = null;
        if (transcript) {
          actions.replaceChildren(
            h('button', { type: 'button', class: 'primary', onclick: () => opts.onSend({ via: 'speech', text: transcript }) }, 'Send'),
            h('button', { type: 'button', class: 'secondary', onclick: () => ((heard.textContent = ''), actions.replaceChildren()) }, 'Say it again'),
          );
        } else if (heard.textContent === '…') heard.textContent = 'Didn’t catch that. Hold the button while you speak.';
      };
      talk.classList.add('live');
      try {
        rec.start();
      } catch {
        heard.textContent = 'Speech is busy. Try again.';
      }
      timer = setTimeout(stop, MAX_TALK_MS);
    };
    talk.addEventListener('pointerdown', start);
    talk.addEventListener('pointerup', stop);
    talk.addEventListener('pointerleave', () => talk.classList.contains('live') && stop());
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
  const details = h('details', { class: 'quiet' }, h('summary', {}, 'Can’t talk right now? Type it'), form);
  return details;
}
