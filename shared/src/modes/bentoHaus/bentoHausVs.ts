// Bento Haus VS (おべんとうハウス VS): two kitchens, あかチーム and あおチーム, race for the same yōkai
// customers. See docs/modes/bento-haus.md.
//
// Each team is a whole Co-op kitchen (bentoHaus.ts): its own order-taker, its own shelves spread
// across its own phones, its own tickets and box. Every customer phones both kitchens at once with the
// same order, so the two order-takers hear the same words. The first team to serve gets the
// customer's tips (3 for a perfect box, 2 with one thing off, 1 if it's at least food, doubled for a
// rush order); the other team's box goes as a わけあり (slightly off) bento for 1 tip if it has
// anything in it, so the effort is never wasted. A box can't be served empty.
//
// Teams are dealt by level (each gets a similar mix of Kana, N5 and N4) and kept for the game; anyone
// who joins later goes to the smaller team. Each tip is worth the same points as in Co-op, paid to
// every player in that kitchen, so the team with the most tips is on top of the recap.
//
// Not built yet: the customer role for 5 or 7 players (one player reads the order to both kitchens),
// and the character-bento round. With an odd number the teams are one apart.

import { moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import {
  ajimiView,
  AJIMI_MS,
  ARRIVE_GAP_MS,
  blankStats,
  counterSlots,
  cue,
  DURATIONS,
  feedView,
  FIRST_ARRIVAL_MS,
  giveUp,
  kitchenMove,
  lastOrderAt,
  LINGER_MS,
  makeOrder,
  meView,
  menuSize,
  nextTaker,
  ownCounter,
  patienceFor,
  payRound,
  pickCustomer,
  planArrival,
  ROUND_INFO,
  serve,
  serveBonus,
  setupRound,
  SHIFT_MS,
  shiftDone,
  shopAwards,
  TIPS,
  TOTAL_ROUNDS,
  visitsView,
  waiting,
  type BentoView,
  type PlayerStats,
  type Round,
  type Visit,
  type VsTeamView,
} from './bentoHaus.js';
import { FOODS } from './menu.js';

export const TEAMS = [
  { ja: 'あかチーム', en: 'Red team' },
  { ja: 'あおチーム', en: 'Blue team' },
] as const;

export interface VsTeam {
  id: number;
  members: string[];
  takerTurn: number;
  /** Tips from the shifts before this one. */
  banked: number;
  wins: number;
}

export interface VsState {
  round: number;
  totalRounds: number;
  teams: VsTeam[];
  /** This round's kitchens, one per team, in team order. kitchens[0] keeps the shift's clock. */
  kitchens: Round[];
  stats: Record<string, PlayerStats>;
  usedCustomers: string[];
  lastCueAt: number;
  /** The last shift's winner (a team id), or null for a tie. */
  winner: number | null;
}

const LEVEL_RANK = { kana: 0, n5: 1, n4: 2 } as const;

/** Deals players into two teams with a similar mix of levels: strongest first, snaking A B B A A B B A. */
export function dealTeams(players: readonly ModePlayer[], random: () => number): string[][] {
  const order = shuffled(players, random).sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
  const teams: string[][] = [[], []];
  order.forEach((p, i) => teams[i % 4 === 0 || i % 4 === 3 ? 0 : 1]!.push(p.id));
  return teams;
}

const teamOf = (s: VsState, playerId: string): VsTeam | undefined => s.teams.find((t) => t.members.includes(playerId));
const membersOf = (t: VsTeam, ctx: ModeContext): ModePlayer[] => ctx.players().filter((p) => t.members.includes(p.id));
/** Seats at the counter: as many as the smaller kitchen could handle in Co-op. */
const seatsFor = (s: VsState, ctx: ModeContext): number => counterSlots(s.round, Math.max(1, Math.min(...s.teams.map((t) => membersOf(t, ctx).length))));
const clock = (s: VsState): Round | undefined => s.kitchens[0];
/** A VS box can't be served empty: that would only hand the other kitchen the customer. */
const servable = (v: Visit): boolean => Object.values(v.box).some((n) => n > 0);

/** A new customer phones both kitchens with the same order. */
function arrive(s: VsState, at: number, ctx: ModeContext): void {
  const lead = clock(s);
  if (!lead) return;
  const customer = pickCustomer(s, lead, ctx);
  const takers = s.teams.map((t, i) => {
    const ps = membersOf(t, ctx);
    return ps.length ? nextTaker(t, s.kitchens[i]!, ps) : null;
  });
  // One order for both: a Kana order-taker on either side gets a Kana order.
  const level = takers.some((p) => p?.level === 'kana') ? 'kana' : (takers.find((p) => p)?.level ?? 'n5');
  const order = makeOrder(s.round, lead.menu, customer, level, ctx.random);
  const patience = patienceFor(order.lines, order.rush, Math.min(...s.teams.map((t) => membersOf(t, ctx).length)));
  const id = ctx.newId();
  s.kitchens.forEach((k, i) => {
    k.visits.push({
      id,
      customerId: customer.id,
      takerId: takers[i]?.id ?? '',
      lines: order.lines.map((l) => ({ ...l })),
      text: order.text,
      en: order.en,
      rush: order.rush,
      arriveAt: at,
      leaveAt: at + patience,
      box: {},
      state: 'waiting',
      endedAt: null,
      tips: 0,
      reaction: null,
      baked: null,
    });
    k.maxTips += TIPS.perfect * (order.rush ? 2 : 1);
  });
  const names = takers.filter((p): p is ModePlayer => !!p).map((p) => p.name);
  if (names.length) cue(s, ctx, 'bento_customer', { name: names.join('さんと '), name_en: names.join(' and ') });
}

/** The other kitchen lost the customer: its box goes as a わけあり bento if it has anything in it. */
function lose(r: Round, v: Visit, at: number): void {
  const any = Object.values(v.box).some((n) => n > 0);
  v.state = 'left';
  v.endedAt = at;
  v.tips = any ? TIPS.wakeari : 0;
  v.reaction = any ? { text: 'こっちも もらって いきます！', en: "I'll take this one too!" } : null;
  r.tips += v.tips;
  for (const t of r.tickets) if (t.visitId === v.id && t.state === 'open') t.state = 'void';
}

/** Runs the shift's clock: customers who gave up leave both kitchens, and new ones come in. */
function runClock(s: VsState, now: number, ctx: ModeContext): void {
  const lead = clock(s);
  if (!lead) return;
  for (let guard = 0; guard < 64; guard++) {
    const due = waiting(lead)
      .filter((v) => v.leaveAt <= now)
      .sort((a, b) => a.leaveAt - b.leaveAt)[0];
    const arrival = lead.nextArriveAt !== null && lead.nextArriveAt <= now ? lead.nextArriveAt : null;
    if (due && (arrival === null || due.leaveAt <= arrival)) {
      for (const k of s.kitchens) {
        const v = k.visits.find((x) => x.id === due.id);
        if (v?.state === 'waiting') giveUp(s, k, v, due.leaveAt, ctx, true);
      }
      cue(s, ctx, 'bento_leave');
      planArrival(lead, due.leaveAt, seatsPlayers(s, ctx));
    } else if (arrival !== null) {
      lead.nextArriveAt = null;
      arrive(s, arrival, ctx);
      if (waiting(lead).length < seatsFor(s, ctx) && arrival + ARRIVE_GAP_MS * 2 < lastOrderAt(lead)) lead.nextArriveAt = arrival + ARRIVE_GAP_MS * 2;
    } else return;
  }
}

/** planArrival counts seats from a player count: the smaller kitchen's. */
const seatsPlayers = (s: VsState, ctx: ModeContext): number => Math.max(1, Math.min(...s.teams.map((t) => membersOf(t, ctx).length)));

function teamView(s: VsState, t: VsTeam, scoring: boolean, ctx: ModeContext): VsTeamView {
  const k = s.kitchens[t.id] ?? null;
  return {
    id: t.id,
    ja: TEAMS[t.id]!.ja,
    en: TEAMS[t.id]!.en,
    members: membersOf(t, ctx).map((p) => p.id),
    tips: k?.tips ?? 0,
    total: t.banked + (k?.tips ?? 0),
    wins: t.wins,
    visits: visitsView(k, scoring, ctx),
    feed: feedView(k),
    ajimi: ajimiView(k, ctx),
  };
}

export const bentoHausVsMode: Mode<VsState, BentoView> = {
  info: {
    id: 'bento-haus-vs',
    title: 'Bento Haus VS',
    titleJa: 'おべんとうハウス VS',
    blurb: 'Two kitchens race for the same yōkai customers. Call the orders out in Japanese and serve first.',
    host: 'pon',
    minPlayers: 4,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Kitchen calls',
    phaseLabels: { prompt: 'Next shift', answer: 'Open!', score: 'Closing time' },
  },

  setup(ctx) {
    const stats: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) stats[p.id] = blankStats();
    const dealt = dealTeams(ctx.players(), ctx.random);
    return {
      round: 0,
      totalRounds: TOTAL_ROUNDS,
      teams: dealt.map((members, id) => ({ id, members, takerTurn: 0, banked: 0, wins: 0 })),
      kitchens: [],
      stats,
      usedCustomers: [],
      lastCueAt: -Infinity,
      winner: null,
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    if (phase === 'intro') {
      ctx.cue({ host: 'pon', event: 'bento_vs_intro', waitMs: 4_000 });
      return;
    }
    if (phase === 'prompt') {
      for (const t of s.teams) t.banked += s.kitchens[t.id]?.tips ?? 0;
      s.round += 1;
      s.winner = null;
      // Anyone who joined since goes to the smaller team.
      for (const p of ctx.players())
        if (!teamOf(s, p.id)) {
          const smaller = [...s.teams].sort((a, b) => membersOf(a, ctx).length - membersOf(b, ctx).length || a.id - b.id)[0]!;
          smaller.members.push(p.id);
          s.stats[p.id] ??= blankStats();
        }
      // The same menu in both kitchens, enough for the bigger team's shelves.
      const menu = shuffled(
        FOODS.map((f) => f.id),
        ctx.random,
      ).slice(0, menuSize(Math.max(...s.teams.map((t) => membersOf(t, ctx).length))));
      s.kitchens = s.teams.map((t) => setupRound(s, ctx, membersOf(t, ctx), menu));
      ctx.cue({ host: 'pon', event: 'bento_round', slots: { round: ROUND_INFO[s.round - 1]!.ja } });
      return;
    }
    const lead = clock(s);
    if (!lead) return;
    if (phase === 'answer' && !lead.started) {
      const end = ctx.now + (SHIFT_MS[s.round - 1] ?? SHIFT_MS[0]);
      for (const k of s.kitchens) {
        k.started = true;
        k.shiftStart = ctx.now;
        k.shiftEnd = end;
      }
      lead.nextArriveAt = ctx.now + FIRST_ARRIVAL_MS;
    }
    if (phase === 'score') {
      s.teams.forEach((t) => payRound(s.kitchens[t.id]!, ctx, membersOf(t, ctx)));
      const [a, b] = s.kitchens.map((k) => k.tips);
      s.winner = a === b ? null : a! > b! ? 0 : 1;
      if (s.winner === null) cue(s, ctx, 'bento_vs_tie', undefined, true);
      else {
        s.teams[s.winner]!.wins += 1;
        cue(s, ctx, 'bento_vs_win', { team: TEAMS[s.winner]!.ja, team_en: TEAMS[s.winner]!.en }, true);
      }
    }
  },

  leave(s, phase, ctx) {
    const lead = clock(s);
    if (!lead || phase !== 'answer') return;
    runClock(s, ctx.now, ctx);
    // Closing time: whoever is still waiting takes their boxes as they are.
    for (const k of s.kitchens) for (const v of waiting(k)) giveUp(s, k, v, ctx.now, ctx, true);
    lead.nextArriveAt = null;
  },

  duration(s, phase) {
    const lead = clock(s);
    if (phase === 'answer') return lead?.started ? lead.shiftEnd - lead.shiftStart : (SHIFT_MS[s.round - 1] ?? SHIFT_MS[0]);
    if (phase === 'intro') return DURATIONS.intro;
    if (phase === 'prompt') return DURATIONS.prompt;
    if (phase === 'score') return DURATIONS.score;
    return 5_000;
  },

  done(s, phase, ctx) {
    const lead = clock(s);
    return phase === 'answer' && !!lead && shiftDone(lead, ctx.now);
  },

  wakeAt(s, phase, ctx) {
    const lead = clock(s);
    const now = ctx.now;
    if (phase !== 'answer' || !lead?.started) return null;
    const times = [...waiting(lead).map((v) => v.leaveAt), ...(lead.nextArriveAt !== null ? [lead.nextArriveAt] : [])];
    for (const k of s.kitchens) {
      for (const v of k.visits) if (v.endedAt !== null && v.endedAt + LINGER_MS > now) times.push(v.endedAt + LINGER_MS);
      if (k.ajimi && k.ajimi.at + AJIMI_MS > now) times.push(k.ajimi.at + AJIMI_MS);
    }
    return times.length ? Math.min(...times) : null;
  },

  wake(s, phase, ctx) {
    if (phase === 'answer') runClock(s, ctx.now, ctx);
  },

  move(s, phase, playerId, raw, ctx) {
    const lead = clock(s);
    if (!lead || phase !== 'answer' || !lead.started) return moveError('wrong-phase');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return moveError('bad-move');
    runClock(s, ctx.now, ctx);
    const team = teamOf(s, playerId);
    if (!ctx.player(playerId) || !team) return moveError('not-allowed');
    const k = s.kitchens[team.id]!;
    const m = raw as Record<string, unknown>;
    if (m.kind === 'serve') {
      const v = k.visits.find((x) => x.id === m.visitId);
      if (v && v.state !== 'waiting') return moveError('too-late');
      if (!v || v.takerId !== playerId) return moveError('bad-move');
      if (!servable(v)) return moveError('empty-box');
      serveBonus(k, playerId, m.utterance);
      serve(s, k, v, playerId, ctx);
      // First served wins the customer: the other kitchen's copy goes.
      for (const other of s.kitchens) {
        if (other === k) continue;
        const ov = other.visits.find((x) => x.id === v.id);
        if (ov?.state === 'waiting') lose(other, ov, ctx.now);
      }
      planArrival(lead, ctx.now, seatsPlayers(s, ctx));
      return MOVE_OK;
    }
    return kitchenMove(s, k, playerId, m, ctx);
  },

  release(s, playerId, ctx) {
    const team = teamOf(s, playerId);
    if (!team) return;
    team.members = team.members.filter((id) => id !== playerId);
    const k = s.kitchens[team.id];
    if (!k) return;
    const left = membersOf(team, ctx).filter((p) => p.id !== playerId);
    // Their shelf and their orders go to their teammates; a kitchen with nobody left just stops.
    let i = 0;
    for (const id of Object.keys(k.holders)) if (k.holders[id] === playerId) k.holders[id] = left.length ? left[i++ % left.length]!.id : '';
    for (const t of k.tickets) if (t.stationId === playerId && t.foodId) t.stationId = k.holders[t.foodId] || null;
    for (const v of waiting(k)) if (v.takerId === playerId) v.takerId = left.length ? left[i++ % left.length]!.id : '';
  },

  progress(s) {
    return { round: Math.max(1, s.round), totalRounds: s.totalRounds };
  },

  view(s, phase, viewer, ctx) {
    const scoring = phase === 'score';
    const info = s.round ? ROUND_INFO[s.round - 1]! : null;
    const own = ownCounter(s.round);
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const myTeam = me ? (teamOf(s, me.id)?.id ?? null) : null;
    // The phone sees its own kitchen; the TV sees the red one at the top level, and both under vs.
    const k = s.kitchens[myTeam ?? 0] ?? null;
    return {
      mode: 'bento-haus-vs',
      round: s.round,
      totalRounds: s.totalRounds,
      at: ctx.now,
      info: info ? { ...info } : null,
      shift: k?.started ? { start: k.shiftStart, end: k.shiftEnd } : null,
      ownCounter: own,
      seats: s.kitchens.length ? seatsFor(s, ctx) : 1,
      menu: k?.menu ?? [],
      tips: k?.tips ?? 0,
      maxTips: k?.maxTips ?? 0,
      stars: null,
      teamPoints: k?.teamPoints ?? 0,
      visits: visitsView(k, scoring, ctx),
      feed: feedView(k),
      ajimi: ajimiView(k, ctx),
      me: meView(k, me, own, ctx),
      vs: { myTeam, teams: s.teams.map((t) => teamView(s, t, scoring, ctx)), winner: s.winner },
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const totals = s.teams.map((t) => t.banked + (s.kitchens[t.id]?.tips ?? 0));
    if (totals[0] !== totals[1]) {
      const win = s.teams[totals[0]! > totals[1]! ? 0 : 1]!;
      const ps = membersOf(win, ctx);
      if (ps.length) out.push({ playerId: ps[0]!.id, name: ps.map((p) => p.name).join('・'), title: 'はんじょう賞', en: `Busiest Kitchen (${TEAMS[win.id]!.en}, most tips)` });
    }
    return [...out, ...shopAwards(s, ctx)];
  },
};
