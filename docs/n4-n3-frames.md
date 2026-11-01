# N4 and N3 sentence frames (matching groundwork)

Step 1 of the N4/N3 learning paths plan (the "Kotoba Party: N4 and N3 learning paths and new games" doc).
It teaches the game to recognise the sentence frames the Express Line (N4) and the first Limited Express
(N3) goals are built on, before any game asks players to say them. Players see almost nothing new: the
recap chips (`frameOf`) pick up a few fixes. Counters now count as ＿を ください, ええ counts as a yes, and a
favour request (＿て くれませんか, ＿て いただけませんか) gets no chip, where it used to be called an
invitation (＿ませんか).

Code: `shared/src/japanese/frames.ts`. Tests: `tests/frames.test.ts`, lines in `tests/frame-cases/`.

## What's new

- **`framesOf(phrase, tokens?)`** names every frame in a line, N5 to N3, sentence by sentence:
  「あめに ふられたので、おくれました」 is the passive, ので and ＿ました. `frameOf` is unchanged: it still names
  the one N5 frame a phrase is built on, from the original sixteen, for the chips and the path.
- **150 frames.** The sixteen N5 frames (`FRAMES`), 17 more N5 frames the tiered path's goals need
  (`MORE_N5_FRAMES`), 61 N4 frames (`N4_FRAMES`), and 56 N3 frames (`N3_FRAMES`): らしい, うちに and reason
  ため from step 1, and the other 41 Limited Express frames from step 6 (see "The Limited Express" below). The N4 frames are the 50 for goals 4.1 to 4.14 (including the
  keigo-verb matcher), のに (moved from N3 on the Japanese expert's advice: Genki II and Minna II teach it in
  the N4 range), and eight the expert said an N4 student expects: みたい／ようです, polite ＿んです, the
  causative, ＿て ほしい, ＿ば よかった, ＿たり ＿たり, ＿ところです and casual ＿って. The first six are now
  optional frames on path goals 4.1, 4.2, 4.3, 4.6 and 4.9 (docs/progressive-learning.md); ＿ところです and
  casual ＿って still have no goal.
  `FRAME_BY_ID` and `ALL_FRAMES` cover them all. Ids match the tiered path's goal list.
- **Part of speech.** The server's kuromoji tokens now carry the finer part of speech, the dictionary form
  and the conjugation (`detail`, `base`, `ctype`, `cform` on `UtteranceToken`).
- Every new frame and example is `status: 'draft'` until a fluent speaker checks it.

## How matching works

Each matcher is a regex on the kana and on the written text, with `not` for look-alikes. Some also read
the tokens:

- **Needs tokens** (`pos: 'need'`): ＿の＿, adjective + です, と as "if", ＿し、＿し, the ichidan passive,
  ＿させて ください. Without tokens (the phone) they're left out. Missing a frame is fine; naming the wrong
  one isn't.
- **Tokens can veto** (`pos: 'veto'`): the spelling decides, and the tokens can only say no.
- **Spelling only**: everything else.

**kuromoji misreads kana-only text** (やさい as an adjective, うち always "home", ため as ためる, ふるそう
as "looks old"). So a token hit on a line with no kanji must also pass a kana check (`kanaOnly`), and some
frames the plan named for part of speech go by spelling instead:

| Frame | How it's told apart |
| --- | --- |
| そう (looks / I hear) | The kana before そう: a plain form (ふる, たべた, だ, ない) is hearsay, a stem (ふり, おいし, なさ) looks. An い ending (かいそう / おいしいそう) needs the tokens |
| Passive | Tokens when the line has kanji. In kana: a godan or する passive after someone who did it (みんなに わらわれた), minus ichidan verbs that end in あ-row + れる (わかれる, うまれる). Ichidan られる needs a を object to rule out "can" |
| らしい | After a plain form, not the adjectives (あたらしい) or おとこらしい. Nらしい only at the very end |
| のに | After a plain form, not purpose のに (きるのに つかう) |
| うちに | After ない, ている, な or an adjective, not before going home or living (おおきい うちに すむ) |
| ため | Purpose after a non-past verb or Nの ために "for"; reason after た, an adjective, な or a cause (あめの ため). Other Nの ため is left out: it reads both ways |

