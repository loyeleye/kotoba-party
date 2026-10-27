// Karaoke Duel on the phone: the lyric sheet, then on your turn the line with its bouncing
// ball and a sing button. On your own line the mic opens by itself on the last beat of the count-in
// (or on a tap) and records until the line has ended or the singer taps Done (the words are worked
// out by our own Whisper server, see components/mic.ts) while a pitch tracker listens to the same
// recording (for the tune and the timing). When it stops it sends the take
// straight away: the next singer is waiting. Without a speech server the line is typed.
// Everyone not duelling can sing along (chorus, words only) and votes for the crowd favourite.

import { h } from '../../../shared/src/dom.js';
import type { KaraokeDuelView, LineView, TakeView } from '../../../shared/src/modes/karaokeDuel/karaokeDuel.js';
import { detectPitch, hzToMidi, rms, summarise, type PitchSample } from '../../../shared/src/modes/karaokeDuel/pitch.js';
import { hasKanji, type Utterance } from '../../../shared/src/japanese/kana.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { kanaPad } from '../components/kanaPad.js';
import { MicClip, hear } from '../components/mic.js';
import { canSpeak, isQuiet, missed } from '../components/speak.js';
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

// ---------- a take in progress ----------
// While the mic is recording or its take is being sent, the screen must not be redrawn (in a
// continuous song the next turn starts while the last notes are still being sung). The phone key
// pins to this turn until the take is sent.
let busyTurn: number | null = null;

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

// ---------- auto mic setting (per device) ----------
const AUTO_MIC_KEY = 'kotoba:karaoke-automic';
function autoMicWanted(): boolean {
  try {
    return localStorage.getItem(AUTO_MIC_KEY) !== 'off';
  } catch {
    return true;
  }
}
function setAutoMicWanted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(AUTO_MIC_KEY);
    else localStorage.setItem(AUTO_MIC_KEY, 'off');
  } catch {
    // private mode: the choice lasts for this page only
  }
}

/** Under your own line: what the mic will do, and a switch for it. */
function autoMicHint(): HTMLElement {
  const text = () => (autoMicWanted() ? 'Your mic turns on by itself at the end of the count-in and stops when the line ends.' : 'Tap the button when the count-in ends; it stops when the line ends, or tap Done.');
  const hint = h('span', {}, text());
  const toggle = h('button', { type: 'button', class: 'linkish' }, autoMicWanted() ? 'Don’t turn my mic on' : 'Turn my mic on for me') as HTMLButtonElement;
  toggle.addEventListener('click', () => {
    setAutoMicWanted(!autoMicWanted());
    hint.textContent = `${text()} (From your next line.)`;
    toggle.textContent = autoMicWanted() ? 'Don’t turn my mic on' : 'Turn my mic on for me';
  });
  return h('p', { class: 'hint' }, hint, ' ', toggle);
}

