// Fill a room with headless bots.
//
//   npm run bots -- --code BCDF --bots 3        # 3 bots join your room and play whatever game the VIP picks
//   npm run bots -- --bots 8 --rounds 100       # make a room, play 100 rounds, report
//   npm run bots -- --code BCDF --drop 30       # one bot loses signal for 30 s every few rounds
//   npm run bots -- --mode oogiri --bots 5      # make a room and play one game of a real mode
//
// Options: --url (default http://localhost:3000), --code, --bots, --rounds, --drop <seconds>, --fast,
// --mode <any mode id, or debug> and --games (real modes only).
// With --code and no --mode, bots play any mode; without --code they default to the debug round.

import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadContent } from '../../server/src/content.js';
import { createRoom } from '../../shared/src/client.js';
import type { DebugView } from '../../shared/src/modes/debug/debug.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { MODE_IDS, type ModeId } from '../../shared/src/protocol.js';
import { Bot, Director, politeScript, type BotScript, type ModePolicy } from './bot.js';
import { concentrationPolicy } from './policies/concentration.js';
import { karaokeDuelPolicy } from './policies/karaokeDuel.js';
import { onsenMurderPolicy } from './policies/onsenMurder.js';
import { kanaRaidPolicy } from './policies/kanaRaid.js';
import { lastTrainPolicy } from './policies/lastTrain.js';
import { oogiriPolicy } from './policies/oogiri.js';
import { omiaiPolicy } from './policies/omiai.js';
import { phraseBingoPolicy } from './policies/phraseBingo.js';
import { wordGauntletPolicy } from './policies/wordGauntlet.js';
import { touristPolicy } from './policies/tourist.js';
import { oekakiPolicy } from './policies/oekaki.js';
import { shodoPolicy } from './policies/shodo.js';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    code: { type: 'string' },
    bots: { type: 'string' },
    rounds: { type: 'string', default: '10' },
    drop: { type: 'string', default: '0' },
    fast: { type: 'boolean', default: false },
    mode: { type: 'string' },
    games: { type: 'string', default: '1' },
  },
});

// Joining someone's room with no mode named: play whatever they start.
const anyMode = values.code !== undefined && values.mode === undefined;
const mode = (values.mode ?? 'debug') as ModeId;
if (!MODE_IDS.includes(mode)) {
  console.error(`Unknown mode ${values.mode}. Pick one of: ${MODE_IDS.join(', ')}.`);
  process.exit(1);
}
const realMode = mode !== 'debug' || anyMode;

const url = values.url!.replace(/\/$/, '');
const count = Number(values.bots ?? (values.code ? 7 : 8));
const dropSeconds = Number(values.drop);

let sharedPhraseBingo: ModePolicy | undefined;

/** A fresh policy per bot, so each keeps its own memory (Concentration remembers cards). */
function policyFor(seat: number, id: ModeId = mode): ModePolicy | undefined {
  const content = () => loadContent(fileURLToPath(new URL('../../', import.meta.url)));
  switch (id) {
    case 'oogiri':
      return oogiriPolicy();
    case 'last-train':
      return lastTrainPolicy({ content: content(), seed: seat });
    case 'kana-raid':
      return kanaRaidPolicy();
    case 'word-gauntlet':
      return wordGauntletPolicy(content());
    case 'onsen-murder':
      return onsenMurderPolicy();
    case 'concentration':
      return concentrationPolicy();
    case 'phrase-bingo':
      // One shared policy: audience bots "hear" what the actor bots say.
      return (sharedPhraseBingo ??= phraseBingoPolicy());
    case 'karaoke-duel':
      return karaokeDuelPolicy({ seed: seat });
    case 'tourist':
      return touristPolicy({ seed: seat });
    case 'oekaki':
      return oekakiPolicy({ seed: seat });
    case 'omiai':
      return omiaiPolicy();
    case 'shodo':
      return shodoPolicy({ content: content(), seed: seat });
    default:
      return undefined;
  }
}

/** Plays whichever mode the room is in, with one policy per mode made on first use. */
function anyModePolicy(seat: number): ModePolicy {
  const policies = new Map<ModeId, ModePolicy | undefined>();
  return {
    act(view, playerId) {
      const id = view.game?.mode;
      if (!id) return [];
      if (!policies.has(id)) policies.set(id, policyFor(seat, id));
      return policies.get(id)?.act(view, playerId) ?? [];
    },
  };
}

const script: BotScript = {
  ...politeScript,
  delayMs: values.fast ? (turn, seat) => (turn * 13 + seat * 29) % 30 : politeScript.delayMs,
  // The last seat loses signal in every fourth answer phase.
  dropMs: (turn, seat) => (dropSeconds > 0 && seat === count && turn % 4 === 0 ? dropSeconds * 1000 : 0),
};

let code = values.code?.toUpperCase();
let director: Director | null = null;
if (!code) {
  const room = await createRoom(url);
  code = room.code;
  console.log(`Created room ${code}. Watch it at ${url}/stage (or join at ${room.joinUrl}).`);
  director = new Director(url, code, room.stageToken, {
    players: count,
    roundsPerGame: realMode ? (MODES[mode].info.roundChoices[0] ?? 1) : 10,
    totalRounds: realMode ? Number.MAX_SAFE_INTEGER : Number(values.rounds),
    ...(realMode ? { mode, games: Number(values.games) } : {}),
    onDone: () => {
      console.log(realMode ? `Played ${director!.gamesPlayed} game(s) of ${MODES[mode].info.title}.` : `Played ${director!.roundsPlayed} rounds.`);
      for (const b of bots) b.stop();
      director!.client.close();
      const problems = bots.flatMap((b) => b.unexpected.map((u) => `${b.name}: ${u.cmd} → ${u.error}`));
      console.log(problems.length ? problems.join('\n') : 'No unexpected command errors.');
      process.exit(problems.length ? 1 : 0);
    },
    onState: (view) => {
      if (realMode) {
        if (view.phase === 'recap' && view.recap) {
          console.log(view.recap.standings.map((p) => `${p.name} ${p.score}`).join(', '));
        }
        return;
      }
      const game = view.game as DebugView | null;
      if (view.phase === 'score' && game?.results) {
        const top = [...game.results].sort((a, b) => b.votes - a.votes)[0];
        console.log(`round ${view.round}/${view.totalRounds}: ${top ? `${top.authorName} wins with ${top.votes} votes` : 'no answers'}`);
      }
    },
  });
  director.start();
}

const bots: Bot[] = [];
for (let i = 1; i <= count; i++) {
  const name = `bot${i}`;
  try {
    const policy = anyMode ? anyModePolicy(i) : policyFor(i);
    const bot = await Bot.join({ baseUrl: url, code, name, ...(policy ? { policy } : { script }), deviceId: `cli-${code}-${name}` });
    bot.client.connect();
    bots.push(bot);
    console.log(`${name} joined ${code}`);
  } catch (err) {
    console.error(String(err));
  }
}

process.on('SIGINT', () => {
  for (const b of bots) b.stop();
  process.exit(0);
});