When two frames hit the same sentence and one says more (＿て もらえますか is also a ＿ますか question),
only the more specific one is named (`hides`). That suits showing a player what they said. For counting
progress, `framesOf(phrase, tokens, { keepHidden: true })` keeps the general one too, so an N5 step that
counts ＿です doesn't lose おいしそうです when the switch to `framesOf` happens.

## The Limited Express (N3), step 6

Every frame in the plan doc's Limited Express table now has a matcher, under the ids the path and Yōkai Court
use. All are `status: 'draft'`, with the same 10/10 bar (`tests/frame-cases/n3-a.ts` to `n3-c.ts`). There's
little N3 content yet, so most lines are written for the test; the game's own lines are marked `[game]`.

| Goal | Frames |
| --- | --- |
| 3.1 Rumour | `mitai-casual` (with `rashii`, `ni-yoru`, `n-datte`) |
| 3.2 What happened to me | `suffering-passive`, `saserareru`, `tokoro-deshita`, `sasete-morau` |
| 3.3 Reasons and blame | `sei-de`, `okage-de`, `wake-desu` (with `tame-reason`) |
| 3.4 Contrast | `wari-ni`, `kuse-ni`, `ni-kurabete` (with `noni`) |
| 3.5 What-ifs | `to-shitara`, `ba-hodo` (with `ba-yokatta`) |
| 3.6 Intentions | `you-to-suru`, `zu-ni`, `koto-ni-shiteiru`, `ta-tsumori` |
| 3.7 Explaining | `wake-dewa-nai`, `beki`, `to-iu-koto`, `to-shite`, `toori-ni` |
| 3.8 Service Japanese | `sasete-itadaku`, `de-gozaimasu`, `te-orimasu`, `go-kudasai`, `kashikomarimashita` |
| 3.9 Time and change | `tabi-ni`, `saichuu-ni`, `te-kita` (with `uchi-ni`) |
| 3.10 Opinions | `you-na-ki`, `ni-chigainai`, `ni-taishite`, `shika-nai`, `sorenanoni`, `tsumari` |
| 3.11 Casual nuance | `ppoi`, `nante`, `toka`, `jan`, `kke` |

How the harder ones are told apart:

| Frame | How |
| --- | --- |
| Suffering passive | An intransitive verb made passive after someone (こどもに なかれた, ともだちに こられた, あめに ふられた), or a passive with a を object (さいふを ぬすまれた). ふられる counts only after rain or snow: かのじょに ふられた is a direct passive. A plain passive with no object (ははに しかられた) stays the N4 frame |
| ＿させられる | The long form, or the short godan form for a list of verbs (またされる, のまされる): はなされる and わたされる are plain passives |
| ＿させて もらう／いただく | Tokens, as ＿させて ください: a causative suffix, or a verb kuromoji keeps whole (働かせる), minus 任せる, 知らせる, 見せる… |
| ＿ところでした | After a non-past verb: after た it's "had just" (the N4 frame) |
| ＿ずに | Not みず (water) or ちず (a map) before に, unless the word follows を or も (テレビを みずに) |
| ＿て きました | A change or a run up to now. Going and coming back (かって きた), and coming somewhere (はしって きた, おくれて きた, にげて きた), are left out |
| ＿として | Not おとして (dropped), ＿ようと して, ほっと して, だとしても |
| ＿しか ない | Only after a verb (かえる しか ない, "no choice but to"). Nしか ない (ひゃくえんしか ない) is N5 and stays out |
| ご＿ください | A list of the verb nouns staff use (ごちゅうい, ごえんりょ, ごりよう…), so ごはん, ごみ and ごまんえん stay out |
| ＿て おります | Not おります after を, から, に or a place (さんかいで おります: getting off on the third floor) |
| The suffering passive | An intransitive verb made passive after someone (あめに ふられて, こどもに なかれた, にげられた), only in a form that tells what happened (not にげられますか), or a を object in the same clause (かぎを わすれて、ははに おこられた is the N4 passive). Giving verbs (わたされた) and される are left out. With kanji and no spaces, the dictionary's tokens decide |

