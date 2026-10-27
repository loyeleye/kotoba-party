// Karaoke Duel on the TV: the song card, then each sing turn as a karaoke screen (count-in,
// a ball bouncing over the lyrics mora by mora, the next line underneath), the duel board of
// takes, the crowd vote and the result. The backing comes from karaokeAudio.ts: a continuous
// song's instrumental plays straight through, from the song's first turn to its end.
//
// The stage redraws on every update, so the count-in, ball and fill are CSS animations with
// delays computed from the server's clock: a redraw picks them up where they were.

import { h, ruby } from '../../../shared/src/dom.js';
import { icon } from '../../../shared/src/art.js';
import { duelStats, scoreComment, type DuelStats, type KaraokeDuelView, type LineView, type TakeView } from '../../../shared/src/modes/karaokeDuel/karaokeDuel.js';
import { hasKanji } from '../../../shared/src/japanese/kana.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { audioReady, audioSupported, fanfare, isMuted, playSong, playTurn, setMuted, songPlaying, stopAll, unlockAudio } from './karaokeAudio.js';
import type { StageMode } from './types.js';

// ---------- server clock ----------
// `at` is the server time of the view's last change; a state arrives after it was made, so
// `at - Date.now()` never overshoots the true offset and the largest sample is the best.
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
const seatOf = (view: RoomView, id: string | null | undefined): number => view.players.find((p) => p.id === id)?.seat ?? 0;
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}`);

// ---------- lyrics ----------

/** One line as karaoke: morae with a ball and fill timed from `elapsed` ms after the first beat. */
function lyricLine(line: LineView, elapsed: number | null, romaji: boolean, cls = ''): HTMLElement {
  let i = 0;
  const words = line.words.map((word) =>
    h(
      'span',
      { class: 'kd-word' },
      word.map((mora) => {
        const k = i++;
        const note = line.notes[k];
        const style = elapsed !== null && note ? `--d:${Math.round(note.startMs - elapsed)}ms;--len:${note.ms}ms` : null;
        return h(
          'span',
          { class: `kd-mora${elapsed !== null ? ' timed' : ''}`, style },
          h('span', { class: 'kd-kana', lang: 'ja' }, mora),
          romaji ? h('span', { class: 'kd-ro' }, line.romajiMorae[k] ?? '') : null,
        );
      }),
    ),
  );
  return h(
    'div',
    { class: `kd-line ${cls}` },
    hasKanji(line.text) ? h('p', { class: 'kd-text' }, ruby(line)) : null,
    h('p', { class: 'kd-morae' }, words),
    h('p', { class: 'kd-en' }, line.en),
  );
}

function countIn(beatMs: number, beats: number, elapsed: number): HTMLElement {
  return h(
    'div',
    { class: 'kd-count' },
    Array.from({ length: beats }, (_, k) => {
      const start = -(beats - k) * beatMs;
      return h('span', { class: 'kd-count-n', style: `--d:${Math.round(start - elapsed)}ms;--len:${Math.round(beatMs)}ms` }, String(beats - k));
    }),
  );
}

// ---------- pieces ----------

function chip(t: TakeView | undefined): HTMLElement {
  if (!t) return h('span', { class: 'kd-chip empty' }, '·');
  if (t.missed) return h('span', { class: 'kd-chip missed' }, '—');
  const tier = t.quality >= 85 ? 'great' : t.quality >= 60 ? 'good' : 'ok';
  return h('span', { class: `kd-chip ${tier}`, title: `words ${pct(t.pron)} · pitch ${pct(t.pitch)} · timing ${pct(t.timing)}` }, String(t.quality), t.via === 'typed' ? ' ⌨' : '');
}

function duelBoard(view: RoomView, game: KaraokeDuelView): HTMLElement | null {
  const duel = game.duel;
  const song = game.song;
  if (!duel || !song) return null;
  const ids = [duel.a, duel.b];
  const current = game.turn;
  const total = (id: string) => game.takes.filter((t) => t.playerId === id).reduce((n, t) => n + t.points, 0);
  return h(
    'div',
    { class: `kd-board${song.lines.length > 6 ? ' long' : ''}` },
    h('div', { class: 'kd-board-row head' }, h('span', {}, ''), ids.map((id) => h('span', { class: `kd-who seat-${seatOf(view, id)}` }, nameOf(view, id)))),
    song.lines.map((line, i) =>
      h(
        'div',
        { class: `kd-board-row${current?.line === i ? ' now' : ''}` },
        h('span', { class: 'kd-board-line', lang: 'ja' }, `${i + 1}. ${line.kana}`),
        ids.map((id) => {
          const now = current?.line === i && current.singerId === id;
          if (now) return h('span', { class: 'kd-chip live' }, '🎤');
          // A continuous song's verse lines are sung by one duelist only.
          if (!game.order.some((t) => t.line === i && t.singerId === id)) return h('span', { class: 'kd-chip none' }, '');
          return chip(game.takes.find((t) => t.line === i && t.playerId === id));
        }),
      ),
    ),
    h('div', { class: 'kd-board-row total' }, h('span', {}, game.doubled ? 'Total (×2 round)' : 'Total'), ids.map((id) => h('span', { class: 'kd-total' }, String(total(id))))),
  );
}

function lastTakeToast(view: RoomView, game: KaraokeDuelView, local: number): HTMLElement | null {
  const t = game.takes.filter((x) => !x.missed).at(-1);
  if (!t || !game.turn) return null;
  // A continuous song's takes land while the next line is sung: show the latest for that turn.
  if (game.song?.continuous) {
    if (t.turnNo < game.turn.no - 1) return null;
    return h(
      'div',
      { class: 'kd-toast', 'data-key': `take-${t.turnNo}` },
      h('strong', {}, `${nameOf(view, t.playerId)} ${t.quality}`),
      h('span', {}, t.via === 'typed' ? ' typed (quiet mode)' : ` words ${pct(t.pron)} · ${t.pitchUsed ? `pitch ${pct(t.pitch)}` : 'pitch not measured'} · timing ${pct(t.timing)}`),
    );
  }
  if (t.turnNo !== game.turn.no - 1) return null;
  // Shown for the first few seconds of the next turn (the count-in).
  const since = local - (game.turn.lineAt - game.turn.countInBeats * (game.song?.beatMs ?? 600));
  if (since > 3_500) return null;
  const pitch = t.pitchUsed ? `pitch ${pct(t.pitch)}` : 'pitch not measured';
  return h(
    'div',
    { class: 'kd-toast', style: `animation-delay:-${Math.max(0, Math.round(since))}ms`, 'data-key': `take-${t.turnNo}` },
    h('strong', {}, `${nameOf(view, t.playerId)} ${t.quality}`),
    h('span', {}, t.via === 'typed' ? ' typed (quiet mode)' : ` words ${pct(t.pron)} · ${pitch} · timing ${pct(t.timing)}`),
  );
}

function soundButton(): HTMLElement | null {
  if (!audioSupported()) return null;
  if (!audioReady())
    return h(
      'button',
      {
        type: 'button',
        class: 'kd-sound',
        onclick: (e: Event) => {
          unlockAudio();
          const el = e.currentTarget as HTMLElement;
          el.textContent = '🔊 Music on';
          el.classList.add('quiet');
        },
      },
      '🔊 Click for music',
    );
  return h(
    'button',
    {
      type: 'button',
      class: 'kd-sound quiet',
      onclick: (e: Event) => {
        setMuted(!isMuted());
        (e.currentTarget as HTMLElement).textContent = isMuted() ? '🔇 Music off' : '🔊 Music on';
      },
    },
    isMuted() ? '🔇 Music off' : '🔊 Music on',
  );
}

function header(view: RoomView, game: KaraokeDuelView): HTMLElement | null {
  const song = game.song;
  const duel = game.duel;
  if (!song || !duel) return null;
  return h(
    'div',
    { class: 'kd-head' },
    h('p', { class: 'kd-song', lang: 'ja' }, `♪ ${song.title.text}`, h('span', { class: 'kd-song-en' }, ` ${song.title.en}`)),
    h(
      'p',
      { class: 'kd-vs' },
      h('span', { class: `kd-name seat-${seatOf(view, duel.a)}` }, nameOf(view, duel.a)),
      h('span', { class: 'kd-vs-x' }, 'VS'),
      h('span', { class: `kd-name seat-${seatOf(view, duel.b)}` }, nameOf(view, duel.b)),
    ),
    game.doubled ? h('span', { class: 'kd-double' }, 'Final song: points ×2') : null,
    song.audience === 'kids' ? h('span', { class: 'kd-aud' }, '🧒 Kids’ lyrics') : song.audience === 'cheeky' ? h('span', { class: 'kd-aud cheeky' }, '🌶️ Cheeky lyrics') : null,
    soundButton(),
  );
}

// ---------- phases ----------

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'kd-card' },
    h('p', { class: 'kd-title', lang: 'ja' }, '🎤 カラオケ対決'),
    h('p', { class: 'kd-say' }, 'Two singers duel through a short Japanese song, line by line.'),
    h('p', { class: 'kd-say' }, 'Your phone’s mic turns on for your line: sing when the ball starts bouncing.'),
    h('p', { class: 'kd-say muted' }, 'Scored on words 60% · pitch 25% · timing 15%. Everyone else: sing along for chorus points, then vote for the crowd favourite!'),
    soundButton(),
  );
}

function songCard(view: RoomView, game: KaraokeDuelView): HTMLElement {
  const song = game.song!;
  if (song.continuous) {
    // A whole song is too much to read in a few seconds: everyone learns the chorus, which comes twice.
    return h(
      'div',
      { class: 'kd-stage' },
      header(view, game),
      h('p', { class: 'kd-title' }, 'Learn the chorus! 🎶'),
      h(
        'div',
        { class: 'kd-sheet' },
        song.chorus.map((i) => {
          const line = song.lines[i]!;
          return h(
            'div',
            { class: 'kd-sheet-line' },
            h('span', { class: 'kd-sheet-jp', lang: 'ja' }, line.kana),
            hasKanji(line.text) ? ruby(line, { class: 'kd-sheet-text' }) : null,
            game.romaji ? h('span', { class: 'kd-sheet-ro' }, line.romaji) : null,
            h('span', { class: 'kd-sheet-en' }, line.en),
          );
        }),
      ),
      h('p', { class: 'kd-say muted' }, 'The singers trade lines through the verses and the chorus. Everyone: sing the chorus with them!'),
    );
  }
  return h(
    'div',
    { class: 'kd-stage' },
    header(view, game),
    h(
      'div',
      { class: 'kd-sheet' },
      song.lines.map((line) =>
        h(
          'div',
          { class: 'kd-sheet-line' },
          h('span', { class: 'kd-sheet-jp', lang: 'ja' }, line.kana),
          hasKanji(line.text) ? ruby(line, { class: 'kd-sheet-text' }) : null,
          game.romaji ? h('span', { class: 'kd-sheet-ro' }, line.romaji) : null,
          h('span', { class: 'kd-sheet-en' }, line.en),
        ),
      ),
    ),
    h('p', { class: 'kd-say muted' }, song.continuous ? 'One song, start to finish: the singers trade lines, and each sings the chorus once. Read along now!' : 'Both singers sing every line, taking turns to go first. Read along now!'),
  );
}

function singTurn(view: RoomView, game: KaraokeDuelView): HTMLElement {
  const song = game.song!;
  const turn = game.turn!;
  const line = song.lines[turn.line]!;
  const off = offset(game);
  const serverNow = Date.now() + off;
  // The backing track is scheduled early by the speakers' delay (karaokeAudio.ts), so it is heard on
  // server time and the ball follows server time too.
  const elapsed = serverNow - turn.lineAt;
  const localLineAt = turn.lineAt - off;
  const songKey = `${game.round}:${game.songAt}`;
  if (song.continuous && song.track && game.songAt) playSong({ key: songKey, trackId: song.track.id, start: song.track.start, segments: song.track.segments, barS: (4 * song.beatMs) / 1000, songAt: game.songAt - off });
  playTurn(
    {
      key: `${view.phaseSeq}:${turn.no}`,
      lineAt: localLineAt,
      beatMs: song.beatMs,
      countInBeats: turn.countInBeats,
      notes: line.notes,
      rests: line.words.flat().map((m) => m === 'っ' || m === 'ッ'),
      style: song.style,
      chords: line.chords,
      continuous: song.continuous,
    },
    song.continuous && songPlaying(songKey),
  );
  const nextTurn = song.continuous ? game.order[turn.index + 1] : undefined;
  const next = song.continuous ? (nextTurn ? song.lines[nextTurn.line] : undefined) : song.lines[turn.line + 1];
  const singer = turn.singerId;
  const took = game.takes.some((t) => t.turnNo === turn.no);
  const chorus = game.chorus.filter((c) => c.turnNo === turn.no && c.ok).length;
  return h(
    'div',
    { class: 'kd-stage' },
    header(view, game),
    h(
      'div',
      { class: 'kd-layout' },
      h(
        'div',
        // One element per turn: a new line starts its count-in and lyric timing afresh.
        { class: 'kd-screen', 'data-key': `turn-${turn.no}` },
        h(
          'p',
          { class: `kd-singer seat-${seatOf(view, singer)}` },
          `🎤 ${nameOf(view, singer)}`,
          h('span', { class: 'kd-line-no' }, song.continuous ? ` · line ${turn.index + 1} of ${game.order.length}${song.chorus.includes(turn.line) ? ' · chorus: everyone sing!' : ''}` : ` · line ${turn.line + 1} of ${song.lines.length}`),
        ),
        countIn(song.beatMs, turn.countInBeats, elapsed),
        lyricLine(line, elapsed, game.romaji, 'now'),
        h('div', { class: 'kd-progress' }, h('span', { style: `--d:${Math.round(-elapsed)}ms;--len:${line.ms}ms` })),
        next ? h('div', { class: 'kd-next' }, h('span', { class: 'kd-next-label' }, nextTurn ? `next: ${nameOf(view, nextTurn.singerId)}` : 'next'), h('span', { lang: 'ja' }, next.kana)) : null,
        took ? h('p', { class: 'kd-in' }, '✓ Take in!') : null,
        chorus ? h('p', { class: 'kd-chorus' }, `🎶 Chorus: ${chorus} singing along`) : null,
        lastTakeToast(view, game, Date.now() + off),
      ),
      duelBoard(view, game),
    ),
  );
}

function crowdVote(view: RoomView, game: KaraokeDuelView): HTMLElement {
  stopAll();
  const duel = game.duel!;
  const audience = view.players.filter((p) => p.id !== duel.a && p.id !== duel.b);
  return h(
    'div',
    { class: 'kd-stage' },
    header(view, game),
    h('p', { class: 'kd-title' }, '👏 Who’s the crowd favourite?'),
    h(
      'div',
      { class: 'kd-pair' },
      [duel.a, duel.b].map((id) => h('div', { class: `kd-cand seat-${seatOf(view, id)}` }, h('span', { class: 'kd-cand-name' }, nameOf(view, id)))),
    ),
    h('p', { class: 'kd-say muted' }, `Vote on your phone · ${game.vote.voters.length} / ${audience.length} voted`),
    duelBoard(view, game),
  );
}

// ---------- the result ----------
// A head-to-head score report: the three parts of singing as mirrored LED meters, the lines each
// duelist won, the crowd vote, then the points and the winner. It is revealed beat by beat from
// the result's server time, so a redraw or a late joiner lands on the same frame; the rest
// state of every animation is the finished screen.

/** When each part of the result lands, ms after the result. */
const REVEAL = { words: 400, pitch: 1_100, timing: 1_800, lines: 2_600, crowd: 3_300, totals: 3_900, winner: 5_100, pick: 5_600 } as const;
let fanfareTimer: ReturnType<typeof setTimeout> | null = null;
let fanfareFor = '';

const at = (ms: number) => `--at:${ms}ms`;
/** A seat's colour as --seat, without the .seat-N class (which also paints a background). */
const seatVar = (seat: number) => `--seat:var(--seat-${seat})`;

/** A 20-cell LED meter for a 0–100 value, filling away from the centre line. */
function meter(value: number | null, side: 'l' | 'r', seat: number, best: boolean, ms: number): HTMLElement {
  if (value === null) return h('span', { class: `kd-led ${side} none`, style: at(ms) }, h('span', { class: 'kd-led-none' }, 'なし · not measured'));
  return h('span', { class: `kd-led ${side}${best ? ' best' : ''}`, style: `${at(ms)};${seatVar(seat)};--v:${Math.max(0, Math.min(100, value)) / 100}` }, h('span', { class: 'kd-led-fill' }));
}

/** One part of singing, head to head: the better number in gold with a ▲ (not colour alone). */
function statRow(seats: [number, number], label: HTMLElement, en: string, a: number | null, b: number | null, ms: number): HTMLElement {
  const both = a !== null && b !== null;
  const bestA = both && a > b;
  const bestB = both && b > a;
  const value = (v: number | null, best: boolean) => h('span', { class: `kd-stat-v${best ? ' best' : ''}${v === null ? ' none' : ''}`, style: at(ms + 600) }, v === null ? '–' : `${best ? '▲' : ''}${v}`);
  return h(
    'div',
    { class: 'kd-stat' },
    value(a, bestA),
    meter(a, 'l', seats[0], bestA, ms),
    h('span', { class: 'kd-stat-label' }, label, h('small', {}, en)),
    meter(b, 'r', seats[1], bestB, ms),
    value(b, bestB),
  );
}

/** One chip per line the duelist sang: the take's score, filled in their colour on lines they won. */
function lineStrip(game: KaraokeDuelView, id: string, other: string, side: 'l' | 'r', seat: number): HTMLElement {
  const takes = game.takes.filter((t) => t.playerId === id).sort((x, y) => x.turnNo - y.turnNo);
  return h(
    'span',
    { class: `kd-strip ${side}`, style: seatVar(seat) },
    takes.map((t, k) => {
      const rival = game.takes.find((x) => x.line === t.line && x.playerId === other);
      const won = rival !== undefined && t.quality > rival.quality;
      return h('span', { class: `kd-strip-chip${won ? ' won' : ''}${t.missed ? ' missed' : ''}`, style: at(REVEAL.lines + k * 50) }, t.missed ? '—' : String(t.quality));
    }),
  );
}

function result(view: RoomView, game: KaraokeDuelView): HTMLElement {
  const r = game.result;
  const duel = game.duel;
  if (!r || !duel) return h('div', { class: 'kd-card' }, h('p', { class: 'kd-title' }, 'No duel this round'));
  const since = Math.max(0, Date.now() + offset(game) - r.at);
  // The fanfare plays on the winner beat, once per result.
  const key = `${view.phaseSeq}:score`;
  if (fanfareFor !== key) {
    fanfareFor = key;
    if (fanfareTimer) clearTimeout(fanfareTimer);
    fanfareTimer = setTimeout(() => fanfare(key), Math.max(0, REVEAL.winner - since));
  }
  const ids = [duel.a, duel.b] as const;
  const [sa, sb] = ids.map((id) => duelStats(game.takes, id)) as [DuelStats, DuelStats];
  const won = (id: string) => r.winners.includes(id);
  const total = (id: string) => (r.sung[id] ?? 0) + (r.favourites.includes(id) ? r.crowdBonus : 0);
  const winnerText = r.winners.length === 1 ? `${nameOf(view, r.winners[0])} wins the duel!` : r.winners.length === 2 ? 'A tie!' : 'No winner this time';
  const contested = new Set(game.takes.filter((t) => t.playerId === duel.a && game.takes.some((x) => x.line === t.line && x.playerId === duel.b)).map((t) => t.line)).size;

  const seats: [number, number] = [seatOf(view, duel.a), seatOf(view, duel.b)];
  const audience = view.players.length > 2;
  const side = (id: string, s: 'l' | 'r') => {
    const crowd = r.favourites.includes(id);
    return h(
      'div',
      { class: `kd-res-side ${s}${won(id) ? ' won' : ''}`, style: `${at(REVEAL.winner)};${seatVar(seatOf(view, id))}` },
      h('span', { class: 'kd-res-name' }, nameOf(view, id), won(id) ? icon('trophy', '🏆', 'kd-res-crown') : null),
      h('span', { class: 'kd-res-pts', style: at(REVEAL.totals) }, String(total(id)), h('small', {}, ' pts')),
      h(
        'span',
        { class: 'kd-res-sum', style: at(REVEAL.crowd) },
        `sang ${r.sung[id] ?? 0}`,
        crowd ? h('span', { class: 'kd-res-fav' }, `👏 +${r.crowdBonus}`) : null,
        audience && r.votes[id] ? `· ${r.votes[id]} vote${r.votes[id] === 1 ? '' : 's'}` : null,
      ),
    );
  };
  const comment = (stats: DuelStats, s: 'l' | 'r') => {
    const c = scoreComment(stats.average, stats.takes);
    return h('span', { class: `kd-res-say ${s}`, style: at(REVEAL.winner) }, h('span', { class: 'kd-res-avg' }, `${stats.average}`, h('small', { lang: 'ja' }, '点')), h('span', {}, ruby(c, { class: 'kd-res-jp' }), h('span', { class: 'kd-res-en' }, c.en)));
  };

  return h(
    'div',
    { class: 'kd-stage kd-result', style: `--since:${Math.round(since)}ms` },
    h(
      'p',
      { class: 'kd-title kd-res-title' },
      h('span', { class: 'kd-res-wait', style: at(REVEAL.winner) }, h('ruby', { lang: 'ja' }, '採点中', h('rt', {}, 'さいてんちゅう')), ' Scoring…'),
      h('span', { class: 'kd-res-win', style: at(REVEAL.winner) }, r.winners.length === 1 ? icon('trophy', '🏆', 'kd-res-trophy') : r.winners.length === 2 ? '🤝 ' : null, winnerText),
    ),
    h(
      'div',
      { class: 'kd-res' },
      h('div', { class: 'kd-res-top' }, side(duel.a, 'l'), h('span', { class: 'kd-res-vs' }, 'VS', game.doubled ? h('small', {}, 'final song ×2') : null), side(duel.b, 'r')),
      h(
        'div',
        { class: 'kd-res-rows' },
        statRow(seats, h('ruby', { lang: 'ja' }, '発音', h('rt', {}, 'はつおん')), 'Pronunciation', sa.words, sb.words, REVEAL.words),
        statRow(seats, h('ruby', { lang: 'ja' }, '音程', h('rt', {}, 'おんてい')), 'Pitch', sa.pitch, sb.pitch, REVEAL.pitch),
        statRow(seats, h('span', { lang: 'ja' }, 'リズム'), 'Rhythm', sa.timing, sb.timing, REVEAL.timing),
        h(
          'div',
          { class: 'kd-stat kd-stat-lines' },
          h('span', { class: 'kd-stat-v', style: at(REVEAL.lines) }, String(r.linesWon[duel.a] ?? 0)),
          lineStrip(game, duel.a, duel.b, 'l', seats[0]),
          h('span', { class: 'kd-stat-label' }, 'Lines won', h('small', {}, contested ? `of ${contested} shared` : 'none shared')),
          lineStrip(game, duel.b, duel.a, 'r', seats[1]),
          h('span', { class: 'kd-stat-v', style: at(REVEAL.lines) }, String(r.linesWon[duel.b] ?? 0)),
        ),
      ),
      h('div', { class: 'kd-res-says' }, comment(sa, 'l'), comment(sb, 'r')),
    ),
    h('div', { class: 'kd-res-pick', style: at(REVEAL.pick) }, nextPick(view, game)),
  );
}

/** The loser choosing the next song on their phone: the three choices, then the one picked. */
function nextPick(view: RoomView, game: KaraokeDuelView): HTMLElement | null {
  const pick = game.pick;
  if (!pick) return null;
  const who = nameOf(view, pick.chooserId);
  const title = pick.decided ? (pick.options.find((x) => x.track === pick.chosen)?.title.en ?? null) : null;
  return h(
    'div',
    { class: 'kd-pick' },
    h('p', { class: 'kd-pick-head' }, pick.decided ? (title ? `${who} picked the next song` : `${who} says: surprise me! 🎲`) : `${who} is picking the next song…`),
    h(
      'div',
      { class: 'kd-pick-row' },
      pick.options.map((o) => h('span', { class: `kd-pick-song${pick.decided && pick.chosen === o.track ? ' chosen' : pick.decided ? ' out' : ''}`, lang: 'ja' }, o.title.text, h('span', { class: 'kd-song-en' }, ` ${o.title.en}`))),
    ),
  );
}

function finale(view: RoomView, game: KaraokeDuelView): HTMLElement {
  const ranked = [...game.tally].sort((a, b) => b.points - a.points);
  return h(
    'div',
    { class: 'kd-card' },
    h('p', { class: 'kd-title' }, '🎤 お疲れさま！ That’s the show'),
    h(
      'ol',
      { class: 'kd-final' },
      ranked.map((t) => h('li', {}, h('span', {}, nameOf(view, t.playerId)), h('span', { class: 'muted' }, `${t.wins} win${t.wins === 1 ? '' : 's'} · best take ${t.best}${t.chorus ? ` · chorus ${t.chorus}` : ''}`), h('strong', {}, String(t.points)))),
    ),
  );
}

export const karaokeDuelStage: StageMode<KaraokeDuelView> = {
  badge(game, playerId) {
    const t = game.tally.find((x) => x.playerId === playerId);
    const singing = game.turn?.singerId === playerId ? '🎤 ' : '';
    const duelling = game.duel && (game.duel.a === playerId || game.duel.b === playerId) && !singing ? '⚔️ ' : '';
    return `${singing}${duelling}${t?.wins ? `🏆${t.wins}` : ''}`;
  },

  // The host's reaction names the winner, so it waits for the result's winner beat.
  hostHoldMs(view, game) {
    if (view.phase !== 'score' || !game.result) return 0;
    return Math.max(0, game.result.at + REVEAL.winner - (Date.now() + offset(game)));
  },

  render(view, game) {
    if (view.phase !== 'answer') {
      // Leaving a sing turn cuts its track (a skip, or the take came in early).
      if (view.phase !== 'score') stopAll();
    }
    switch (view.phase) {
      case 'intro':
        return intro();
      case 'prompt':
        return game.song && game.duel ? songCard(view, game) : h('div', { class: 'kd-card' }, h('p', { class: 'kd-title' }, 'Waiting for singers…'));
      case 'answer':
        return game.turn && game.song ? singTurn(view, game) : h('div', { class: 'kd-card' });
      case 'reveal':
        return crowdVote(view, game);
      case 'score':
        return result(view, game);
      case 'finale':
        return finale(view, game);
      default:
        return h('div', { class: 'kd-card' });
    }
  },
};
