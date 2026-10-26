// Karaoke Duel on the phone: the lyric sheet, then on your turn the line with its bouncing
// ball and a hold-to-sing button. While the button is held the phone runs the browser's
// recogniser (for the words) and, where it can, a pitch tracker on the mic (for the tune and
// the timing). On release it sends the take straight away: the next singer is waiting.
//
// Some phones can't run the recogniser and a second mic reader at once. When that happens the
// phone turns pitch off for good on this device, says so, and scores on words and timing.
// Everyone not duelling can sing along (chorus, words only) and votes for the crowd favourite.

import { h } from '../../../shared/src/dom.js';
import type { KaraokeDuelView, LineView, TakeView } from '../../../shared/src/modes/karaokeDuel/karaokeDuel.js';
import { detectPitch, hzToMidi, rms, summarise, type PitchSample } from '../../../shared/src/modes/karaokeDuel/pitch.js';
import { hasKanji, type Utterance } from '../../../shared/src/japanese/kana.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { kanaPad } from '../components/kanaPad.js';
import { canSpeak } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<KaraokeDuelView>;

// ---------- server clock (see the stage: the largest `at - Date.now()` sample wins) ----------
let clockOffset = Number.NEGATIVE_INFINITY;
let lastAt = -1;
function offset(game: KaraokeDuelView): number {
  if (game.at !== lastAt) {
    lastAt = game.at;
    clockOffset = Math.max(clockOffset, game.at - Date.now());
  }
  return Number.isFinite(clockOffset) ? clockOffset : 0;
}

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}`);

// ---------- pitch setting (per device) ----------
const PITCH_KEY = 'kotoba:karaoke-pitch';
function pitchWanted(): boolean {
  try {
    return localStorage.getItem(PITCH_KEY) !== 'off';
  } catch {
    return true;
  }
}
function setPitchWanted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(PITCH_KEY);
    else localStorage.setItem(PITCH_KEY, 'off');
  } catch {
    // private mode: the choice lasts for this page only
  }
}
const canTrackPitch = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';

// ---------- the recogniser (same browser API as components/speak.ts) ----------
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
  (globalThis as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (globalThis as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

// ---------- the pitch tracker ----------
class PitchTracker {
  samples: PitchSample[] = [];
  private stream: MediaStream | null = null;
  private audio: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  stopped = false;

  constructor(private readonly lineAtLocal: number) {}

  async start(): Promise<void> {
    // Created inside the press, so the browser lets it run.
    this.audio = new AudioContext();
    void this.audio.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    if (this.stopped) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.stream = stream;
    const source = this.audio.createMediaStreamSource(stream);
    const analyser = this.audio.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const rate = this.audio.sampleRate;
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const level = rms(buf);
      const found = detectPitch(buf, rate);
      this.samples.push({ t: Date.now() - this.lineAtLocal, rms: level, midi: found ? hzToMidi(found.hz) : null });
      if (this.samples.length > 600) this.stop();
    }, 40);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    void this.audio?.close().catch(() => {});
    this.audio = null;
  }
}

// ---------- lyrics ----------

function lyricLine(line: LineView, elapsed: number | null, romaji: boolean): HTMLElement {
  let i = 0;
  return h(
    'div',
    { class: 'kdp-line' },
    hasKanji(line.text) ? h('p', { class: 'kdp-text', lang: 'ja' }, line.text) : null,
    h(
      'p',
      { class: 'kdp-morae' },
      line.words.map((word) =>
        h(
          'span',
          { class: 'kdp-word' },
          word.map((mora) => {
            const k = i++;
            const note = line.notes[k];
            const style = elapsed !== null && note ? `--d:${Math.round(note.startMs - elapsed)}ms;--len:${note.ms}ms` : null;
            return h('span', { class: `kdp-mora${elapsed !== null ? ' timed' : ''}`, style }, h('span', { class: 'kdp-kana', lang: 'ja' }, mora), romaji ? h('span', { class: 'kdp-ro' }, line.romajiMorae[k] ?? '') : null);
          }),
        ),
      ),
    ),
    h('p', { class: 'kdp-en' }, line.en),
  );
}

function countIn(beatMs: number, beats: number, elapsed: number): HTMLElement {
  return h(
    'div',
    { class: 'kdp-count' },
    Array.from({ length: beats }, (_, k) => h('span', { class: 'kdp-count-n', style: `--d:${Math.round(-(beats - k) * beatMs - elapsed)}ms;--len:${Math.round(beatMs)}ms` }, String(beats - k))),
  );
}

// ---------- hold to sing ----------

interface SingOptions {
  line: LineView;
  beatMs: number;
  countInBeats: number;
  /** Server time of the line's first beat. */
  lineAt: number;
  offset: number;
  romaji: boolean;
  /** Measure pitch (duelists); chorus only needs the words. */
  pitch: boolean;
  label: string;
  /** Show the typed quiet fallback. */
  typed: boolean;
  kanaPadOpen: boolean;
  onSend(take: { utterance: Utterance; pitch?: (number | null)[] | null; onsetMs?: number; durMs?: number; timing?: 'mic' | 'button' }): Promise<boolean>;
}

function singBox(opts: SingOptions): HTMLElement {
  const lineAtLocal = opts.lineAt - opts.offset;
  const elapsed = Date.now() - lineAtLocal;
  const status = h('p', { class: 'kdp-status' });
  const pitchNote = h('p', { class: 'hint kdp-pitch' });
  let sent = false;

  const box = h('div', { class: 'kdp-sing' }, countIn(opts.beatMs, opts.countInBeats, elapsed), lyricLine(opts.line, elapsed, opts.romaji), h('div', { class: 'kdp-progress' }, h('span', { style: `--d:${Math.round(-elapsed)}ms;--len:${opts.line.ms}ms` })));

  const finish = async (take: Parameters<SingOptions['onSend']>[0]) => {
    if (sent) return;
    sent = true;
    status.textContent = 'Sending…';
    const ok = await opts.onSend(take);
    if (!ok) {
      sent = false;
      status.textContent = 'That didn’t go through. Hold and sing again.';
    } else status.textContent = '✓ Sent!';
  };

  if (canSpeak() && Recognition) {
    const usePitch = opts.pitch && pitchWanted() && canTrackPitch();
    pitchNote.textContent = !opts.pitch ? '' : usePitch ? 'Listening for words, pitch and timing.' : canTrackPitch() ? 'Pitch is off on this phone: scored on words (80%) and timing (20%).' : 'This browser can’t measure pitch: scored on words (80%) and timing (20%).';
    const button = h('button', { type: 'button', class: 'talk kdp-talk' }, opts.label) as HTMLButtonElement;
    let rec: RecognitionLike | null = null;
    let tracker: PitchTracker | null = null;
    let transcript = '';
    let pressAt = 0;
    let releaseAt = 0;
    let holding = false;
    let delivered = true;
    let conflict = false;
    let autoStop: ReturnType<typeof setTimeout> | null = null;

    const release = () => {
      if (!holding) return;
      holding = false;
      releaseAt = Date.now();
      if (autoStop) clearTimeout(autoStop);
      button.classList.remove('live');
      tracker?.stop();
      // The recogniser hands back its last words in onend, which delivers; without one, deliver now.
      if (rec) rec.stop();
      else deliver();
    };

    const deliver = () => {
      if (delivered) return;
      delivered = true;
      if (conflict) {
        // The recogniser lost the mic to the pitch tracker: pitch off from now on, sing again.
        setPitchWanted(false);
        pitchNote.textContent = 'Your phone can’t listen for words and pitch at once, so pitch is now off: scored on words and timing. Hold and sing again!';
        status.textContent = '';
        return;
      }
      const lineStart = lineAtLocal;
      let timing: 'mic' | 'button' = 'button';
      let onsetMs = pressAt <= lineStart ? 0 : pressAt - lineStart;
      let durMs = Math.max(0, releaseAt - Math.max(pressAt, lineStart));
      let pitch: (number | null)[] | null = null;
      if (tracker && tracker.samples.length) {
        const sum = summarise(tracker.samples);
        pitch = sum.pitch;
        if (sum.onsetMs !== null && sum.durMs !== null) {
          onsetMs = sum.onsetMs;
          durMs = sum.durMs;
          timing = 'mic';
        }
      }
      onsetMs = Math.max(-5_000, Math.min(15_000, Math.round(onsetMs)));
      durMs = Math.max(0, Math.min(15_000, Math.round(durMs)));
      void finish({ utterance: { via: 'speech', text: transcript.slice(0, 120) }, pitch, onsetMs, durMs, timing });
    };

    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (sent || holding) return;
      holding = true;
      delivered = false;
      conflict = false;
      transcript = '';
      pressAt = Date.now();
      button.classList.add('live');
      status.textContent = '🎤 Singing…';
      const r = new Recognition();
      rec = r;
      r.lang = 'ja-JP';
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.continuous = true;
      r.onresult = (ev) => {
        transcript = Array.from(ev.results)
          .map((x) => x[0]?.transcript ?? '')
          .join('');
        status.textContent = transcript ? `🎤 ${transcript}` : '🎤 Singing…';
      };
      r.onerror = (ev) => {
        if (ev.error === 'not-allowed') status.textContent = 'Microphone blocked: type the line below instead.';
        else if (tracker && (ev.error === 'audio-capture' || ev.error === 'aborted')) conflict = true;
      };
      r.onend = () => {
        if (rec !== r) return;
        rec = null;
        if (holding) release();
        deliver();
      };
      try {
        r.start();
      } catch {
        rec = null;
        status.textContent = 'The mic is busy. Try again.';
      }
      if (usePitch && pitchWanted()) {
        tracker = new PitchTracker(lineAtLocal);
        tracker.start().catch(() => {
          tracker?.stop();
          tracker = null;
          pitchNote.textContent = 'Couldn’t open the mic for pitch: scored on words and timing this time.';
        });
      } else tracker = null;
      // Let go for them a beat after the line ends (or after 12 s at most).
      const lineEnd = lineAtLocal + opts.line.ms + opts.beatMs;
      autoStop = setTimeout(release, Math.min(12_000, Math.max(1_500, lineEnd - Date.now())));
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    box.append(button, status);
    if (opts.pitch && canTrackPitch()) {
      box.append(
        pitchNote,
        h(
          'button',
          {
            type: 'button',
            class: 'linkish',
            onclick: (e: Event) => {
              setPitchWanted(!pitchWanted());
              (e.currentTarget as HTMLElement).textContent = pitchWanted() ? 'Turn pitch off' : 'Turn pitch on (next time)';
              pitchNote.textContent = pitchWanted() ? 'Pitch will be measured from your next hold.' : 'Pitch is off: scored on words and timing.';
            },
          },
          pitchWanted() ? 'Turn pitch off' : 'Turn pitch on',
        ),
      );
    } else if (opts.pitch) box.append(pitchNote);
  } else {
    box.append(h('p', { class: 'hint' }, canSpeak() ? 'This browser has no speech recogniser.' : 'Quiet mode is on.'));
  }

  if (opts.typed) box.append(typedFallback(opts, !(canSpeak() && Recognition), (u) => void finish({ utterance: u })));
  return box;
}

function typedFallback(opts: SingOptions, open: boolean, onSend: (u: Utterance) => void): HTMLElement {
  const input = h('input', { maxlength: 60, placeholder: 'Type the line (kana)', lang: 'ja', enterkeyhint: 'send', autocomplete: 'off' }) as HTMLInputElement;
  const padHolder = h('div', {});
  let padOpen = false;
  const togglePad = () => {
    padOpen = !padOpen;
    padHolder.replaceChildren(...(padOpen ? [kanaPad(input)] : []));
  };
  if (opts.kanaPadOpen && open) togglePad();
  const form = h(
    'form',
    {
      class: 'typed',
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (input.value.trim()) onSend({ via: 'typed', text: input.value.trim() });
      },
    },
    h('div', { class: 'typed-row' }, input, h('button', { type: 'button', class: 'secondary pad-toggle', onclick: togglePad }, 'かな'), h('button', { type: 'submit', class: 'secondary' }, 'Send')),
    padHolder,
    h('p', { class: 'hint' }, 'Typing earns half the words score, and no pitch or timing.'),
  );
  if (open) return form;
  return h('details', { class: 'quiet' }, h('summary', {}, 'Can’t sing right now? Type it'), form);
}

// ---------- screens ----------

function takeLine(t: TakeView & { heard?: string }): HTMLElement {
  if (t.missed) return h('p', { class: 'kdp-take missed' }, `Line ${t.line + 1}: no take`);
  const parts = t.via === 'typed' ? 'typed' : `words ${pct(t.pron)} · ${t.pitchUsed ? `pitch ${pct(t.pitch)}` : 'pitch –'} · timing ${pct(t.timing)}`;
  return h(
    'div',
    { class: 'kdp-take' },
    h('p', { class: 'kdp-take-score' }, h('strong', {}, String(t.quality)), ` line ${t.line + 1} · +${t.points}`),
    h('p', { class: 'hint' }, parts),
    t.heard ? h('p', { class: 'hint', lang: 'ja' }, `Heard: ${t.heard}`) : null,
  );
}

function sheet(game: KaraokeDuelView, romaji: boolean): HTMLElement {
  return h(
    'div',
    { class: 'kdp-sheet' },
    (game.song?.lines ?? []).map((l, i) =>
      h(
        'div',
        { class: 'kdp-sheet-line' },
        h('p', { class: 'kdp-sheet-jp', lang: 'ja' }, `${i + 1}. ${l.kana}`),
        hasKanji(l.text) ? h('p', { class: 'hint', lang: 'ja' }, l.text) : null,
        romaji ? h('p', { class: 'kdp-sheet-ro' }, l.romaji) : null,
        h('p', { class: 'hint' }, l.en),
      ),
    ),
  );
}

function singScreen(ctx: Ctx): HTMLElement {
  const { game, view, me, send } = ctx;
  const turn = game.turn!;
  const song = game.song!;
  const mine = game.mine!;
  const line = song.lines[turn.line]!;
  const kana = mine.level === 'kana';
  const off = offset(game);
  if (mine.canSing) {
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, `Your turn! Line ${turn.line + 1}`),
      singBox({
        line,
        beatMs: song.beatMs,
        countInBeats: turn.countInBeats,
        lineAt: turn.lineAt,
        offset: off,
        romaji: kana,
        pitch: true,
        label: 'Hold and sing 🎤',
        typed: true,
        kanaPadOpen: kana,
        onSend: (take) => send({ kind: 'sing', turn: turn.no, ...take }),
      }),
      h('p', { class: 'hint' }, 'Press when the count-in ends and hold until the line is done.'),
    );
  }
  if (mine.isMyTurn) {
    const t = mine.takes.find((x) => x.turnNo === turn.no);
    return h('div', { class: 'screen' }, h('p', { class: 'big' }, 'Nice!'), t ? takeLine(t) : null);
  }
  if (mine.role === 'duelist') {
    const nextMine = game.order[turn.index + 1]?.singerId === me.id;
    const last = mine.takes.at(-1);
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, `${nameOf(view, turn.singerId)} is singing…`),
      lyricLine(line, null, kana),
      nextMine ? h('p', { class: 'kdp-ready' }, 'You’re next: get ready!') : null,
      last ? takeLine(last) : null,
    );
  }
  // Audience: sing along for the chorus.
  if (mine.canChorus && canSpeak() && Recognition) {
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, `Sing along with ${nameOf(view, turn.singerId)}!`),
      singBox({
        line,
        beatMs: song.beatMs,
        countInBeats: turn.countInBeats,
        lineAt: turn.lineAt,
        offset: off,
        romaji: kana,
        pitch: false,
        label: 'Hold and sing along 🎶',
        typed: false,
        kanaPadOpen: false,
        onSend: (take) => send({ kind: 'chorus', turn: turn.no, utterance: take.utterance }),
      }),
      h('p', { class: 'hint' }, `Chorus: +10 a line when the words are right (up to 40 a song). You have ${mine.chorusPoints} this song.`),
    );
  }
  const chorus = mine.chorus;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, `${nameOf(view, turn.singerId)} is singing…`),
    lyricLine(line, null, kana),
    chorus ? h('p', { class: `kdp-take${chorus.ok ? '' : ' missed'}` }, chorus.ok ? `🎶 Chorus +${chorus.points}` : '🎶 Chorus: not quite this time') : h('p', { class: 'hint' }, 'Listen, and get ready to vote for the crowd favourite.'),
  );
}

function voteScreen(ctx: Ctx): HTMLElement {
  const { game, view, send } = ctx;
  const mine = game.mine!;
  const duel = game.duel!;
  if (mine.role === 'duelist') return waiting('The crowd is voting…', 'Who was the crowd favourite?');
  if (!mine.canVote) return waiting(`You voted for ${nameOf(view, mine.voted)}`, 'Waiting for the others…');
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, 'Crowd favourite?'),
    h('p', { class: 'hint' }, 'Who put on the better show? (Not just the score!)'),
    [duel.a, duel.b].map((id) => h('button', { type: 'button', class: 'option kdp-vote', onclick: () => void send({ kind: 'vote', playerId: id }) }, `👏 ${nameOf(view, id)}`)),
  );
}

function resultScreen(ctx: Ctx): HTMLElement {
  const { game, view, me } = ctx;
  const r = game.result;
  const mine = game.mine!;
  if (!r || !game.duel) return waiting('Next song coming up…');
  const won = r.winners.includes(me.id);
  const headline =
    mine.role === 'duelist'
      ? won
        ? r.winners.length === 2
          ? 'A tie!'
          : '🏆 You won the duel!'
        : `${nameOf(view, r.winners[0])} won this one`
      : r.winners.length === 1
        ? `🏆 ${nameOf(view, r.winners[0])} won`
        : 'A tie!';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, headline),
    mine.role === 'duelist' ? h('div', { class: 'kdp-takes' }, mine.takes.map(takeLine)) : null,
    mine.role === 'duelist' && r.favourites.includes(me.id) ? h('p', { class: 'kdp-take' }, `👏 Crowd favourite +${r.crowdBonus}`) : null,
    mine.role === 'audience' && mine.chorusPoints ? h('p', { class: 'kdp-take' }, `🎶 Your chorus: +${mine.chorusPoints}`) : null,
  );
}

export const karaokeDuelPhone: PhoneMode<KaraokeDuelView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      game.turn?.no ?? '',
      game.mine?.role,
      game.mine?.canSing,
      game.mine?.canChorus,
      game.mine?.canVote,
      game.mine?.voted,
      game.mine?.takes.length,
      game.mine?.chorus?.points ?? '',
      game.result ? 'r' : '',
      game.mine?.isMyTurn ? '' : game.takes.length,
    ].join('|'),

  render(ctx) {
    const { view, game, me } = ctx;
    const mine = game.mine;
    const kana = mine?.level === 'kana';
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, '🎤 カラオケ対決'),
          h('p', {}, 'Two singers duel through a short song. Both sing every line, taking turns.'),
          h('p', {}, 'On your turn, watch the count-in, then hold the button and sing the line. Let go when it ends.'),
          h('p', { class: 'hint' }, 'Words 60% · pitch 25% · timing 15%. Not duelling? Sing along for chorus points and vote for the crowd favourite.'),
          canTrackPitch() ? null : h('p', { class: 'hint' }, 'This browser can’t measure pitch, so your takes count words and timing only.'),
        );
      case 'prompt': {
        const duel = game.duel;
        const vs = duel ? (duel.a === me.id ? duel.b : duel.b === me.id ? duel.a : null) : null;
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, `♪ ${game.song?.title.text ?? ''}`),
          h('p', { class: 'hint' }, game.song?.title.en ?? ''),
          vs ? h('p', { class: 'kdp-ready' }, `You vs ${nameOf(view, vs)}! Read the lyrics.`) : h('p', { class: 'hint' }, duel ? `${nameOf(view, duel.a)} vs ${nameOf(view, duel.b)}. Sing along for chorus points!` : ''),
          game.doubled ? h('p', { class: 'kdp-ready' }, 'Final song: points ×2') : null,
          sheet(game, kana),
        );
      }
      case 'answer':
        return game.turn && game.song && mine ? singScreen(ctx) : waiting('Look at the TV!');
      case 'reveal':
        return mine && game.duel ? voteScreen(ctx) : waiting('Look at the TV!');
      case 'score':
        return mine ? resultScreen(ctx) : waiting('Look at the TV!');
      case 'finale': {
        const t = game.tally.find((x) => x.playerId === me.id);
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, 'That’s the show!'),
          h('p', {}, `Duels won: ${t?.wins ?? 0} · best take: ${t?.best ?? 0}${t?.chorus ? ` · chorus: ${t.chorus}` : ''}`),
          h('p', { class: 'hint' }, 'The lines you sang are in your song sheet on the recap.'),
        );
      }
      default:
        return waiting('Look at the TV!');
    }
  },
};
