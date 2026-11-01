// Last Train content: the minigames (Phase 1 first) and the scenarios.

import type { LastTrainMinigame, LastTrainScenario } from '../types.js';
import { konbiniMath } from './konbini-math.js';
import { meetTheInnkeeper } from './meet-the-innkeeper.js';
import { stationAnnouncement } from './station-announcement.js';
import { whatTime } from './what-time.js';
import { orderUp } from './order-up.js';
import { counterChaos } from './counter-chaos.js';
import { particlePanic } from './particle-panic.js';
import { calendarCrunch } from './calendar-crunch.js';
import { readTheSigns } from './read-the-signs.js';
import { lostAndFound } from './lost-and-found.js';
import { lastTrainScenarios as scenarios } from './scenarios.js';

export const lastTrainMinigames: LastTrainMinigame[] = [
  konbiniMath,
  meetTheInnkeeper,
  stationAnnouncement,
  whatTime,
  orderUp,
  counterChaos,
  particlePanic,
  calendarCrunch,
  readTheSigns,
  lostAndFound,
];

export const lastTrainScenarios: LastTrainScenario[] = scenarios;
