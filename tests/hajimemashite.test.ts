import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import { nameToKatakana, romajiToHiragana } from '../shared/src/japanese/toKana.js';
import { cardsFor, endsInForm, fillFrame, GREEN_CAR_N4_FRAMES, greenCarCard, INTRO_CARDS, introCardOf, tileOf, tilesOnly } from '../shared/src/modes/hajimemashite/cards.js';
import { FRAME_BY_ID, framesOf, type FrameId } from '../shared/src/japanese/frames.js';
import { greenFrameOf, LINE_MS, pickGreenCard, POINTS, typedWord, type HajimeState, type HajimeView, type Turn } from '../shared/src/modes/hajimemashite/hajimemashite.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { createReader, type Reader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { hajimemashitePolicy } from '../tools/bots/policies/hajimemashite.js';
import { content as CONTENT, hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const speech = (text: string): Utterance => ({ via: 'speech', text });

class Table {
  now = 1_000_000;
  ids = 0;
  cmdId = 0;
  readonly random: () => number;
  readonly s: GameState = createGame('BCDF');
  constructor(
    players: number,
    levels: Level[] = [],
    seed = 7,
  ) {
    this.random = mulberry(seed);
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: ['Aki', 'Ladi', 'Matt', 'Siobhan', 'Lee', 'Yuna'][i - 1] ?? `P${i}`, level: levels[i - 1] ?? 'n5' });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: CONTENT, newId: () => `id${++this.ids}`, random: this.random };
  }
  act(action: GameAction) {
    return apply(this.s, action, this.ctx());
  }
  cmd(actor: string | 'stage', command: CommandBody) {
    const who = actor === 'stage' ? ({ kind: 'stage' } as const) : ({ kind: 'player', playerId: actor } as const);
    return apply(this.s, { type: 'command', actor: who, command: { ...command, id: `c${++this.cmdId}` } as Command }, this.ctx());
  }
  play(player: string, move: Record<string, unknown>) {
    return this.cmd(player, { type: 'play', move });
  }
  timeout() {
    this.now = Math.max(this.now, this.s.deadline ?? 0);
    return this.act({ type: 'timeout', phaseSeq: this.s.phaseSeq });
  }
  get st(): HajimeState {
    return this.s.modeState as HajimeState;
  }
  get t(): Turn {
    return this.st.turn!;
  }
  view(viewer: string | 'stage' = 'stage'): HajimeView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, CONTENT).game as HajimeView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(audience: 'kids' | 'family' | 'cheeky' = 'family', extra?: Record<string, unknown>) {
    this.cmd('stage', { type: 'settings', audience });
    expect(this.cmd('stage', { type: 'start', mode: 'hajimemashite', extra } as CommandBody).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.timeout();
    expect(this.s.phase).toBe('prompt');
  }
  /** The guest greets, everyone answers, and the writing starts. */
  greetAll() {
    const g = this.t.guestId;
    expect(this.play(g, { kind: 'greet', utterance: speech('はじめまして。よろしく おねがいします。') }).error).toBeUndefined();
    for (const p of this.s.players) if (p.id !== g) expect(this.play(p.id, { kind: 'kochira', utterance: speech('こちらこそ') }).error).toBeUndefined();
    expect(this.s.phase).toBe('answer');
  }
  /** The guest writes a tile nobody holds; each tanuki writes the first tile in their hand. */
  writeAll(): string {
    const card = introCardOf(this.t.cardId)!;
    const held = new Set(Object.values(this.t.hands).flat());
    const truth = card.tiles.find((x) => !held.has(x.id))!;
    expect(this.play(this.t.guestId, { kind: 'write', tileId: truth.id }).error).toBeUndefined();
    for (const [pid, hand] of Object.entries(this.t.hands)) expect(this.play(pid, { kind: 'write', tileId: hand[0] }).error).toBeUndefined();
    for (const [pid, role] of Object.entries(this.t.roles)) if (role === 'detective') this.play(pid, { kind: 'write', tileId: card.tiles[0]!.id });
    expect(this.s.phase).toBe('reveal');
    return truth.kana;
  }
  /** The introducer reads every line, saying each one. */
  readAll() {
    const intro = this.t.introducerId!;
    while (this.s.phase === 'reveal') {
      const me = this.view(intro).me!;
      expect(this.play(intro, { kind: 'read', utterance: speech(me.script![me.scriptAt]!.text) }).error).toBeUndefined();
    }
    expect(this.s.phase).toBe('encore');
  }
  lieOf(pid: string) {
    return this.t.facts.find((f) => f.kind === 'lie' && f.authors.includes(pid))!;
  }
  truth() {
    return this.t.facts.find((f) => f.kind === 'truth')!;
  }
}

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});

// ---- the cards and the words ----