N3 frames mostly don't hide the N4 frames they overlap (ご＿ください is still お＿ください), so a line keeps its N4
chip. Some hide one for display only: ＿ところでした over ＿ところです, the suffering passive over the plain
passive (あめに ふられました gets one chip, not two), casual ＿みたい over ＿みたいです, and ＿て おります and ＿で
ございます over the keigo-verb chip. They also hide N5 ＿です and ＿ます where they say more. Counting
(`keepHidden`) keeps every one: every suffering passive counts as a passive too (Genki II L21 and Minna L37 teach
雨に降られる and 足を踏まれる with the passive), and casual みたい counts for 4.6 as well as 3.1.

**A frame that can't count yet hides nothing.** `framesOf(…, { only: creditable })` drops N3 and listening-only
frames before working out hides, so while N3 is off the recap ("Tonight on your path") still shows the passive
for あめに ふられました and the keigo chip for ＿て おります. Progress counts without the tokenizer (the phone's
path), so the spelling rules are what decide credit there.

**Not credited yet.** `creditable(id)` is false for N3 frames and for listening-only ones, and progress
(`phraseFrames`) and the night's recap (`tonightFrames`) skip them. So an N4 player who says an N3 line
gets no permanent N3 mark before N3 is on the path; the path's step-6 PR turns N3 on.

**Listening only.** ＿じゃん and ＿っけ have `listening: true`: the plan counts them for a goal's listening half,
never as a line the player says.

**3.8 overlaps N4 textbooks.** ＿させて いただく, でございます, ＿て おります, ご＿ください and かしこまりました are
taught in Genki II and Minna no Nihongo II, the N4 courses. They stay at 3.8 as the plan has them, since
the JLPT lists them at N3; the open questions doc has the question.

**On the phone.** With no tokens, ＿させて もらう／いただく fall back to the spelling (かかせて, たべさせて), minus
任せる, 知らせる, 合わせる and the other verbs that end in せる on their own.

**No spaces.** Speech comes back with kanji and no spaces. A test strips the spaces from every N3 line
with kanji and reads its kana with the dictionary; all of them keep their frame. Kana-only lines with no
spaces miss 13 of ~400 (the suffering passive, ＿とかいかない), and ともだちとかえった reads as ＿とか.

## More N3 points (optional on their goals)

The #149 JLPT seat counted about 32 genuine N3 points on 3.1 to 3.11. Twelve of the biggest gaps now have
draft matchers, with the same 10/10 bar (`tests/frame-cases/n3-d.ts`). Ladi chose optional frames on today's
goals (open questions doc, Nov 1): ＿ように いわれました on 3.1, ＿かける, ＿きる and ＿ばかり on 3.2, ＿もので on 3.3,
＿さえ ＿ば on 3.5, ＿わけには いかない and ＿こそ on 3.7, ＿た とたん and ＿だす on 3.9, and ＿はずが ない and ＿に とって
on 3.10. The #158 panel moved ＿きる to 3.2 (with the other compound verb) and ＿こそ to 3.7, so 3.10 isn't a wall of
chips. The chip's Japanese and English come from frames.ts; FRAME_TEXT keeps the same wording, and a test checks the
two match for these twelve. Required frames are now frozen (docs/n3-coverage.md): new frames stay optional.
A sweep of 13,870 game strings finds 1 line that says them (アドバイスばかり), and it's right.

The #157 panel found about 40 more lines that named the wrong frame, mostly compound verbs with the other
meaning (うりだす, わらいかける, わりきる) and kanji lines with no spaces (説明できる, 思い出した). So the compound
verbs now count only a short list of stems with the right meaning. Missing one is fine; naming the wrong one isn't.
Every one of those lines is a look-alike in `n3-d.ts`.