// ---------- the pitch tracker (reads the same mic as the clip) ----------
class PitchTracker {
  samples: PitchSample[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private analyser: AnalyserNode | null = null;
  stopped = false;

  constructor(private readonly lineAtLocal: number) {}

  attach(clip: MicClip): void {
    if (this.stopped || !clip.source) return;
    const analyser = clip.audio.createAnalyser();
    analyser.fftSize = 2048;
    clip.source.connect(analyser);
    this.analyser = analyser;
    const buf = new Float32Array(analyser.fftSize);
    const rate = clip.audio.sampleRate;
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
    this.analyser?.disconnect();
    this.analyser = null;
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

// ---------- tap (or auto) to sing ----------

interface SingOptions {
  /** The turn this box sings (pins the screen while a take is in progress). */
  turnNo: number;
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
  /** Open the mic by itself when the line starts (the singer's own turn). */
  autoStart: boolean;
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
    busyTurn = null;
    if (!ok) {
      sent = false;
      status.textContent = 'That didn’t go through. Tap and sing again.';
    } else status.textContent = '✓ Sent!';
  };

  if (canSpeak()) {
    const usePitch = opts.pitch && pitchWanted();
    pitchNote.textContent = !opts.pitch ? '' : usePitch ? 'Listening for words, pitch and timing.' : 'Pitch is off on this phone: scored on words (80%) and timing (20%).';
    const button = h('button', { type: 'button', class: 'talk kdp-talk' }, opts.label) as HTMLButtonElement;
    let clip: MicClip | null = null;
    let tracker: PitchTracker | null = null;
    let pressAt = 0;
    let live = false;
    let autoStop: ReturnType<typeof setTimeout> | null = null;

    const stop = async () => {
      if (!live) return;
      live = false;
      const releaseAt = Date.now();
      if (autoStop) clearTimeout(autoStop);
      button.classList.remove('live');
      button.textContent = opts.label;
      tracker?.stop();
      const c = clip!;
      clip = null;
      const wav = c.stop();
      if (c.blocked) {
        busyTurn = null;
        return void (status.textContent = 'Microphone blocked: type the line below instead.');
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

      status.textContent = 'Listening back…';
      const heard = await hear(wav);
      // Nothing heard still counts (no words points); a server hiccup lets them sing it again.
      if (!heard.ok && heard.why !== 'quiet') {
        busyTurn = null;
        return void (status.textContent = `${missed(heard.why)} Tap and sing again.`);
      }
      void finish({ utterance: { via: 'speech', text: heard.ok ? heard.text.slice(0, 120) : '' }, pitch, onsetMs, durMs, timing });
    };

    /** Opens the mic until the line is over (or Stop). `auto`: the turn started it, not a tap. */
    const start = (auto: boolean) => {
      if (sent || live || clip || !box.isConnected) return;
      live = true;
      busyTurn = opts.turnNo;
      pressAt = Date.now();
      button.classList.add('live');
      button.textContent = '■ Done singing';
      status.textContent = auto ? '🎤 Mic on: sing when the ball bounces!' : '🎤 Singing…';
      const c = new MicClip();
      clip = c;
      const t = usePitch && pitchWanted() ? new PitchTracker(lineAtLocal) : null;
      tracker = t;
      void c.ready.then((ok) => {
        if (ok && c.audio.state !== 'running' && auto) {
          // The browser wants a tap before it lets audio run (iPhone): back to tap-to-sing.
          live = false;
          busyTurn = null;
          tracker = null;
          clip = null;
          c.stop();
          button.classList.remove('live');
          button.textContent = opts.label;
          status.textContent = 'Tap the button to turn your mic on.';
          return;
        }
        if (ok) t?.attach(c);
        else if (c.blocked) status.textContent = 'Microphone blocked: type the line below instead.';
      });
      // Stop for them when the line has had time to finish: two beats after it ends, at least 1.5 s
      // more, and inside the 15 s a clip can hold.
      const lineEnd = lineAtLocal + opts.line.ms + Math.max(1_500, 2 * opts.beatMs);
      autoStop = setTimeout(() => void stop(), Math.min(14_000, Math.max(2_000, lineEnd - Date.now())));
    };

    // Tap to start, tap again to stop (holding was easy to let slip and cut the line short).
    button.addEventListener('click', () => (live ? void stop() : start(false)));
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    // On your own turn the mic opens by itself on the last beat of the count-in.
    if (opts.autoStart && autoMicWanted()) {
      const at = lineAtLocal - opts.beatMs;
      if (Date.now() < lineAtLocal + opts.line.ms) setTimeout(() => start(true), Math.max(0, at - Date.now()));
    }
    box.append(button, status);
    if (opts.pitch) {
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
              pitchNote.textContent = pitchWanted() ? 'Pitch will be measured from your next line.' : 'Pitch is off: scored on words and timing.';
            },
          },
          pitchWanted() ? 'Turn pitch off' : 'Turn pitch on',
        ),
      );
    }
  } else {
    box.append(h('p', { class: 'hint' }, isQuiet() ? 'Quiet mode is on.' : 'Singing needs the game’s speech server, which isn’t set up: type the line instead.'));
  }

  if (opts.typed) box.append(typedFallback(opts, !canSpeak(), (u) => void finish({ utterance: u })));
  // No mic, and 8–10 s is too short to read and type: sing out loud and tap. Honour system, small score.
  if (opts.typed && !canSpeak())
    box.append(h('button', { type: 'button', class: 'secondary kdp-sang', onclick: () => void finish({ utterance: { via: 'tap', text: '' } }) }, 'I sang it! 🎶'));
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
  const parts = t.via === 'tap' ? 'sang it (no mic)' : t.via === 'typed' ? 'typed' : `words ${pct(t.pron)} · ${t.pitchUsed ? `pitch ${pct(t.pitch)}` : 'pitch –'} · timing ${pct(t.timing)}`;
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
  const st = mine.singTurn;
  if (st) {
    // In a continuous song this shows from the turn before, so the mic can open on the count-in.
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, song.continuous ? `🎤 Your line! (${st.index + 1} of ${game.order.length})` : `Your turn! Line ${st.line + 1}`),
      song.continuous && song.chorus.includes(st.line) ? h('p', { class: 'hint' }, 'Chorus: the room sings it with you.') : null,
      singBox({
        turnNo: st.no,
        line: song.lines[st.line]!,
        beatMs: song.beatMs,
        countInBeats: turn.countInBeats,
        lineAt: st.lineAt,
        offset: off,
        romaji: kana,
        pitch: true,
        label: 'Tap to sing 🎤',
        autoStart: true,
        typed: true,
        kanaPadOpen: kana,
        onSend: (take) => send({ kind: 'sing', turn: st.no, ...take }),
      }),
      autoMicHint(),
    );
  }
  if (mine.isMyTurn) {
    const t = mine.takes.find((x) => x.turnNo === turn.no);
    return h('div', { class: 'screen' }, h('p', { class: 'big' }, 'Nice!'), t ? takeLine(t) : null);
  }
  if (mine.role === 'duelist') {
    const nextMine = !song.continuous && game.order[turn.index + 1]?.singerId === me.id;
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
  if (mine.canChorus && canSpeak()) {
    return h(
      'div',
      { class: 'screen' },
      h('p', { class: 'big' }, `Sing along with ${nameOf(view, turn.singerId)}!`),
      singBox({
        turnNo: turn.no,
        line,
        beatMs: song.beatMs,
        countInBeats: turn.countInBeats,
        lineAt: turn.lineAt,
        offset: off,
        romaji: kana,
        pitch: false,
        label: 'Tap to sing along 🎶',
        autoStart: false,
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

/** The loser's choice of the next song: three titles and "Surprise me". Others see who is choosing. */
function pickSection(ctx: Ctx): HTMLElement | null {
  const { game, view, me, send } = ctx;
  const pick = game.pick;
  if (!pick) return null;
  const titleOf = (track: string | null) => pick.options.find((x) => x.track === track)?.title;
  if (pick.chooserId !== me.id) {
    const who = nameOf(view, pick.chooserId);
    const t = titleOf(pick.chosen);
    return h('p', { class: 'hint' }, pick.decided ? (t ? `${who} picked ${t.en}` : `${who} said “Surprise me!”`) : `${who} is picking the next song…`);
  }
  if (!game.mine?.canPick) {
    const t = titleOf(pick.chosen);
    return h('p', { class: 'kdp-ready' }, t ? `Next up: ${t.en}` : '🎲 Surprise!');
  }
  return h(
    'div',
    { class: 'kdp-pick' },
    h('p', { class: 'kdp-ready' }, 'You pick the next song!'),
    pick.options.map((o) =>
      h('button', { type: 'button', class: 'option kdp-pick-song', onclick: () => void send({ kind: 'pick', track: o.track }) }, h('span', { lang: 'ja' }, o.title.text), h('span', { class: 'hint' }, o.title.en)),
    ),
    h('button', { type: 'button', class: 'option kdp-pick-song', onclick: () => void send({ kind: 'pick', track: null }) }, '🎲 Surprise me'),
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
    // The pick comes first: on a phone the takes list would push it below the fold.
    pickSection(ctx),
    mine.role === 'duelist' ? h('div', { class: 'kdp-takes' }, mine.takes.map(takeLine)) : null,
    mine.role === 'duelist' && r.favourites.includes(me.id) ? h('p', { class: 'kdp-take' }, `👏 Crowd favourite +${r.crowdBonus}`) : null,
    mine.role === 'audience' && mine.chorusPoints ? h('p', { class: 'kdp-take' }, `🎶 Your chorus: +${mine.chorusPoints}`) : null,
  );
}

export const karaokeDuelPhone: PhoneMode<KaraokeDuelView> = {
  key: (view, game) => {
    // Never redraw under a take that is recording or sending.
    if (view.phase === 'answer' && busyTurn !== null) return `busy:${busyTurn}`;
    // A continuous song's singer keeps one screen from their count-in to the take being sent.
    const st = game.mine?.singTurn;
    if (view.phase === 'answer' && st && game.song?.continuous) return `sing:${st.no}`;
    return [
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
      game.pick ? `${game.pick.decided}:${game.pick.chosen ?? ''}:${game.mine?.canPick}` : '',
      game.mine?.isMyTurn ? '' : game.takes.length,
    ].join('|');
  },

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
          h('p', {}, 'Two singers duel through a song, trading lines over the music. Everyone learns the chorus!'),
          h('p', {}, 'On your turn your mic turns on at the end of the count-in: sing the line, and it stops when the line ends (or tap Done).'),
          h('p', { class: 'hint' }, 'Words 60% · pitch 25% · timing 15%. Not duelling? Sing along for chorus points and vote for the crowd favourite.'),
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