describe('Nice to Meet You!: the cards', () => {
  it('every card has 16 distinct tiles, a Pon tile, and frames with one blank', () => {
    for (const c of INTRO_CARDS) {
      expect(c.tiles.length, c.id).toBe(16);
      expect(new Set(c.tiles.map((x) => x.kana)).size, c.id).toBe(16);
      expect(c.tiles.map((x) => x.kana), c.id).not.toContain(c.pon.kana);
      expect(c.first.split('＿').length, c.id).toBe(2);
      expect(c.third.split('＿').length, c.id).toBe(2);
      expect(c.third, c.id).toMatch(/^{name}さん[はの]/);
    }
  });

  it('every audience and level has cards, and Cheeky cards stay out of Kids rooms', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) for (const l of ['kana', 'n5', 'n4'] as const) expect(cardsFor(a, l).length, `${a} ${l}`).toBeGreaterThanOrEqual(6);
    expect(cardsFor('kids', 'n4').some((c) => !c.audiences.includes('kids'))).toBe(false);
    expect(cardsFor('family', 'n5').every((c) => c.level === 'n5')).toBe(true);
    // Tiles only: in Kids rooms, and on a cheeky-only card (no typed lies about a real person).
    const cheeky = INTRO_CARDS.find((c) => c.audiences.length === 1 && c.audiences[0] === 'cheeky')!;
    expect(tilesOnly(cheeky, 'cheeky')).toBe(true);
    expect(tilesOnly(introCardOf('suki')!, 'family')).toBe(false);
    expect(tilesOnly(introCardOf('suki')!, 'kids')).toBe(true);
  });

  it('makes katakana names from romaji', () => {
    expect(nameToKatakana('Aki')).toBe('アキ');
    expect(nameToKatakana('Ladi')).toBe('ラディ');
    expect(nameToKatakana('Matt')).toBe('マット');
    expect(nameToKatakana('Lee')).toBe('リー');
    expect(nameToKatakana('ゆうな')).toBe('ユウナ');
    expect(romajiToHiragana('sushi')).toBe('すし');
    expect(romajiToHiragana('nattou')).toBe('なっとう');
  });

  it('reads a typed blank: romaji, a whole sentence, or nothing Japanese', () => {
    const suki = introCardOf('suki')!;
    expect(typedWord({ via: 'typed', text: 'sushi' }, suki)).toBe('すし');
    expect(typedWord({ via: 'typed', text: 'すしが だいすきです。' }, suki)).toBe('すし');
    expect(typedWord({ via: 'typed', text: 'おでん' }, suki)).toBe('おでん');
    expect(typedWord({ via: 'typed', text: '寿司', reading: 'すし' }, suki)).toBe('すし');
    expect(typedWord({ via: 'typed', text: '123' }, suki)).toBeNull();
    expect(typedWord({ via: 'typed', text: 'でんしゃに かさを わすれて しまいました。' }, introCardOf('wasureta')!)).toBe('かさ');
    expect(typedWord({ via: 'typed', text: 'さいきん ヨガを やって みました' }, introCardOf('yattemita')!)).toBe('ヨガ');
  });

  it('has an N4 deck in た ことが ある, て しまいました and て みる, tagged and draft', () => {
    const n4 = INTRO_CARDS.filter((c) => c.level === 'n4');
    for (const c of n4) {
      expect(c.status, c.id).toBe('draft');
      expect(c.frames?.length, c.id).toBeGreaterThan(0);
    }
    const tagged = (f: string) => n4.filter((c) => c.frames?.includes(f));
    // A verb card's frame is its cue (＿た ことが あります); its tiles bring the verb.
    expect(tagged('ta-koto').every((c) => (c.cue ?? c.first).includes('た ことが あります'))).toBe(true);
    expect(tagged('te-shimau').every((c) => (c.cue ?? c.first).includes('て しまいました'))).toBe(true);
    expect(tagged('te-miru').every((c) => /て みま|て みたい/.test(c.cue ?? c.first))).toBe(true);
    for (const f of ['ta-koto', 'te-shimau', 'te-miru']) expect(tagged(f).length, f).toBeGreaterThanOrEqual(2);
    expect(INTRO_CARDS.filter((c) => c.level === 'n5').some((c) => c.frames)).toBe(false);
  });

  it('N4 tiles read as natural things to try', () => {
    const card = (id: string) => INTRO_CARDS.find((c) => c.id === id)!;
    const mitai = card('mitai').tiles.map((t) => t.kana);
    expect(mitai).toContain('ききゅうに のる こと');
    expect(mitai).toContain('まんがを かく こと');
    expect(mitai).toContain('イルカと およぐ こと');
    expect(mitai).not.toContain('ききゅう');
    // Pon's tile on "lately I tried" is a diet, not the shapeshifting he already claims on "I can".
    expect(card('yattemita').pon.kana).toBe('ダイエット');
  });
});

describe('Nice to Meet You!: N4 guests draw the N4 deck', () => {
  it('has Kids and Cheeky N4 cards (one noun card per frame, plus verb cards) that only their rooms get', () => {
    for (const a of ['kids', 'cheeky'] as const) {
      const own = INTRO_CARDS.filter((c) => c.level === 'n4' && c.audiences.length === 1 && c.audiences[0] === a);
      expect(own.filter((c) => !c.conj).map((c) => c.frames![0]).sort(), a).toEqual(['ta-koto', 'te-miru', 'te-shimau']);
      for (const c of own) {
        expect(c.status, c.id).toBe('draft');
        expect(cardsFor('family', 'n4'), c.id).not.toContain(c);
        expect(cardsFor(a === 'kids' ? 'cheeky' : 'kids', 'n4'), c.id).not.toContain(c);
        expect(cardsFor(a, 'n5'), c.id).not.toContain(c);
        expect(cardsFor(a, 'n4'), c.id).toContain(c);
      }
    }
  });

  for (const audience of ['kids', 'family', 'cheeky'] as const) {
    it(`in a ${audience} room, an N4 guest gets an N4 card and an N5 or Kana guest never does`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const n4 = new Table(4, ['n4', 'n5', 'n5', 'kana'], seed);
        n4.start(audience);
        expect(introCardOf(n4.t.cardId)!.level, `seed ${seed}`).toBe('n4');
        // Kids and Cheeky rooms play their own N4 cards first.
        if (audience !== 'family') expect(introCardOf(n4.t.cardId)!.audiences, `seed ${seed}`).toEqual([audience]);
        for (const level of ['n5', 'kana'] as const) {
          const other = new Table(4, [level, 'n4', 'n4', 'n4'], seed);
          other.start(audience);
          expect(introCardOf(other.t.cardId)!.level, `seed ${seed} ${level}`).toBe('n5');
          if (audience === 'cheeky') expect(introCardOf(other.t.cardId)!.audiences).toEqual(['cheeky']);
        }
      }
    });
  }
});