| Frame | How it's told apart |
| --- | --- |
| ＿ように いわれました | After a non-past verb or ない, then いわれる, たのまれる, ちゅういされる. Shown over ＿ように and the passive. Not ＿ように いって (say it like), and not a suffering passive |
| ＿もので | After a plain form or な, then 、, すみません or ものですから. Not もの as a thing (すきな もので いい, ははが つくった もので、), ものです, ほんもの |
| ＿かける | Only half-done stems: たべ, のみ, よみ, いい, きえ, しに, ね, つくり, わすれ, さき and a few more. Not でかける, はなしかける, わらいかける, しかける, おしかける, みせかけ, しんぱいを かける, めがねを かける |
| ＿きる | Only to-the-end stems: たべ, のみ, よみ, つかい, つかれ, はしり, はこび, うたい, まち, かぞえ and a few more. Not できる, おもいきって, わりきる, うりきれ, きる (cut) |
| ＿だす | Only start-suddenly stems: なき, わらい, ふり, はしり, うごき, さけび, おこり, はなし and a few more. Not おもいだす, とりだす, うりだす, ききだす, みつけだす, とびだす, なげだす |
| ＿た とたん | After た／だ only. Not とたん (iron sheet) |
| ＿わけには いかない | Shown over ＿わけでは ない. Not いいわけ, もうしわけ |
| ＿はずが ない | ＿はずは ない and ＿はず ない too. Shown over ＿はずです (counting keeps both) |
| ＿に とって | Not とって "take" (てに とって, とって ください, とって きた, とって おこう, とって もらった, わたしに とって。), とっても (very), or a handle |
| ＿さえ | Not ささえる, おさえる, さえぎる, さえずる, さえる, or names (みさえ, まさえ) |
| ＿こそ | Not the set phrases こちらこそ, そちらこそ and ようこそ, からこそ／＿てこそ (N2), こそこそ, こそだて, こそ泥 |
| ＿ばかり | Nばかり and ＿て ばかり. Not ＿た ばかり (just did: N4, with or without a space), ばかりか／ばかりでなく (N2), ばか, or an amount + ばかり (ふたつばかり, ちょっとばかり) |

## Spoken N3 frames (docs/n3-coverage.md)

Ladi's N3 question chose Plan B, spoken N3: the Limited Express stops only at the N3 a player says. The inventory
(`shared/src/japanese/n3Points.ts`) lists every N3 point with a fit and a band, and 26 of its speak points now have
draft matchers, each optional on its goal, with the same 10/10 bar (`tests/frame-cases/n3-e.ts`). Required frames
are frozen as they were on Nov 1.

| Goal | New optional frames |
| --- | --- |
| 3.2 | ＿っぱなし, ＿だらけ |
| 3.3 | ＿がち, ＿んだから |
| 3.4 | ＿に しては, ＿かわりに, ＿だけで なく |
| 3.5 | ＿と しても, たとえ ＿ても |
| 3.6 | ＿ずに すむ, ＿ふりを する |
| 3.7 | ＿と いうのは, ＿ことは ない, ＿ことに なって いる |
| 3.8 | ＿て いただきたい |
| 3.9 | ＿て いく, ＿に つれて, ＿ついでに |
| 3.10 | ＿に きまって いる, ＿とは かぎらない, ＿に よって, ＿と いうより, ＿ない ことは ない, ＿わけが ない |
| 3.11 | ＿て しょうがない, ＿ほど ／ ＿くらい (degree) |

Other changes:

- ＿っけ is now speakable (it was listening only), on 3.11. ＿じゃん stays listening only.
- ＿としたら no longer matches ＿と しても, which has its own frame.
- ＿くらい (degree) is the same frame as ＿ほど. Not くらい after a time or amount, and not くらい before です／だ／なら.
- Longer frames are shown over the shorter ones they contain: ＿ずに すむ over ＿ずに, ＿ことに なって いる over
  ＿ことに なる, ＿ない ことは ない over ＿ことは ない, ＿わけが ない over ＿わけです.
