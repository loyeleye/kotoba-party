// Solo missions on the phone (shared/src/missions.ts): a bottom sheet over whatever is showing (the lobby or My
// progress), so a room's redraw never drops it. Sign Walk shows one sign at a time, without its reading; the
// player says it (or types it in kana or romaji) and the server checks it. A right reading before the reading
// shows counts toward 3.12; after "Show me the reading" it's practice only. Nothing shows on the TV.

import { h, mount } from '../../shared/src/dom.js';
import { GOAL_BY_ID, goalLabel, type PathStatus } from '../../shared/src/path.js';
import { MISSION_BY_ID, MISSION_RETRIES, type Mission, type MissionWord } from '../../shared/src/missions.js';
import type { StationSign } from '../../content/src/types.js';
import { signBoard } from '../../shared/src/signBoard.js';
import { setSoloSpeech, speechReady } from './components/mic.js';
import { speakBox } from './components/speak.js';
import { hearButton } from './components/voice.js';
import { setPathView } from './path.js';
import type { Utterance } from '../../shared/src/japanese/kana.js';

interface Reveal {
  text: string;
  kana: string;
  romaji: string;
  en: string;
  kanji: MissionWord['kanji'];
}
type Answer = { right: true; counted: boolean; reveal: Reveal } | { right: false; why?: 'wrong' | 'kanji-typed' | 'empty'; heard?: string; reveal?: Reveal; counted?: false };

import type { AccountView } from '../../shared/src/progress.js';

/**
 * The sign-in, lent by account.ts when it loads (imported here, it would pull the page's account code into the
 * path's tests).
 */
let signIn: { account: () => { token: string } | null; fetchMe: () => Promise<AccountView | null> } = { account: () => null, fetchMe: async () => null };
export function bindMissionAccount(a: typeof signIn): void {
  signIn = a;
}
const account = () => signIn.account();
const fetchMe = () => signIn.fetchMe();

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
  const a = account();
  try {
    const res = await fetch(`${location.origin}/api/account/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(a ? { authorization: `Bearer ${a.token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
  } catch {
    return { status: 0, data: null };
  }
}

let open: HTMLDialogElement | null = null;

/** Closes a mission that's showing (the game started in the lobby). */
export function closeMission(): void {
  open?.close();
}

/** The entry button: on a station's sheet and, while waiting, under the lobby strip. */
export function missionButton(m: Mission, onDone: () => void, cls = 'secondary acct-wide'): HTMLElement {
  return h(
    'button',
    { type: 'button', class: `mis-entry ${cls}`, onclick: () => openMission(m.id, onDone) },
    h('span', { class: 'mis-entry-main' }, h('span', { lang: 'ja' }, m.ja), ` · Solo mission: ${m.title}`),
    h('small', {}, m.blurb),
  );
}

/** Opens a mission in its own sheet. `onDone` runs once it closes after anything was saved. */
export function openMission(id: string, onDone: () => void): void {
  const m = MISSION_BY_ID[id];
  if (!m || open) return;
  const body = h('div', { class: 'mis-body' }, h('p', { class: 'mis-status', role: 'status' }, 'Getting tonight’s set…'));
  const sheet = h(
    'dialog',
    { class: 'gp-sheet mis-sheet', 'aria-labelledby': 'mis-title', 'data-line': GOAL_BY_ID[m.goal]?.line ?? '' },
    h('div', { class: 'gp-head' }, h('h2', { id: 'mis-title' }, h('span', { lang: 'ja' }, m.ja), ` ${m.title}`), h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: () => sheet.close() }, '✕')),
    body,
  ) as HTMLDialogElement;
  let saved = false;
  let soloSpeech = false;
  sheet.addEventListener('close', () => {
    if (soloSpeech) setSoloSpeech(null);
    sheet.remove();
    open = null;
    if (saved) onDone();
  });
  document.body.append(sheet);
  open = sheet;
  sheet.showModal();

  void (async () => {
    const res = await post<{ mission: { words: { itemId: string; sign: StationSign }[] }; speech: boolean }>('mission', { mission: m.id });
    if (res.status === 401) return mount(body, h('p', { class: 'acct-status bad' }, 'Sign in on this phone to save a mission.'));
    if (res.status !== 200 || !res.data?.mission.words.length) return mount(body, h('p', { class: 'acct-status bad' }, 'Could not reach the server. Try again in a moment.'));
    // Outside a room there is no seat to check speech by, so the sign-in's own check stands in.
    const a = account();
    if (res.data.speech && !speechReady() && a) {
      setSoloSpeech({ base: location.origin, token: a.token });
      soloSpeech = true;
    }
    run(m, res.data.mission.words, body, () => (saved = true), () => sheet.close());
  })();
}