describe('Nice to Meet You!: N4 verb cards (the player makes the た or て form)', () => {
  const verbCards = INTRO_CARDS.filter((c) => c.conj);

  it('has at least six, in た and て, for every audience the N4 deck plays in, each tagged and draft', () => {
    expect(verbCards.length).toBeGreaterThanOrEqual(6);
    for (const c of verbCards) {
      expect(c.level, c.id).toBe('n4');
      expect(c.status, c.id).toBe('draft');
      expect(c.frames!.length, c.id).toBeGreaterThan(0);
    }
    // The shared set, and the Kids and Cheeky sets, each have a た card and a て card.
    for (const set of [['kids', 'family', 'cheeky'], ['kids'], ['cheeky']]) {
      const own = verbCards.filter((c) => c.audiences.join() === set.join());
      expect(own.map((c) => c.conj).sort(), set.join()).toEqual(expect.arrayContaining(['ta', 'te']));
    }
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      expect(cardsFor(a, 'n4').filter((c) => c.conj).length, a).toBeGreaterThanOrEqual(3);
      expect(cardsFor(a, 'n5').some((c) => c.conj), a).toBe(false);
      expect(cardsFor(a, 'kana').some((c) => c.conj), a).toBe(false);
    }
    expect(cardsFor('family', 'n4').some((c) => c.conj && c.audiences.length === 1)).toBe(false);
  });

  it('shows each verb in the dictionary form under a cue with ＿た or ＿て, and fills the line with the conjugated form', () => {
    for (const c of verbCards) {
      const suffix = c.conj === 'ta' ? '＿た' : '＿て';
      expect(c.cue, c.id).toBe(c.first.replace('＿', suffix));
      expect(c.cueThird, c.id).toBe(c.third.replace('＿', suffix));
      for (const t of [...c.tiles, c.pon]) {
        expect(t.dict, t.id).toMatch(/[うくぐすつぬぶむる]$/);
        expect(t.kana, t.id).not.toBe(t.dict);
        expect(endsInForm(t.kana, c.conj!), t.id).toBe(true);
        // Only the verb changes: everything before it is the same.
        expect(t.kana.split(' ').slice(0, -1).join(' '), t.id).toBe(t.dict!.split(' ').slice(0, -1).join(' '));
        // The model line is in the card's frame.
        const line = fillFrame(c.first, t.kana);
        expect(framesOf({ text: line, kana: line }, undefined, { keepHidden: true }), `${t.id}: ${line}`).toContain(c.frames![0]);
      }
      expect(new Set(c.tiles.map((t) => t.dict)).size, c.id).toBe(16);
    }
    // The irregular and the easy-to-miss ones are there to practise.
    const all = verbCards.flatMap((c) => c.tiles);
    const formOf = (dict: string, card: string) => all.find((t) => t.dict === dict && t.id.startsWith(card))!.kana;
    expect(formOf('にほんに いく', 'shita-koto')).toBe('にほんに いった');
    expect(formOf('マラソンを はしる', 'shita-koto')).toBe('マラソンを はしった');
    expect(formOf('おんせんに はいる', 'nihon-temitai')).toBe('おんせんに はいって');
    expect(formOf('ゆびを きる', 'ukkari')).toBe('ゆびを きって');
  });

  it('takes only the plain た or て form as the verb form, not the polite form or a particle で', () => {
    expect(endsInForm('ふじさんに のぼりました', 'ta')).toBe(false);
    expect(endsInForm('げんきでした', 'ta')).toBe(false);
    expect(endsInForm('うみで', 'te')).toBe(false);
    expect(endsInForm('たべます', 'te')).toBe(false);
    expect(endsInForm('たべまして', 'te')).toBe(false);
    expect(endsInForm('プールで およいだ', 'ta')).toBe(true);
    expect(endsInForm('こうえんで あそんで', 'te')).toBe(true);
    expect(endsInForm('来た。', 'ta')).toBe(true);
    expect(endsInForm('ふじさんに のぼった ', 'ta')).toBe(true);
  });

  it('reads a typed verb in either form, and asks for the form when a new verb comes in the dictionary form', () => {
    const tb = new Table(4, ['n4', 'n5', 'n5', 'n5']);
    tb.start('family');
    verbTurn(tb, 'shita-koto');
    tb.greetAll();
    const card = introCardOf('shita-koto')!;
    expect(tb.play('p1', { kind: 'write', utterance: { via: 'typed', text: 'ふじさんに のぼる' } }).error).toBeUndefined();
    expect(tb.t.writes['p1']!.tileId).toBe(card.tiles[0]!.id);
    expect(tb.play('p1', { kind: 'write', utterance: { via: 'typed', text: 'ふじさんに のぼった ことが あります' } }).error).toBeUndefined();
    expect(tb.t.writes['p1']!.tileId).toBe(card.tiles[0]!.id);
    expect(tb.play('p1', { kind: 'write', utterance: { via: 'typed', text: 'ピザを たべる' } }).error).toBe('make-it-ta');
    expect(tb.play('p1', { kind: 'write', utterance: { via: 'typed', text: 'ピザを たべた' } }).error).toBeUndefined();
    expect(tb.t.writes['p1']).toEqual({ tileId: null, word: 'ピザを たべた', en: null });
    // The guest's phone shows the cue and the tiles in the dictionary form.
    const me = tb.view('p1').me!;
    expect(tb.view('p1').card!.cue).toBe('＿た ことが あります');
    expect(me.hand[0]!.dict).toBe('ふじさんに のぼる');
    expect(me.hand[0]!.kana).toBe('ふじさんに のぼった');
  });

  it('an N4 introducer gets the dictionary form, is heard only in the た form, and sees the model line', () => {
    const tb = new Table(4, ['n4', 'n4', 'n4', 'n4']);
    tb.start('family');
    verbTurn(tb, 'shita-koto');
    tb.greetAll();
    const truth = tb.writeAll();
    expect(truth).toMatch(/[ただ]$/);
    const intro = tb.t.introducerId!;
    expect(tb.play(intro, { kind: 'read', utterance: speech('こちらは アキさんです') }).error).toBeUndefined();
    const line = tb.view(intro).me!.script![1]!;
    expect(line.dict).toMatch(/[うくぐすつぬぶむる]$/);
    expect(line.cue).toBe('アキさんは ＿た ことが あります');
    expect(line.text).toBe(`アキさんは ${line.word} ことが あります。`);
    // The dictionary form isn't the line: tried. The た form is.
    expect(tb.play(intro, { kind: 'read', utterance: speech(`アキさんは ${line.dict} ことが あります`) }).error).toBeUndefined();
    expect(tb.t.lines[1]!.read).toBe('tried');
    const next = tb.view(intro).me!.script![2]!;
    expect(tb.play(intro, { kind: 'read', utterance: speech(next.text) }).error).toBeUndefined();
    expect(tb.t.lines[2]!.read).toBe('said');
    // The TV shows the conjugated form.
    expect(tb.view().facts.filter((f) => f.word).map((f) => f.word)).toEqual([line.word, next.word]);
  });

  it('the N4 guest says the truth in the form themselves; the dictionary form is a try, tapping sends the model', () => {
    const tb = new Table(4, ['n4', 'n5', 'kana', 'n5']);
    tb.start('family');
    verbTurn(tb, 'ukkari');
    tb.greetAll();
    const truth = tb.writeAll();
    // An N5 introducer reads the whole line, as on every card.
    const intro = tb.t.introducerId!;
    expect(tb.view(intro).me!.script![1]!.dict).toBeDefined();
    tb.readAll();
    for (const p of ['p2', 'p3', 'p4']) tb.play(p, { kind: 'rank', order: tb.view(p).me!.rankable.map((x) => x.id) });
    tb.play('p1', { kind: 'wish', factId: tb.view('p1').me!.wishable[0]!.id });
    expect(tb.s.phase).toBe('score');
    const t = tb.view('p1').me!.truth!;
    const dict = introCardOf('ukkari')!.tiles.find((x) => x.kana === truth)!.dict!;
    expect(t.cue).toBe(`ほんとうです！ うっかり ［${dict}］ しまいました。`);
    expect(t.line).toBe(`ほんとうです！ うっかり ${truth} しまいました。`);
    expect(tb.play('p1', { kind: 'truth', utterance: speech(`うっかり ${dict} しまいました`) }).error).toBeUndefined();
    expect(tb.view('p1').me!.truth!.said).toBe('tried');
    expect(tb.play('p1', { kind: 'truth', utterance: speech(`うっかり ${truth} しまいました`) }).error).toBeUndefined();
    expect(tb.view('p1').me!.truth!.done).toBe(true);
    // Built from the dictionary form (memory), heard on the second try (retry).
    expect(tb.s.phrasebook['p1']!.find((e) => e.itemId === 'hajime:ukkari:first')).toMatchObject({ outcome: 'retry', recall: 'memory' });
  });

  it('logs the guest’s truth as said when heard, read on a noun card; an N4 introducer’s line is from memory', () => {
    const tb = new Table(4, ['n5', 'n4', 'n4', 'n4']);
    tb.start('family');
    tb.t.cardId = 'tabeta';
    tb.greetAll();
    const truth = tb.writeAll();
    tb.readAll();
    for (const p of ['p2', 'p3', 'p4']) tb.play(p, { kind: 'rank', order: tb.view(p).me!.rankable.map((x) => x.id) });
    tb.play('p1', { kind: 'wish', factId: tb.view('p1').me!.wishable[0]!.id });
    expect(tb.s.phase).toBe('score');
    const first = () => tb.s.phrasebook['p1']!.find((e) => e.itemId === 'hajime:tabeta:first');
    expect(first()).toMatchObject({ outcome: 'seen', recall: 'read' });
    expect(tb.play('p1', { kind: 'truth', utterance: speech(fillFrame(introCardOf('tabeta')!.first, truth)) }).error).toBeUndefined();
    expect(first()).toMatchObject({ outcome: 'said', recall: 'read' });
    const intro = tb.t.introducerId!;
    expect(tb.s.phrasebook[intro]!.find((e) => e.itemId === 'hajime:tabeta:third')!.recall).toBe('memory');
  });

  it('noun cards keep their plain view: no cue, no dictionary forms', () => {
    const tb = new Table(4, ['n4', 'n4', 'n4', 'n4']);
    tb.start('family');
    tb.t.cardId = 'tabeta';
    expect(tb.view('p1').card!.cue).toBeUndefined();
    tb.greetAll();
    expect(tb.view('p1').me!.hand.some((x) => x.dict)).toBe(false);
  });
});