- Look-alikes worth knowing: ひとりがち and おおがち aren't ＿がち; たとえば isn't たとえ ＿ても; a date before
  に きまった isn't ＿に きまって いる.

A sweep of 13,942 game strings finds real lines for ＿かわりに, ＿と いうのは, ＿ふりを する, ＿だらけ, ＿に よって and
＿くらい (Nobiko's おこす くらい), and no wrong ones.

## Fixes from the panel on #146

The Japanese and JLPT seats found matcher gaps while checking the Express Line simulation:

- **Potential**: a longer list of godan potentials (行けます, 使えます, 買えます, えらべます, おろせます…) and
  ichidan られる after an ichidan verb that ends in れる (わすれられません). All 10 Tourist N4 lines tagged
  `potential` now get it. Spellings that are also an ichidan verb in kana (かえる 買える／換える, 入れる) count
  only in kanji; いけません／いけない count unless it's "mustn't" (〜ては, ないと). **Nが できます no longer counts**:
  it's an N5 word (＿ことが できます still does).
- **Plain**: a plain question with nothing after it (もう たべた？, いかない？, ひま？) and a て-form with ね／よ
  (ちょっと まってね) now count. だ after a verb or an い-adjective (おいしいだよ, いくだよ) doesn't.
- ＿ないと いけませんか and ＿ても かまいませんか are no longer invitations (`masen-ka`). ＿ても かまいませんか counts
  as ＿ても いいですか. ＿なくても いいですか no longer counts as ＿ても いいですか, even with hidden frames kept.
- と いったら どうですか is no longer ＿と いって いました.
- ＿たら どうですか no longer counts as ＿たら for 4.5, even with hidden frames kept (the panel's point 5).

A sweep over the game's ~9,800 Japanese strings found the N3 matchers' misfires (おばけみたいに as a guess,
おみずに as ＿ずに, おくれて きた as ＿て きました) and fixed them; the new hits it finds are right (にげられました
as the suffering passive, すんでおります as ＿て おります).

## Fixes from the panels on #149 and #153

- **Reason ため and purpose ために.** しない ために (けがを しない ために) is purpose. Other ＿ない ために (しらない,
  わからない, ねられない) and ＿たい ため are left out: they read both ways. ＿ない ため、 alone is a reason
  (でんしゃが うごかない ため). A verb + ため、 with no に isn't counted as purpose: でんしゃが とまる ため、 is as
  often a reason. ゆうれいの ために is "for the ghost" as often as "because of it", so it's in neither list. ためる
  later in the line no longer cancels a purpose ために.
- **＿としたら.** Nと したら is usually "did it with N" (かるたを せんせいと したら). The tokens rule out と "with"
  after a noun; on the phone, a list of people words at the start of a word does (so うまいと したら still
  counts). Known miss: はんにんが せんせいと したら ("if the culprit is the teacher") is a real ＿としたら and
  is now missed.
- **＿なんて.** The adverb なんて "how…!" (なんて きれいな けしき, けしきは なんて きれいなんだ) no longer counts:
  only なんて after the thing being waved off.
- **Display hides** and the recap, above.
- **From #152's Japanese seat.** Some misreads are now left out even when counting keeps hidden frames
  (`excludes`): まって ください isn't ＿を ください, a passive (ともだちに わらわれました) isn't ＿に ＿ます. ＿た ことが
  あります isn't ＿が あります. Hearsay そう after a space counts (ふる そうです, しずかだ そうです), and so does ＿たい
  + そう (みたいそうです). A verb you don't choose (はなせる, なおる, わかる) + ために isn't purpose: that's ように.

## The precision bar

Every matcher finds its frame in at least 10 positive lines and in none of 10 look-alikes. Positives are
checked with hidden frames kept (an N3 frame may hide the N4 one for display); look-alikes are checked
both with tokens and on the phone path. The N5 lines
are real game lines where the game has them (probes are marked). The N4 and N3 lines are written for the
test: there's little N4 content yet. A sweep over all ~10,000 Japanese strings in the game's content found
and fixed more misfires (かんとく as 〜とく, なんと いいますか as a report, かしら as an embedded question).

A fluent reviewer then wrote ~95 fresh lines without seeing the matchers, and about 30 got a wrong frame
(しんせつそう as hearsay, ここに すわれますか as the passive, もっと ください as 〜とく). Those are fixed and
kept in `tests/frame-cases/panel-probes.ts`, checked with and without tokens. That rate is the honest
picture: the 10/10 bar is a regression test, not a measure of precision (see "For step 2").

## Known gaps (on purpose)

- Plain forms count toward the polite frames (Ladi, Nov 1): もらえる？ and くれない？ as favours, ＿たい(な) at
  the end as ＿たいです, ＿ないで at the end as ＿ないで ください. Other casual forms beyond 〜てる／〜とく, ＿んだ and
  ＿よ／ね／の are thin.
- ご＿ください counts as お＿ください, for a list of verb nouns (ごちゅうい, ごえんりょ, ごじょうしゃ…), so ごはんを
  ください stays out.
- Agentless passives (この寺は建てられた) are left out: without someone who did it (Nに) or a を object,
  godan れる is as likely honorific (社長は帰られました) and ichidan られる "can".
- N4 grammar still without a frame (nice to have, per the Japanese expert): ＿ように する, ＿なさい, ＿と いい,
  ＿ばかり and the causative-passive. Lexical causatives (泣かせる, 笑わせる) are one dictionary verb, so the
  causative misses them.
- N3 frames have no path goals yet: N3 joins the level picker and the path in its own step-6 PR.
- Kana-only lines with no spaces: see "No spaces" above. The phone sends spaced kana.
- ＿ところでした after a non-past verb is also "it was a place where" (ここは わたしが すむ ところでした). A line
  that starts with ここは／そこは stays out; elsewhere a bare verb + ところでした counts as "nearly".
- The N3 lines were written and checked by Claude with the panel's Japanese seat. A fluent speaker still
  needs to check them before they ship (all N3 frames stay `status: 'draft'`).
- `frameStats` and the path still use `frameOf`. Switching them to `framesOf` (with the server's tokens)
  is step 2's job, with the hard roles that produce N4 lines.
- English and romaji: the labels are Japanese only, as in the sixteen. A hand-written romaji per frame
  waits for the fluent-speaker check.

## For step 2 (from the expert panel on this PR)

- **Count with `keepHidden`**, and test that the switch never lowers an N5 step's progress.
- **Not every frame can be a goal.** `no`, `plain`, `youbi`, `gatsu-nichi`, `ji-fun` and `migi-hidari`
  fire on lines players didn't choose to build; `keigo` mostly fires on announcements players repeat.
  Count those only where the player chose the line.
- **Filter by tier.** My progress should list the frames of the player's tier, not all 95.
- **Store frames on the phrase card**, computed on the server with tokens when a phrase is saved, with a
  matcher version, so the phone shows what the server credits and never a different frame.
- **A targeted check** for hard roles that know their frame: hit, miss or can't tell. Show hits, say nothing
  about misses (a miss on a player's own words would feel unfair).
- **Measure precision properly before frames count toward goals.** 0 misfires in 10 look-alikes still
  allows a misfire rate up to about 26%. A frozen held-out set written by the fluent reviewer without seeing
  the matchers, at least 30 look-alikes a frame, and learner speech through the real recogniser (with
  near-misses like たべれます) should gate credit.
- **Track the slot.** A goal met by one memorised phrase isn't the frame: return the verb used and ask for
  two different ones (and for あげる／くれる／もらう, two of the three). `potential` counts できます alone.
- **Deliberate production only.** Reading a scripted line isn't saying it from memory: credit by where the
  line came from, and separate the prompt's target frame from frames that are "also used".
