// Karaoke Duel on the TV: the song card, then each sing turn as a karaoke screen (count-in,
// a ball bouncing over the lyrics mora by mora, the next line underneath), the duel board of
// takes, the crowd vote and the result. The backing comes from karaokeAudio.ts: a continuous
// song's instrumental plays straight through, from the song's first turn to its end.
//
// The stage redraws on every update, so the count-in, ball and fill are CSS animations with
// delays computed from the server's clock: a redraw picks them up where they were.

import { h, ruby } from '../../../shared/src/dom.js';
import type { KaraokeDuelView, LineView, TakeView } from '../../../shared/src/modes/karaokeDuel/karaokeDuel.js';
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
    h('p', { class: 'kd-say' }, 'Hold the button on your phone and sing when the ball starts bouncing.'),
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
    h('p', { class: 'kd-say muted' }, 'Both singers sing every line, taking turns to go first. Read along now!'),
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

function result(view: RoomView, game: KaraokeDuelView): HTMLElement {
  const r = game.result;
  const duel = game.duel;
  if (!r || !duel) return h('div', { class: 'kd-card' }, h('p', { class: 'kd-title' }, 'No duel this round'));
  fanfare(`${view.phaseSeq}:score`);
  const winnerText = r.winners.length === 1 ? `🏆 ${nameOf(view, r.winners[0])} wins the duel!` : r.winners.length === 2 ? '🤝 A tie!' : 'No winner this time';
  return h(
    'div',
    { class: 'kd-stage' },
    header(view, game),
    h('p', { class: 'kd-title' }, winnerText),
    h(
      'div',
      { class: 'kd-pair' },
      [duel.a, duel.b].map((id) =>
        h(
          'div',
          { class: `kd-cand result${r.winners.includes(id) ? ' won' : ''} seat-${seatOf(view, id)}` },
          h('span', { class: 'kd-cand-name' }, nameOf(view, id)),
          h('span', { class: 'kd-cand-pts' }, `${(r.sung[id] ?? 0) + (r.favourites.includes(id) ? r.crowdBonus : 0)}`),
          h('span', { class: 'kd-cand-sub' }, `sang ${r.sung[id] ?? 0} · ${r.linesWon[id] ?? 0} lines won`),
          r.favourites.includes(id) ? h('span', { class: 'kd-cand-sub good' }, `👏 crowd favourite +${r.crowdBonus} (${r.votes[id]} vote${r.votes[id] === 1 ? '' : 's'})`) : r.votes[id] ? h('span', { class: 'kd-cand-sub' }, `${r.votes[id]} vote${r.votes[id] === 1 ? '' : 's'}`) : null,
        ),
      ),
    ),
    duelBoard(view, game),
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