/** Turns the current turn's card into a verb card, with fresh hands from its tiles. */
function verbTurn(tb: Table, cardId: string) {
  const card = introCardOf(cardId)!;
  tb.t.cardId = cardId;
  Object.keys(tb.t.hands).forEach((pid, i) => (tb.t.hands[pid] = card.tiles.slice(i * 4, i * 4 + 4).map((x) => x.id)));
}

// ---- a turn ----

describe('Nice to Meet You!: a turn', () => {
  it('runs greet → write → introduce → rank → the truth, and pays the lies above the truth', () => {
    const tb = new Table(4);
    tb.start();
    expect(tb.t.guestId).toBe('p1');
    expect(tb.t.introducerId).toBe('p4');
    expect(Object.values(tb.t.roles).filter((r) => r === 'tanuki').length).toBe(3);
    tb.greetAll();
    tb.writeAll();
    expect(tb.t.facts.length).toBe(4);
    tb.readAll();

    const truth = tb.truth().id;
    const [l2, l3, l4] = [tb.lieOf('p2').id, tb.lieOf('p3').id, tb.lieOf('p4').id];
    // Each ranker leaves their own lie off.
    expect(tb.view('p2').me!.rankable.map((x) => x.id)).not.toContain(l2);
    expect(tb.play('p2', { kind: 'rank', order: [l3, truth, l4] }).error).toBeUndefined();
    expect(tb.play('p3', { kind: 'rank', order: [truth, l4, l2] }).error).toBeUndefined();
    expect(tb.play('p4', { kind: 'rank', order: [l2, l3, truth] }).error).toBeUndefined();
    expect(tb.play('p2', { kind: 'rank', order: [l2, l3, truth] }).error).toBe('bad-move');
    expect(tb.play('p1', { kind: 'wish', factId: l2 }).error).toBeUndefined();
    expect(tb.s.phase).toBe('score');

    const r = tb.t.result!;
    const sum = (id: string) => (r.points[id] ?? []).reduce((a, x) => a + x.pts, 0);
    expect(r.found).toBe(1);
    expect(r.topLie).toBe(l3);
    expect(r.order[0]).toBe(l3);
    expect(sum('p1')).toBe(POINTS.guest);
    expect(sum('p2')).toBe(POINTS.rank[1]! + POINTS.fooled + POINTS.wish);
    expect(sum('p3')).toBe(POINTS.rank[0]! + 2 * POINTS.fooled + POINTS.topLie);
    expect(sum('p4')).toBe(POINTS.rank[2]!);

    const before = ['p1', 'p2', 'p3', 'p4'].map((id) => tb.score(id));
    tb.timeout();
    expect(tb.s.phase).toBe('prompt');
    expect(['p1', 'p2', 'p3', 'p4'].map((id, i) => tb.score(id) - before[i]!)).toEqual(['p1', 'p2', 'p3', 'p4'].map(sum));
    // The next guest is introduced by this one.
    expect(tb.t.guestId).toBe('p2');
    expect(tb.t.introducerId).toBe('p1');
  });

  it('a guest everyone knows (or nobody knows) gets nothing for it', () => {
    const tb = new Table(4);
    tb.start();
    tb.greetAll();
    tb.writeAll();
    tb.readAll();
    for (const pid of ['p2', 'p3', 'p4']) {
      const ids = tb.view(pid).me!.rankable.map((x) => x.id);
      const order = [tb.truth().id, ...ids.filter((id) => id !== tb.truth().id)];
      tb.play(pid, { kind: 'rank', order });
    }
    tb.play('p1', { kind: 'wish', factId: tb.lieOf('p2').id });
    expect(tb.t.result!.found).toBe(3);
    expect(tb.t.result!.points['p1']).toBeUndefined();
  });

  it('shows a card on the TV only once its line is read, and Pon reads a line nobody did', () => {
    const tb = new Table(4);
    tb.start();
    tb.greetAll();
    tb.writeAll();
    const v = tb.view();
    expect(v.facts.every((f) => f.word === null)).toBe(true);
    const intro = tb.t.introducerId!;
    const script = tb.view(intro).me!.script!;
    expect(script[0]!.text).toContain('こちらは');
    expect(script.at(-1)!.kind).toBe('close');
    // The opening line, then the first card read out loud.
    tb.play(intro, { kind: 'read', utterance: speech(script[0]!.text) });
    const s0 = tb.score(intro);
    tb.play(intro, { kind: 'read', utterance: speech(script[1]!.text) });
    expect(tb.score(intro)).toBeGreaterThan(s0);
    const shown = tb.view().facts.filter((f) => f.word !== null);
    expect(shown.length).toBe(1);
    expect(shown[0]!.read).toBe('said');
    // Help: Pon reads it, and the reader gets nothing for that line.
    const s1 = tb.score(intro);
    tb.play(intro, { kind: 'read', pon: true });
    expect(tb.score(intro)).toBe(s1);
    expect(tb.view().facts.filter((f) => f.read === 'pon').length).toBe(1);
    // Silence: after the line's time, Pon reads it too.
    tb.now = tb.t.lineAt + LINE_MS;
    tb.act({ type: 'wake', phaseSeq: tb.s.phaseSeq });
    expect(tb.view().facts.filter((f) => f.read === 'pon').length).toBe(2);
    expect(tb.s.cues.some((c) => c.event === 'hajime_read')).toBe(true);
    // Only the introducer reads.
    expect(tb.play('p2', { kind: 'read', pon: true }).error).toBe('not-yours');
  });

  it('lets the guest veto a lie before it is read, swapping in one of Pon’s', () => {
    const tb = new Table(4);
    tb.start();
    tb.greetAll();
    tb.writeAll();
    const lines = tb.t.lines;
    const lie = tb.t.facts.find((f) => f.kind === 'lie' && lines.findIndex((l) => l.factId === f.id) > 1)!;
    const author = lie.authors[0]!;
    expect(tb.play('p1', { kind: 'veto', factId: tb.truth().id }).error).toBe('unknown-card');
    expect(tb.play('p2', { kind: 'veto', factId: lie.id }).error).toBe('not-yours');
    expect(tb.play('p1', { kind: 'veto', factId: lie.id }).error).toBeUndefined();
    const now = tb.t.facts.find((f) => f.id === lie.id)!;
    expect(now.kind).toBe('pon');
    expect(now.authors).not.toContain(author);
    expect(tb.t.facts.length).toBe(4);
  });

  it('counts a lie that matches the truth as しってた！', () => {
    const tb = new Table(4);
    tb.start();
    tb.greetAll();
    const hand = tb.t.hands['p2']!;
    tb.play('p1', { kind: 'write', tileId: hand[0] });
    tb.play('p2', { kind: 'write', tileId: hand[0] });
    tb.play('p3', { kind: 'write', tileId: tb.t.hands['p3']![0] });
    tb.play('p4', { kind: 'write', tileId: tb.t.hands['p4']![0] });
    expect(tb.s.phase).toBe('reveal');
    expect(tb.t.knew).toEqual(['p2']);
    // Short a lie: Pon fills in, so there are still four cards.
    expect(tb.t.facts.length).toBe(4);
    expect(tb.t.facts.filter((f) => f.kind === 'pon').length).toBe(1);
  });

  it('accepts only katakana names, and rejects typed lies in Kids rooms', () => {
    const tb = new Table(4);
    tb.start('kids');
    expect(tb.play('p1', { kind: 'name', text: 'Aki' }).error).toBe('not-katakana');
    expect(tb.play('p1', { kind: 'name', text: 'あき' }).error).toBeUndefined();
    expect(tb.st.kana['p1']).toBe('アキ');
    expect(tb.play('p2', { kind: 'name', text: 'ラディ' }).error).toBe('wrong-phase');
    tb.greetAll();
    expect(tb.play('p2', { kind: 'write', utterance: { via: 'typed', text: 'おでん' } }).error).toBe('tiles-only');
    expect(tb.play('p2', { kind: 'write', tileId: tb.t.hands['p3']![0] }).error).toBe('bad-tile');
  });

  it('plays a 3-player game through the finale to the recap', () => {
    const tb = new Table(3);
    tb.start();
    for (let turn = 0; turn < 3; turn++) {
      expect(tb.s.phase).toBe('prompt');
      tb.greetAll();
      tb.writeAll();
      tb.readAll();
      for (const p of tb.s.players) if (p.id !== tb.t.guestId) tb.play(p.id, { kind: 'rank', order: tb.view(p.id).me!.rankable.map((x) => x.id) });
      tb.play(tb.t.guestId, { kind: 'wish', factId: tb.view(tb.t.guestId).me!.wishable[0]!.id });
      expect(tb.s.phase).toBe('score');
      tb.timeout();
    }
    expect(tb.s.phase).toBe('finale');
    // Each player recalls the other two guests' truths.
    for (const p of tb.s.players) {
      for (const item of tb.view(p.id).me!.recall) {
        const past = tb.st.past[item.turn]!;
        const word = past.facts.find((f) => f.id === past.truthId)!.word;
        expect(tb.play(p.id, { kind: 'recall', turn: item.turn, utterance: speech(item.frame.replace('＿', word)) }).error).toBeUndefined();
      }
    }
    expect(tb.s.phase).not.toBe('finale');
    while (tb.s.phase !== 'recap' && tb.s.phase !== 'lobby') tb.timeout();
    expect(tb.s.phase).toBe('recap');
    expect(tb.s.recap!.awards.length).toBeGreaterThan(0);
  });

  it('みじかめ plays only four guests', () => {
    const tb = new Table(6);
    tb.start('family', { short: true });
    expect(tb.st.guests.length).toBe(4);
  });
});

