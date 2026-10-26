// Fill a room with headless bots.
//
//   npm run bots -- --code BCDF                 # 7 bots join the room on the debug stage
//   npm run bots -- --bots 8 --rounds 100       # make a room, play 100 rounds, report
//   npm run bots -- --code BCDF --drop 30       # one bot loses signal for 30 s every few rounds
//
// Options: --url (default http://localhost:3000), --code, --bots, --rounds, --drop <seconds>, --fast

import { parseArgs } from 'node:util';
import { createRoom } from '../../shared/src/client.js';
import type { DebugView } from '../../shared/src/modes/debug/debug.js';
import { Bot, Director, politeScript, type BotScript } from './bot.js';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    code: { type: 'string' },
    bots: { type: 'string' },
    rounds: { type: 'string', default: '10' },
    drop: { type: 'string', default: '0' },
    fast: { type: 'boolean', default: false },
  },
});

const url = values.url!.replace(/\/$/, '');
const count = Number(values.bots ?? (values.code ? 7 : 8));
const dropSeconds = Number(values.drop);

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
    roundsPerGame: 10,
    totalRounds: Number(values.rounds),
    onDone: () => {
      console.log(`Played ${director!.roundsPlayed} rounds.`);
      for (const b of bots) b.stop();
      director!.client.close();
      const problems = bots.flatMap((b) => b.unexpected.map((u) => `${b.name}: ${u.cmd} → ${u.error}`));
      console.log(problems.length ? problems.join('\n') : 'No unexpected command errors.');
      process.exit(problems.length ? 1 : 0);
    },
    onState: (view) => {
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
    const bot = await Bot.join({ baseUrl: url, code, name, script, deviceId: `cli-${code}-${name}` });
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
