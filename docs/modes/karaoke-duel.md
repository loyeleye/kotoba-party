# Karaoke Duel (カラオケ対決), backlog

Design doc line: "Karaoke Duel: original beginner lyrics; pronunciation 60%, pitch 25%, timing 15%."

Two singers duel through a short, original beginner song, line by line. The TV plays a
count-in, a soft bass and a quiet guide melody (Web Audio, no audio files) and bounces a ball
over the lyrics mora by mora. The singer holds a button on their phone and sings; the phone
sends what the recogniser heard plus a compact pitch contour and timing, and the server scores
the take. Everyone else sings along for chorus points and votes for the crowd favourite.

Host: **Chōchin-san** (see decision 1). Players: 2–8. Rounds (songs): 4 by default, or 2 / 6.

Code: `shared/src/modes/karaokeDuel/` (`karaokeDuel.ts` rules, `scoring.ts`, `pitch.ts`,
`songs.ts`), `stage/src/modes/karaokeDuel.ts` + `karaokeAudio.ts` + `.css`,
`controller/src/modes/karaokeDuel.ts` + `.css`, `tools/bots/policies/karaokeDuel.ts`,
`tests/karaokeDuel.test.ts`.

## How a game goes

| Phase | Shared name | What happens | Length |
| --- | --- | --- | --- |
| Intro | `intro` | Rules on the TV and phones. | 12 s |
| Song card | `prompt` | Song title, every line (kana, kanji where used, romaji if anyone is at Kana level, English), who duels. Chōchin-san hands the first singer the mic. | 8 s (10 s if a duelist is Kana level) |
| Sing | `answer` ×8 or ×16 | **Grown-up songs are continuous** (`form` + `track`): one produced instrumental plays the whole song (intro, verse, chorus, verse 2, chorus, about 80–130 s) and the duelists trade lines on its clock, one line every two bars; each sings every chorus line once. One phase per line, ending one bar before the next line so the next singer's count-in overlaps; the next singer sees their line during it; a take counts until 10 s after its line ends (the recogniser is slow), and lines with no take are marked missed when the song ends. **Kids' songs** are four-line sing-alongs: a 0.7 s breath, a one-bar count-in, the line, then 3 s; both duelists sing every line, who goes first alternates, and a take ends the turn at once. | Continuous: the track's own timing. Sing-along: 0.7 s + 4 beats + line + 3 s |
| Crowd vote | `reveal` | Everyone not duelling votes for the crowd favourite. Skipped when nobody is watching (2 players). Ends when every connected voter is in. | 12 s |
| Duel result | `score` | Sung points, lines won, crowd votes, the winner. | 9 s |
| Finale | `finale` | Standings, then the shared recap (awards, the song sheet phrasebook). | 9 s |

A 4-song game of grown-up songs runs about 10 minutes.

### Who duels

Each song picks the two connected players who have duelled least (ties at random), never the
same pair twice in a row when anyone else is free. With 8 players and 4 songs everyone duels
once; with 5 players everyone duels before anyone duels twice. Seat order decides who opens
line 1.

### A take

The phone sends `{ kind: 'sing', turn, utterance, pitch, onsetMs, durMs, timing }`:

- `utterance`: the recogniser's transcript (`via: 'speech'`), or typed text (`via: 'typed'`,
  the quiet fallback). The server adds the kana `reading` (and tokens) as it does for every
  play move (`server/src/reading.ts` walks the move and finds it).
- `pitch`: one MIDI value (or `null` for unvoiced) per 100 ms frame from the line's first beat,
  at most 120 values (12 s), each in 24–108; or `null` when the phone can't measure pitch.
- `onsetMs` (−5 000…15 000) and `durMs` (0…15 000): when the singing started relative to the
  first beat and how long it lasted; `timing` says whether that came from the mic's loudness
  (`mic`) or the button hold (`button`).

`turn` is the game-wide sing-turn counter, so a take that arrives after its turn ended can't land
in the next one. Everything is checked hard (`parseTake`): wrong types, non-finite numbers,
out-of-range values or too-long arrays refuse the whole move (`bad-pitch`, `bad-timing`,
`bad-utterance`). A real phone never sends those.

### Scoring (`scoring.ts`, pure)