// ---- bots ----

describe('Nice to Meet You!: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      reader,
      durations: { intro: 20, prompt: 600, answer: 1_500, reveal: 3_000, encore: 1_000, score: 300, finale: 1_000 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const [players, green] of [[3, false], [5, false], [4, true]] as const) {
    it(`${players} bots play every turn with every client in sync${green ? ' (Green Car)' : ''}`, async () => {
      const { baseUrl, truth, server } = ctx;
      const created = await createRoom(baseUrl);
      const room = server.rooms.get(created.code)!;
      const seen = new Map<string, { v: number; hash: string }[]>();
      const record = (id: string, view: RoomView, v: number) => {
        let list = seen.get(id);
        if (!list) seen.set(id, (list = []));
        list.push({ v, hash: hashView(view) });
      };
      let finished = false;
      let recap: RoomView['recap'] = null;
      const phases = new Set<string>();
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 1,
        totalRounds: 1_000,
        mode: 'hajimemashite',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = hajimemashitePolicy({ thinkMs: 40, quiet: (id) => id.endsWith('2') });
      const bots: Bot[] = [];
      for (let i = 1; i <= players; i++) {
        bots.push(
          await Bot.join({
            baseUrl,
            code: created.code,
            name: `bot${i}`,
            policy,
            level: green ? (i % 2 ? 'n3' : 'n4') : i === 1 ? 'kana' : i === 3 ? 'n4' : 'n5',
            onState: (bot, view, v) => record(bot.playerId, view, v),
          }),
        );
      }
      await until(() => finished, 90_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['intro', 'prompt', 'answer', 'reveal', 'encore', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);

      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      expect(standings.reduce((n, s) => n + s.score, 0)).toBeGreaterThan(0);
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);

      for (const b of bots) b.stop();
      director.client.close();
    }, 120_000);
  }
});