function run(m: Mission, words: { itemId: string; sign: StationSign }[], body: HTMLElement, markSaved: () => void, close: () => void): void {
  let i = 0;
  let counted = 0;

  const revealBox = (r: Reveal, note: string, good: boolean) =>
    h(
      'div',
      { class: `mis-reveal${good ? ' good' : ''}`, role: 'status', 'aria-live': 'polite' },
      h('p', { class: 'mis-word' }, h('span', { lang: 'ja' }, h('ruby', {}, r.text, h('rt', {}, r.kana))), h('small', { class: 'frame-romaji' }, r.romaji)),
      h('p', { class: 'mis-en' }, r.en),
      r.kanji.length ? h('p', { class: 'mis-kanji' }, r.kanji.map((k) => h('span', { class: 'mis-kanji-chip' }, h('span', { lang: 'ja' }, k.char), ` ${k.meaning}`))) : null,
      hearButton(r.kana, 'Hear it', 'raid-hear acct-hear'),
      h('p', { class: 'path-note' }, note),
    );

  const ask = () => {
    const w = words[i]!;
    let tries = 0;
    let peeked = false;
    const status = h('p', { class: 'mis-status', role: 'status', 'aria-live': 'polite' });
    const after = h('div', { class: 'mis-after' });
    const next = () => (i === words.length - 1 ? finish() : (i++, ask()));
    const nextButton = () => h('button', { type: 'button', class: 'primary', onclick: next }, i === words.length - 1 ? 'Finish' : m.look === 'sign' ? 'Next sign' : 'Next word');
    const peekButton = h('button', { type: 'button', class: 'secondary acct-wide', onclick: () => void peek() }, 'Show me the reading') as HTMLButtonElement;
    let busy = false;

    const say = (practice: boolean) =>
      speakBox({
        label: practice ? 'Hold and say it once' : m.look === 'sign' ? 'Hold and read the sign' : 'Hold and read the word',
        placeholder: 'Kana or romaji',
        onSend: (u) => void send(u),
      });
    const speak = h('div', { class: 'mis-speak' }, say(false));

    const peek = async () => {
      if (busy) return;
      busy = true;
      peekButton.disabled = true;
      const res = await post<Answer>('mission/answer', { mission: m.id, itemId: w.itemId, giveUp: true });
      busy = false;
      if (res.status !== 200 || !res.data?.reveal) {
        peekButton.disabled = false;
        status.textContent = 'Could not reach the server. Try again.';
        return;
      }
      markSaved();
      peeked = true;
      peekButton.remove();
      mount(after, revealBox(res.data.reveal, 'It’ll come back in another mission. Say it once now, for practice.', false), nextButton());
      mount(speak, say(true));
    };

    const send = async (u: Utterance) => {
      if (busy) return;
      busy = true;
      status.textContent = 'Checking…';
      const res = await post<Answer>('mission/answer', { mission: m.id, itemId: w.itemId, answer: u, peeked });
      busy = false;
      if (res.status !== 200 || !res.data) {
        status.textContent = 'Could not reach the server. Try again.';
        return;
      }
      const d = res.data;
      if (d.right) {
        markSaved();
        if (d.counted) counted += 1;
        status.textContent = '';
        peekButton.remove();
        speak.replaceChildren();
        mount(after, revealBox(d.reveal, d.counted ? `✓ From memory: counts toward ${goalLabel(GOAL_BY_ID[m.goal]!)}.` : '✓ Said. Practice only, since the reading was showing.', d.counted), nextButton());
        after.querySelector<HTMLElement>('.primary')?.focus();
        return;
      }
      if (peeked) {
        status.textContent = d.heard ? `Heard “${d.heard}”. Listen once more and try again.` : 'Try once more.';
        return;
      }
      if (d.why === 'kanji-typed') {
        status.textContent = 'Type the reading, not the kanji: kana or romaji.';
        return;
      }
      tries += 1;
      if (tries > MISSION_RETRIES) {
        status.textContent = d.heard ? `Heard “${d.heard}”.` : '';
        void peek();
        return;
      }
      status.textContent = d.heard ? `Heard “${d.heard}”. Not quite: one more try.` : 'Not quite: one more try.';
    };

    mount(
      body,
      h('p', { class: 'mis-count' }, `${m.look === 'sign' ? 'Sign' : 'Word'} ${i + 1} of ${words.length}`),
      h('div', { class: 'mis-board' }, m.look === 'sign' ? signBoard([w.sign]) : h('div', { class: 'mis-card', role: 'img', 'aria-label': 'Word card' }, h('span', { lang: 'ja', 'aria-hidden': 'true' }, w.sign.text))),
      h('p', { class: 'mis-ask' }, m.ask),
      after,
      speak,
      status,
      peekButton,
    );
  };

  const finish = () => {
    mount(body, h('p', { class: 'mis-count' }, 'Mission done'), h('p', { class: 'big mis-score' }, `${counted} of ${words.length} read from memory`), h('p', { class: 'mis-progress', role: 'status' }, 'Checking your stamp…'));
    void fetchMe().then((view) => {
      if (view) setPathView(view);
      const line = body.querySelector('.mis-progress');
      if (line) line.textContent = view ? progressLine(view.pathStatus, m) : '';
    });
    body.append(
      h('p', { class: 'path-note' }, 'Each kanji counts once it’s read from memory on two different days, so come back tomorrow for the second.'),
      h('button', { type: 'button', class: 'primary', onclick: close }, 'Done'),
    );
  };

  ask();
}

/** "Sign kanji: 12 of 30" from the fresh save. */
function progressLine(st: PathStatus, m: Mission): string {
  const g = st.goals.find((x) => x.id === m.goal);
  if (!g) return '';
  if (g.met) return `${goalLabel(GOAL_BY_ID[m.goal]!)}: stamped!`;
  if (!g.count) return '';
  // Kanji read on one day so far: the share counts each of them as half (path.ts itemCount).
  const halfway = Math.max(0, Math.round((g.progress * g.count.need - g.count.have) * 2));
  return `${goalLabel(GOAL_BY_ID[m.goal]!)}: ${g.count.have} of ${g.count.need} kanji done${halfway ? `, ${halfway} halfway (one more day each)` : ''}`;
}