- **Pronunciation 60%.** The transcript's kana reading against the line's kana, mora by mora
  (edit distance over the line's mora count), after collapsing same-sounding spellings
  (`soundKey`: ー, えい/おう, づ/ず, を/お; katakana = hiragana). The similarity is stretched by
  level: full marks from 0.8 at Kana level, 0.9 at N5, 0.95 at N4.
- **Pitch 25%.** By shape only. The singer's voiced span is stretched over the line, each
  note takes the median of its frames, and each sung note minus its melody note is folded into
  ±6 semitones (octave slips don't matter). The singer's own key is the median offset; each note
  scores 1 within 1 semitone of that key, 0 at 4. Unsung notes count 0; a small っ is a rest.
  Fewer than 2 sung notes from a tracker that ran = 0.
- **Timing 15%.** 60% coming in on the beat (full within 250 ms, zero at 1.5 s early or late),
  40% singing for about the line's length (full at 70–135%).
- **No pitch measured** (phone can't, conflict, or turned off): the take is scored on
  pronunciation 80% and timing 20% (the same 60:15 ratio), and the phone and TV say "pitch not
  measured".
- **No words, no tune:** pitch and timing credit shrink in proportion when pronunciation is
  under 0.4. The phone's mic can hear the TV's guide melody, so humming (or letting the TV
  sing) never scores.
- **Typed** (quiet fallback): half the pronunciation score, nothing else (at most 50).

Take points = quality (0–100), doubled in the last song. A song's 8 takes give each duelist up
to 400 (800 in the final song).

**Crowd favourite:** +60 (doubled in the final song) to the duelist with most audience votes,
split on a tie. **Chorus:** an audience member who sings along with a line (speech only,
words only) and gets the words right (pronunciation ≥ 0.6) earns +10, at most +40 a song.
**Duel winner:** sung points plus crowd bonus; both on a tie.

### Phrasebook ("Song sheet")

Every line a duelist sings goes in their phrasebook: `said` (mora similarity ≥ 0.8), `retry`
(≥ 0.5), `missed` (below), `seen` (typed or no take). Audience members get the lines they sang
along with correctly as `said`. Item ids are `karaoke.<song>.<line>`.

### The phone

- **Hold to sing.** Press during the count-in (or on the beat) and hold until the line is done;
  the phone lets go a beat after the line ends (12 s at most). On release it sends the take at
  once (no "Send" step, unlike other modes: the next singer is waiting). The line shows the same
  bouncing ball as the TV, timed from the server's clock, with romaji under each mora at Kana
  level.
- **Pitch tracker** (`pitch.ts`): `getUserMedia` → `AnalyserNode`, every 40 ms an
  autocorrelation pitch estimate (70–1 100 Hz) and loudness; on release, `summarise` turns the
  samples into the 100 ms contour, and the onset and length from loudness above the room's
  noise floor.
- **Words:** the hold records one clip (`components/mic.ts`); on release it goes to our own
  Whisper server ([speech.md](../speech.md)) and the transcript is sent with the take. The pitch
  tracker listens to the same recording, so there is no mic conflict. A "Turn pitch off/on" link
  lets anyone choose (localStorage `kotoba:karaoke-pitch`).
- **Quiet fallback:** "Can't sing right now? Type it" (with the kana pad), open by default when
  the server has no speech-to-text or quiet mode is on.
- **Audience:** a sing-along button (words only, no pitch), then the crowd vote.

### The TV

Song card; then a karaoke screen per turn: singer, line number, count-in numbers, the line in
big kana with the ball and a fill as each mora is sung (CSS animations with delays from the
server clock, so redraws don't jump), kanji line above when the line has kanji, English below, a
progress bar, the next line, and a toast with the previous take's breakdown. A duel board beside
it shows every line's take scores (⌨ for typed, — for missed). Crowd vote and duel result
screens follow. Audio needs one click on the stage page ("🔊 Click for music"); any click (e.g.
Start) unlocks it. Music can be muted.

### Bots

`karaokeDuelPolicy({ seed, slip, noPitch, quiet, chorusRate, delayMs })`: the transcript is the
line's kana with the odd mora dropped or swapped for a near miss (each bot has its own slip rate,
10–25%); the contour is the melody in the bot's own key (40% an octave down) with ±1.2 semitone
wobble, sampled the way a phone would; onset −0.36 to +0.54 s; length 85–115%. `noPitch` bots send
button timing and no contour; `quiet` bots type. Audience bots sing along half the time and vote
at random.

### Host cues (Chōchin-san)

`encore_invite` with the first singer's name on the song card ("{name}, the microphone is
yours"), `encore_cheer` at the crowd vote, `reveal_react` (good/ippon by the winner's average
take) or `miss_kind` at the result, and the shared `recap_award`.

### Awards

カラオケ スター (most duels won), ベスト テイク (best single take), はくしゅ しょう (most
crowd-favourite wins), コーラス しょう (most chorus points). Each needs at least one.

## Decisions made on Ladi's behalf

1. **Host: Chōchin-san.** The theatrical lantern-ghost announcer fits a late-night karaoke
   stage (a paper lantern is the stage light), and he had one segment to Pon's and Fude's two.
   His written bank is train-themed, so cues stick to events whose lines read generically
   (`encore_invite`, `encore_cheer`, `reveal_react`, `miss_kind`); no `intro` or `prompt_read`
   cue ("A question for our passengers").
2. **One-on-one duels, rotating, not two teams.** Both duelists sing every line (so the room
   hears each line twice: hear it, then say it) and who goes first alternates, so neither always
   gets to copy. Teams (紅白-style) are an open question.
3. **Everyone else sings along (chorus) and votes.** Keeps the design doc's "everyone speaks
   every round": chorus is words only, +10 a line, capped at +40 a song.
4. **The 30% bonus pool.** Here singing *is* the hit (like votes in Oogiri), so the take score
   isn't a bonus. The only speaking bonus outside it is chorus (≤ 40 a song, well under 30% of
   a duelist's 400). The crowd favourite is a vote (+60, 120 in the final song) and can flip a
   close duel, on purpose: the room decides who put on the show.
5. **Last song doubled** (takes and crowd bonus), per the shared scoring rule.
6. **Pronunciation = the recogniser understood it,** mora by mora, as the design doc's speech
   section says ("we do not claim pronunciation scoring in v1"). Lenient by level (full marks
   at 0.8 / 0.9 / 0.95 similarity).
7. **Pitch by shape, key- and octave-free,** stretched over the singer's own span, so a
   beginner who sings in their own key, an octave down, or a little slow still scores.
8. **No words, no tune.** Pitch and timing shrink below 0.4 pronunciation, because the phone
   can hear the TV's guide melody.
9. **Without pitch, reweight to 80/20** (keeps the 60:15 ratio) and say so on the phone and TV.
   A tracker that ran but heard nothing in tune scores pitch 0 rather than reweighting. A
   player can still turn pitch off beforehand to be scored on words and timing; that's allowed.
10. **Typed takes earn half the words score and no pitch or timing** (max 50): never blocks
    play, but singing is clearly better.
11. **Takes send on release**, no confirm step. A misheard take still counts; the turn timer
    can't wait for a retry.
12. **One bar (4 beats) count-in**, a 0.7 s breath before it and 3 s after the line for the
    recogniser. A take ends the turn early.
13. **Guide melody is quiet** (triangle at low gain) with a soft bass on each beat, so phones
    mostly hear the singer.
14. **Songs live in the mode folder** (`songs.ts`, like Concentration's scenes), not in
    `content/` and `ContentLibrary`, to keep engine changes at zero. Fourteen original draft
    songs, four lines each, every line under 5 s. Five are children's-style sing-alongs
    (greetings, food, travel; `kids: true`). Nine are grown-up songs in karaoke-box genres with
    beginner words, each with a twist in the words: city pop (夜の ドライブ, two versions: the
    sat-nav gets lost, or the passenger falls asleep), enka (雨の 港, two versions: a ten-year vow for a five-minute ferry, or waving off her own ship), an anime-opening rocker (走れ！, two versions: running
    from footsteps that turn out to be Mom with your lunch, or racing for the last melon bread), an izakaya chant (乾杯！), salaryman blues (月曜日 ブルース, four versions: in pyjamas on
    the train, up early on a holiday, and two straight learning songs), a Shōwa couple's-quarrel duet (どこ 行ってたの？), a self-intro rap
    (自己紹介 ラップ, whose tune is the words' pitch accent), idol pop (キラキラ アイドル, "…so
    buy a ticket!"), an R&B ballad (ねられない よる, two versions: the crush finally calls back and
    asks who's calling, or five coffees) and kawaii pixel future bass (セーブ して！,
    two versions: Mum answers dinner with the kid's own excuse, or the cat presses the button). Tests check one note and one romaji
    syllable per mora, that every perfect take scores 100, and that every chord name parses.
    The humor writer, a songwriter and the JLPT expert reviewed the first drafts (2026-10-27,
    project files `reviews/karaoke-songs-2026-10-27/`); their agreed fixes are in: melodies
    follow pitch accent (もう 一杯 drops after い, so it means "one more glass", not "full"),
    sung notes are at least ~200 ms, each song spans an octave or less, the title is sung, and
    words above N4 were swapped out (残業, 満員, 飛べ).
19. **Grown-up songs first.** A game plays every grown-up song (shuffled) before any
    children's song, so a default four-song game has none. Ladi asked to move past children's
    songs (2026-10-27).
20. **Each song has a backing style** (`style`: nursery, citypop, enka, rock, izakaya,
    blues, kayou, hiphop, idol, rnb). It sets the bass pattern, swing, light drums (kick, snare
    or claps, eighth or sixteenth hi-hats, four-on-the-floor or boom-bap) and the guide's sound;
    enka and kayou get vibrato on held notes (1.5 beats or more). Grown-up lines carry chords
    (`chords: 'Bbmaj7 Am7'`, spread evenly over the line) and the bass plays their roots, so
    there is harmony; the kids' songs have none and the bass follows the melody. Sung notes are at least half a beat, because
    the phone's 100 ms pitch frames can't measure shorter notes.
21. **Grown-up songs are whole songs over real instrumentals** (Ladi, 2026-10-27: "Real songs,
    real instrumentals… giving credit where necessary"). Each has 12 original lines (verse 1,
    chorus, verse 2; the chorus comes back at the end) sung over a CC0 or CC BY track from
    OpenGameArt or incompetech (row 22 of the commercial-blockers log). Each file is cut to the
    bars the song uses; `track.segments` stitches its intro and sections back to back on bar
    lines, from tempo, bar and chord maps made with librosa. Line chords come from those maps, so
    the synth fallback (streamer mode, or a file that won't load) still plays in the same key.
    Lyrics stay at N5–N4 with one joke per song, usually the last verse line before the final
    chorus. Ladi plans to commission songs written for the game before it is sold. Picks: Nights
    In June (city pop), Past Sadness (enka, Ladi's pick), JRPG Epic Rock Battle Theme, Hot Springs
    Town, Hustle, Lazy Saturday, Cheers For Starlight, Slow Jam (later replaced) and In Your Arms.
22. **AI-made backings with Mureka, and song versions** (2026-10-27). Ladi found the CC tracks
    hard to sing over, so each grown-up song gets a backing made for it with the Mureka API
    (row 26 of the commercial-blockers log). Prompts ask for a soft "minus-one" accompaniment
    with no lead, riff or solo competing with the singer, at a steady tempo, and Ladi approves
    each prompt. Mureka doesn't reliably follow the requested chords, so the lyrics and melody are
    written fresh for each take to the chords it actually plays (measured with librosa), then
    reviewed by the humor writer, a songwriter and the Japanese expert. The cut file is already
    the song's bars in order, time-stretched to an exact tempo, so its `track` is one segment.
    When two takes both work, the song keeps both as **versions**: songs that share a `group`
    are one song, and each game plays one of them at random (`playableSongs`). Night Drive is
    first: version A (sat-nav lost, minor-iv city pop) and version B (passenger asleep,
    IV–V–I–vi), both at 100 bpm in D major. Its old "out of gas" lyrics and Nights In June are gone.
    Harbour in the Rain is second: version A (the five-minute ferry, one Dm7–G7–C–Fmaj7–G7–E7–Am
    loop) and version B (she misses her own ship, a verse that ends on E7 and a chorus twice as
    fast), both at 71 bpm in A minor. Its old umbrella lyrics and Past Sadness are gone.
    Run! is third, a soft live-band J-rock backing (Ladi sent anime-opening tutorials as references):
    version A (Mom with the lunch, a royal-road chorus that ends on I, 132 bpm) and version B (the
    melon-bread race, an I–IV–iii–vi–ii–V verse, 134 bpm), both in A major. Its old diet lyrics and
    JRPG Epic Rock Battle Theme are gone.
    Save It! (セーブ して！) is a new tenth grown-up song in Ladi's "fun and punchy" pixel
    future-bass style (references: Snail's House, "Pixel Galaxy"; eleline, "Koto no Town"), kept
    to half-time drums, pumping pads, koto and chiptune chords so nothing leads over the singer.
    Version A (Mum and the kid, 141 bpm in A, royal-road chorus) and version B (100 hours, then
    save data zero, 140 bpm in E). It uses the idol style for the synth fallback.
    Sleepless Night is third, and Ladi's all-N5 song (every word and kanji N5; the title became
    ねられない よる because 眠る and 夜 are N4): version A (the call back at 4 a.m., 71 bpm in C
    minor, one Cm7–C7–Fm7–G7 loop with the chorus opening on Fm7) and version B (five coffees, 72
    bpm in C major, a IV–iv–I chorus). Its old "it's Mum" lyrics and Slow Jam are gone. Ladi
    asked for the title not to be sung, so its choruses hang on 電話 まってる and あさまで おきてる.
    Monday Blues is third, with four versions over two E-minor blues takes (Ladi asked for two lyric
    sets per take, one funny and one that only aims at songwriting and learning). Over take 1
    (92 bpm, Em–Em–Am–D7 shuffle): B, up early on a holiday, and C, a straight workday in clock
    times with the weekdays as its chorus. Over take 2 (94 bpm, 8-bar blues): A, late for work in
    pyjamas, and D, a straight rainy Monday with a friend. Its old lyrics and Hustle are gone.
    Ladi asked that the title not be sung, so each chorus opens and closes on its own hook
    (早く 早く 早く, ああ 行きたくない, 月曜日 スタート, ゆっくり 行こうよ).
    The method and scripts are in project files `tools/mureka/`.
15. **Romaji** shows under each mora on a Kana-level player's phone, and on the TV when anyone
    at the table plays at Kana level. Kanji lines show kanji above the kana for N5+ reading
    practice; the ball always runs over kana.
16. **What the recogniser heard is private** to the singer (phone only); the TV shows scores.
17. **Duel pairing** prefers connected players; a duelist who drops is skipped (their turn
    scores 0) so the room doesn't wait.
18. **Awards** are mode-local titles (draft kana), like Concentration's.

## Open questions

1. **Teams?** Should 4+ players split into Red and White teams (紅白歌合戦) with team members
   taking lines, instead of rotating one-on-one duels?
2. **Encore from memory?** The design doc values saying it from memory. A final "sing the hook
   with the lyrics hidden" bonus would fit; not built.
3. **Whisper on sung lines.** Words now come from Whisper (ADRs 0004 and 0005), which removed
   the old recogniser-vs-pitch mic conflict. Nobody has checked how well Whisper transcribes
   *sung* beginner Japanese on a real phone.
4. **Guide melody during takes.** Keep it (helps beginners, can leak into the mic) or play the
   melody only on the song card and keep just the beat during takes?
5. **Is the crowd bonus too big?** 60 (120 in the final song) can outweigh a few lines of
   singing. Intended, but worth a playtest.
6. **Chōchin-san needs karaoke lines** (intro, song card, a great take) in his bank; the
   content thread would write them.
7. **Fluent check:** lyrics, English, award titles. **Musician check:** do the melodies fit
   the words' pitch accent (e.g. あめ vs あめ)? The kids' songs ignore accent; the grown-up
   songs were written to follow it.
8. **Pitch accent**: the design doc doesn't score pitch accent in v1, and this mode's pitch is
   the tune, not accent. Fine to leave it that way?
9. **Ideas from the song review, not built:** a crowd-vote question per song ("Who cried
   hardest?" for the enka), a one-line stage direction on the song card ("fist to chest"),
   song-card notes (君 and あなた are for songs; 一杯 vs いっぱい), Chōchin-san karaoke lines
   (「スポットライトは わたくしです」), A/B voice labels for the duet, playing 乾杯！ first, and a
   pickup beat before a line.
10. **Fluent check on accents** the reviewers weren't sure of: とりあえず, ガソリン, げつようび,
    ごめん, はじめまして, ねむれない, みんな, チケット.

## Known gaps

- Never played with real voices: the recogniser's transcripts of *singing* (not speech) may be
  much worse than of speech; thresholds were tuned with bots and synthetic tones.
- The pitch tracker is a plain autocorrelation; noisy rooms and the TV's own guide melody can
  fool it (the words gate limits the damage). The onset uses loudness above the noise floor, so
  a loud room can make onsets early.
- Clock sync is the "largest `at − now` sample" trick (as in Kana Raid): a phone whose clock
  drifts mid-game, or a slow first push, can shift timing by up to a few hundred ms (inside the
  250 ms full-marks window most of the time).
- Stage audio needs a click on the stage page first (browser autoplay rules).
- Headless smoke test only (Chromium, 1920×1080 / 1280×720 stage, 360 px phones, typed takes):
  no real microphone, recogniser or speakers.
- The new lyrics and melodies (2026-10-27) haven't been through the review panel or a fluent
  check, and the tracks' chords come from automatic chord detection, so a line can clash with its
  track here and there.
- Fourteen songs: a long night repeats them (they cycle: grown-up songs first, then the kids' songs).
- The drums are synthesised noise and a sine kick. Kept quiet, but the phone mic may hear them;
  the words gate limits the damage, as with the guide melody.