// ---- the Green Car ----

const GREEN_FRAMES = ['ta-koto', 'te-miru', 'koto-ni-shiteiru', 'furi', 'hazu-datta'];
const greenState = (gcSaid: Record<string, Record<string, number>> = {}, usedCards: string[] = []) => ({ usedCards, gcSaid }) as unknown as HajimeState;

describe('Nice to Meet You!: the Green Car experience deck', () => {
  it('the N3 cards are draft, carry an N3 frame id, and every line (first, third, each tile, Pon) says that frame', () => {
    const n3 = INTRO_CARDS.filter((c) => c.level === 'n3');
    expect(n3.length).toBeGreaterThanOrEqual(6);
    for (const c of n3) {
      expect(c.status, c.id).toBe('draft');
      expect(c.frames!.length, c.id).toBe(1);
      expect(FRAME_BY_ID[c.frames![0] as FrameId]?.level, c.id).toBe('n3');
      for (const x of [...c.tiles, c.pon]) {
        for (const line of [fillFrame(c.first, x.kana), fillFrame(c.third, x.kana, 'アキ')]) {
          expect(framesOf({ text: line, kana: line }, undefined, { keepHidden: true }), `${c.id}: ${line}`).toContain(c.frames![0]);
        }
      }
    }
  });

  it('in the Green Car the deck is only experience cards, and every experience frame plays in every audience', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      for (const l of ['n4', 'n3'] as const) {
        const deck = cardsFor(a, l, true);
        expect(deck.every(greenCarCard), `${a} ${l}`).toBe(true);
        expect(deck.some((c) => c.level === 'n5'), `${a} ${l}`).toBe(false);
        expect(deck.every((c) => c.audiences.includes(a)), `${a} ${l}`).toBe(true);
        expect(new Set(deck.map((c) => greenFrameOf(c))), `${a} ${l}`).toEqual(new Set(GREEN_FRAMES));
      }
    }
    // Cheeky's own card stays out of Kids rooms, and Kids' out of Cheeky.
    expect(cardsFor('kids', 'n3', true).map((c) => c.id)).not.toContain('date-hazu');
    expect(cardsFor('cheeky', 'n3', true).map((c) => c.id)).not.toContain('kids-rule');
  });

  it('N3 cards never play outside the Green Car, at any level', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) for (const l of ['kana', 'n5', 'n4', 'n3'] as const) expect(cardsFor(a, l).some((c) => c.level === 'n3'), `${a} ${l}`).toBe(false);
  });

  it('aims the deal: an N4 guest gets N4 experience cards; an N3 guest the level, then the frame, said least tonight', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = mulberry(seed);
      // N4: the N4 experience cards, never N3 while one is fresh.
      const n4 = pickGreenCard(greenState(), 'family', 'p1', 'n4', r);
      expect(n4.level, `seed ${seed}`).toBe('n4');
      expect(GREEN_CAR_N4_FRAMES, `seed ${seed}`).toContain(greenFrameOf(n4));
      // N3 with nothing said: N3 first (ties go to N3).
      expect(pickGreenCard(greenState(), 'family', 'p1', 'n3', r).level, `seed ${seed}`).toBe('n3');
      // N3 having said more N3 than N4: an N4 card.
      expect(pickGreenCard(greenState({ p1: { furi: 2, 'ta-koto': 1 } }), 'family', 'p1', 'n3', r).level, `seed ${seed}`).toBe('n4');
      // Within N3: the frame said least (furi and hazu-datta said, so ことに して いる).
      expect(greenFrameOf(pickGreenCard(greenState({ p1: { furi: 1, 'hazu-datta': 1, 'ta-koto': 1, 'te-miru': 1 } }), 'family', 'p1', 'n3', r)), `seed ${seed}`).toBe('koto-ni-shiteiru');
      // Within N4: ＿て みる said, so ＿た ことが ある.
      expect(greenFrameOf(pickGreenCard(greenState({ p1: { 'te-miru': 1 } }), 'family', 'p1', 'n4', r)), `seed ${seed}`).toBe('ta-koto');
      // The room's own card first: a Kids N3 guest with nothing said gets a Kids-only N3 card.
      expect(pickGreenCard(greenState(), 'kids', 'p1', 'n3', r).audiences, `seed ${seed}`).toEqual(['kids']);
    }
    // An N4 guest once the N4 experience cards are used up: an N3 card, as a stretch.
    const usedN4 = cardsFor('family', 'n4', true).filter((c) => c.level === 'n4').map((c) => c.id);
    expect(pickGreenCard(greenState({}, usedN4), 'family', 'p1', 'n4', mulberry(3)).level).toBe('n3');
  });

  it('an all-N4+ room plays the experience deck; a mixed room, or the Green Car switched off, never gets an N3 card', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const green = new Table(4, ['n3', 'n4', 'n3', 'n4'], seed);
      green.start('family');
      expect(green.s.greenCarOn, `seed ${seed}`).toBe(true);
      expect(greenCarCard(introCardOf(green.t.cardId)!), `seed ${seed}`).toBe(true);
      expect(introCardOf(green.t.cardId)!.level, `seed ${seed}`).toBe('n3');
      expect(green.view('p1').card!.level).toBe('n3');

      const mixed = new Table(4, ['n4', 'n5', 'n3', 'kana'], seed);
      mixed.start('family');
      expect(mixed.s.greenCarOn).toBe(false);
      expect(introCardOf(mixed.t.cardId)!.level, `seed ${seed}`).not.toBe('n3');

      const off = new Table(4, ['n3', 'n4', 'n3', 'n4'], seed);
      off.cmd('stage', { type: 'settings', greenCar: false });
      off.start('family');
      expect(off.s.greenCarOn).toBe(false);
      expect(introCardOf(off.t.cardId)!.level, `seed ${seed}`).toBe('n4');
    }
  });

  it('counts the experience frame said by the guest and by the introducer, for the next deal', () => {
    const tb = new Table(4, ['n3', 'n4', 'n4', 'n4']);
    tb.start('family');
    const card = introCardOf(tb.t.cardId)!;
    const frame = greenFrameOf(card)!;
    const intro = tb.t.introducerId!;
    const g = tb.t.guestId;
    tb.greetAll();
    const truth = tb.writeAll();
    tb.readAll();
    for (const p of tb.s.players) if (p.id !== g) tb.play(p.id, { kind: 'rank', order: tb.view(p.id).me!.rankable.map((x) => x.id) });
    tb.play(g, { kind: 'wish', factId: tb.view(g).me!.wishable[0]!.id });
    expect(tb.s.phase).toBe('score');
    expect(tb.play(g, { kind: 'truth', utterance: speech(fillFrame(card.first, truth)) }).error).toBeUndefined();
    while (tb.st.turnIndex === 1 && tb.s.phase !== 'finale') tb.timeout();
    expect(tb.st.gcSaid?.[g]?.[frame]).toBe(1);
    expect(tb.st.gcSaid?.[intro]?.[frame]).toBe(1);
  });

  it('a mixed room keeps no Green Car count', () => {
    const tb = new Table(4, ['n4', 'n5', 'n5', 'n5']);
    tb.start('family');
    tb.greetAll();
    tb.writeAll();
    tb.readAll();
    while (tb.st.turnIndex === 1 && tb.s.phase !== 'finale') tb.timeout();
    expect(tb.st.gcSaid).toBeUndefined();
  });
});

describe('Nice to Meet You!: a Kids room in the Green Car says its lines, as tiles only', () => {
  function kidsGreen(): Table {
    const tb = new Table(4, ['n3', 'n4', 'n4', 'n3']);
    tb.start('kids');
    expect(tb.s.greenCarOn).toBe(true);
    tb.greetAll();
    return tb;
  }

  it('every role may say (or type) its line, and only a tile it may use reaches the TV, never free text', () => {
    const tb = kidsGreen();
    const card = introCardOf(tb.t.cardId)!;
    const g = tb.t.guestId;
    expect(tb.view(g).me!.sayTiles).toBe(true);
    expect(tb.view(g).me!.canType).toBe(false);
    const [tanuki, hand] = Object.entries(tb.t.hands)[0]!;
    const held = new Set(Object.values(tb.t.hands).flat());
    const truth = card.tiles.find((x) => !held.has(x.id))!;
    // The guest says the whole line: the tile, as the card prints it.
    expect(tb.play(g, { kind: 'write', utterance: speech(fillFrame(card.first, truth.kana)) }).error).toBeUndefined();
    expect(tb.t.writes[g]).toEqual({ tileId: truth.id, word: truth.kana, en: truth.en });
    // Said with the frame: logged as the frame filled with the tile, from memory.
    expect(tb.s.phrasebook[g]!.find((e) => e.itemId === `hajime:${card.id}:said`)).toMatchObject({ text: fillFrame(card.first, truth.kana), outcome: 'said', recall: 'memory' });
    // Free text: refused, and the card stays as it was.
    expect(tb.play(g, { kind: 'write', utterance: speech('うちゅうじんと ともだちに なりました') }).error).toBe('tiles-only');
    expect(tb.play(g, { kind: 'write', utterance: { via: 'typed', text: 'うんこ' } }).error).toBe('tiles-only');
    expect(tb.t.writes[g]!.tileId).toBe(truth.id);
    // A tanuki: only their hand. A tile they don't hold is refused; one they hold (typed, too) counts.
    const notMine = card.tiles.find((x) => !hand!.includes(x.id))!;
    expect(tb.play(tanuki, { kind: 'write', utterance: speech(fillFrame(card.first, notMine.kana)) }).error).toBe('tiles-only');
    const mine = tileOf(hand![0]!)!;
    expect(tb.play(tanuki, { kind: 'write', utterance: { via: 'typed', text: mine.kana } }).error).toBeUndefined();
    expect(tb.t.writes[tanuki]).toEqual({ tileId: mine.id, word: mine.kana, en: mine.en });
    // Tapping still works.
    expect(tb.play(tanuki, { kind: 'write', tileId: hand![1] }).error).toBeUndefined();
  });

  it('a Kids room outside the Green Car keeps its tiles-only tanuki and no saying', () => {
    const tb = new Table(4, ['n4', 'n5', 'n5', 'n5']);
    tb.start('kids');
    tb.greetAll();
    const [tanuki] = Object.entries(tb.t.hands)[0]!;
    expect(tb.view(tanuki).me!.sayTiles).toBeUndefined();
    expect(tb.play(tanuki, { kind: 'write', utterance: speech('すし') }).error).toBe('tiles-only');
  });

  it('a Family room in the Green Car still types its own words', () => {
    const tb = new Table(4, ['n3', 'n4', 'n4', 'n3']);
    tb.start('family');
    tb.greetAll();
    expect(tb.view('p1').me!.sayTiles).toBeUndefined();
    expect(tb.view('p1').me!.canType).toBe(true);
  });
});
