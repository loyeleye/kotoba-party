// The chiptune synth that plays songs.ts: pulse and square leads, a plucked shamisen-ish voice,
// a breathy flute, music-box bells, a triangle bass and synthesised drums (kick, taiko, snare,
// hats, woodblock, chanchiki). Works on any BaseAudioContext, so tools/music can render songs
// offline to listen to them.

import { compile, type Drum, type MusicEvent, type Plan, type Song, type Voice } from './songs.js';

/** How the parts sit: everything, or thinned and muffled while players talk into their phones. */
/** full; under players' voices; listen: further down, for waves where players listen for a sound. */
export type Mix = 'full' | 'under' | 'listen';

interface Levels {
  lead: number;
  comp: number;
  bass: number;
  low: number;
  high: number;
  /** Low-pass cutoff, Hz (two filters in a row: 24 dB an octave). */
  cutoff: number;
  /** High-pass cutoff, Hz: under, it trims the boom that phone mics pick up and TV speakers can't play. */
  floor: number;
  song: number;
  /** A recording's level: it can't drop its lead, so it goes down further than a synth song. */
  track: number;
}

// "under" keeps the low end (bass, kick, taiko) and drops the lead and most of the high drums, then
// low-passes the lot, so the speech band (about 1–4 kHz) the phone mics need stays clear.
const MIXES: Record<Mix, Levels> = {
  full: { lead: 1, comp: 1, bass: 1, low: 1, high: 1, cutoff: 16_000, floor: 20, song: 1, track: 1 },
  under: { lead: 0, comp: 0.7, bass: 0.9, low: 0.8, high: 0.15, cutoff: 750, floor: 90, song: 0.7, track: 0.35 },
  listen: { lead: 0, comp: 0.4, bass: 0.7, low: 0.6, high: 0, cutoff: 500, floor: 110, song: 0.45, track: 0.18 },
};

/** Recordings are normalised to about −16 LUFS (tracks.ts gainDb), which matches the synth at this level. */
const TRACK_LEVEL = 1;

const LOW_DRUMS: ReadonlySet<Drum> = new Set(['k', 't']);

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A bus whose filters and level follow the mix: high-pass, then two low-passes, then a gain. */
class MixBus {
  readonly input: BiquadFilterNode;
  readonly out: GainNode;
  private readonly lows: BiquadFilterNode[];

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
  ) {
    const filter = (type: BiquadFilterType) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = 0.7;
      return f;
    };
    this.input = filter('highpass');
    this.lows = [filter('lowpass'), filter('lowpass')];
    this.out = ctx.createGain();
    this.input.connect(this.lows[0]!).connect(this.lows[1]!).connect(this.out).connect(dest);
  }

  /** Moves the filters to a mix; cutoffs sweep exponentially so the change sounds even. */
  filters(mix: Mix, seconds: number): void {
    const lv = MIXES[mix];
    sweep(this.ctx, this.input.frequency, lv.floor, seconds);
    for (const f of this.lows) sweep(this.ctx, f.frequency, lv.cutoff, seconds);
  }
}

function ramp(ctx: BaseAudioContext, param: AudioParam, value: number, seconds: number): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds > 0) param.linearRampToValueAtTime(value, now + seconds);
  else param.setValueAtTime(value, now);
}

function sweep(ctx: BaseAudioContext, param: AudioParam, value: number, seconds: number): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(1, param.value), now);
  if (seconds > 0) param.exponentialRampToValueAtTime(value, now + seconds);
  else param.setValueAtTime(value, now);
}

/** One song playing (or ready to play) into `out`, with its own part buses so the mix can move. */
export class SongVoice {
  readonly plan: Plan;
  readonly sixteenth: number;
  private readonly song: Song;
  private readonly bus: MixBus;
  private readonly buses: Record<'lead' | 'comp' | 'bass' | 'low' | 'high', GainNode>;

  constructor(
    private readonly ctx: BaseAudioContext,
    song: Song,
    dest: AudioNode,
    mix: Mix = 'full',
  ) {
    this.song = song;
    this.plan = compile(song);
    this.sixteenth = 60 / song.bpm / 4;
    this.bus = new MixBus(ctx, dest);
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.bus.input);
      return g;
    };
    this.buses = { lead: bus(), comp: bus(), bass: bus(), low: bus(), high: bus() };
    this.setMix(mix, 0);
  }

  get barSeconds(): number {
    return this.sixteenth * 16;
  }

  /** Moves to a mix over `seconds`. */
  setMix(mix: Mix, seconds = 0.8): void {
    const lv = MIXES[mix];
    const to = (param: AudioParam, value: number) => ramp(this.ctx, param, value, seconds);
    to(this.buses.lead.gain, lv.lead);
    to(this.buses.comp.gain, lv.comp);
    to(this.buses.bass.gain, lv.bass);
    to(this.buses.low.gain, lv.low);
    to(this.buses.high.gain, lv.high);
    this.bus.filters(mix, seconds);
    to(this.bus.out.gain, lv.song);
  }

  /** Fades out and lets go of the nodes. */
  fadeOut(seconds = 0.6): void {
    ramp(this.ctx, this.bus.out.gain, 0, seconds);
    setTimeout(() => this.bus.out.disconnect(), (seconds + 2) * 1000);
  }

  /** Lets scheduled notes ring out (a jingle's last bar), then lets go of the nodes. */
  release(): void {
    setTimeout(() => this.bus.out.disconnect(), (this.barSeconds + 2) * 1000);
  }

  /** Schedules bar `bar` (0-based within the song) to start at `at` (context seconds). */
  scheduleBar(bar: number, at: number): void {
    const swing = (this.song.swing ?? 0) * this.sixteenth * 2;
    for (const e of this.plan.byBar[bar] ?? []) {
      const inBar = e.step % 16;
      const t = at + inBar * this.sixteenth + (inBar % 4 === 2 ? swing : 0);
      const dur = e.len * this.sixteenth;
      this.play(e, t, dur);
    }
  }

  private play(e: MusicEvent, t: number, dur: number): void {
    if (e.part === 'drum') {
      const drum = e.voice as Drum;
      drumHit(this.ctx, LOW_DRUMS.has(drum) ? this.buses.low : this.buses.high, drum, t, e.vel);
      return;
    }
    const bus = this.buses[e.part];
    const gain = e.vel * PART_GAIN[e.part];
    if (gain <= 0) return;
    note(this.ctx, bus, e.voice as Voice, t, dur, hz(e.midi), gain);
  }
}

/** Decoded tracks kept in memory. A 3-minute track decodes to about 60 MB, so only the newest few stay. */
const KEEP_DECODED = 3;
const buffers = new Map<string, Promise<AudioBuffer>>();

/** Fetches and decodes a track, or returns the one already decoded. */
export function load(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let p = buffers.get(url);
  if (p) {
    // Most recently used last.
    buffers.delete(url);
  } else {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: ${r.status}`))))
      .then((data) => ctx.decodeAudioData(data));
    p.catch(() => buffers.delete(url));
  }
  buffers.set(url, p);
  // Voices that are playing hold their own buffer, so dropping it here only stops caching it.
  while (buffers.size > KEEP_DECODED) buffers.delete(buffers.keys().next().value!);
  return p;
}

export interface TrackOptions {
  url: string;
  /** Loop between these points (seconds); the whole file if missing. */
  loop?: [number, number];
  gainDb?: number;
  /** Context time to start at; as soon as it's loaded if missing or past. */
  at?: number;
}

/**
 * A recorded track looping into `out`. It can't drop its lead like a synth song, so "under"
 * filters it harder and turns it down further. Starts once the file has loaded, fading in.
 */
export class TrackVoice {
  /** True once playing, false if the file couldn't be loaded or the voice was stopped first. */
  readonly ready: Promise<boolean>;
  private readonly bus: MixBus;
  private readonly level: GainNode;
  private src: AudioBufferSourceNode | null = null;
  private stopped = false;
  private mix: Mix;

  constructor(
    private readonly ctx: BaseAudioContext,
    opts: TrackOptions,
    dest: AudioNode,
    mix: Mix = 'full',
  ) {
    this.mix = mix;
    this.bus = new MixBus(ctx, dest);
    this.level = ctx.createGain();
    this.level.gain.value = 10 ** ((opts.gainDb ?? 0) / 20);
    this.level.connect(this.bus.input);
    this.bus.filters(mix, 0);
    this.bus.out.gain.value = 0;
    this.ready = load(ctx, opts.url).then(
      (buffer) => {
        if (this.stopped) return false;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        if (opts.loop) [src.loopStart, src.loopEnd] = opts.loop;
        src.connect(this.level);
        const at = Math.max(ctx.currentTime + 0.05, opts.at ?? 0);
        src.start(at);
        this.src = src;
        // Fade in so a late-loading track doesn't cut in over the host.
        const g = this.bus.out.gain;
        g.setValueAtTime(0, at);
        g.linearRampToValueAtTime(TRACK_LEVEL * MIXES[this.mix].track, at + 0.4);
        return true;
      },
      () => false,
    );
  }

  setMix(mix: Mix, seconds = 0.8): void {
    this.mix = mix;
    this.bus.filters(mix, seconds);
    if (this.src) ramp(this.ctx, this.bus.out.gain, TRACK_LEVEL * MIXES[mix].track, seconds);
  }

  fadeOut(seconds = 1.2): void {
    this.stopped = true;
    const g = this.bus.out.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, seconds / 4);
    const src = this.src;
    setTimeout(() => {
      src?.stop();
      this.bus.out.disconnect();
    }, (seconds + 0.3) * 1000);
  }
}

const PART_GAIN = { lead: 0.16, comp: 0.18, bass: 0.26, drum: 1 } as const;

// ---- voices ----

const pulseWaves = new WeakMap<BaseAudioContext, PeriodicWave>();
/** A 25% pulse wave: the NES lead sound. */
function pulseWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = pulseWaves.get(ctx);
  if (!wave) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    wave = ctx.createPeriodicWave(real, imag);
    pulseWaves.set(ctx, wave);
  }
  return wave;
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noises.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noises.set(ctx, buf);
  }
  return buf;
}

function osc(ctx: BaseAudioContext, type: OscillatorType | 'pulse', freq: number, t: number): OscillatorNode {
  const o = ctx.createOscillator();
  if (type === 'pulse') o.setPeriodicWave(pulseWave(ctx));
  else o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

/** Attack, a dip to a sustain level, and a release at the end of the note. */
function envelope(g: AudioParam, t: number, dur: number, peak: number, attack: number, sustain: number, release: number): number {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.setTargetAtTime(peak * sustain, t + attack, 0.08);
  const end = t + Math.max(attack + 0.01, dur - release);
  g.setTargetAtTime(0, end, release / 3);
  return end + release * 2;
}

function note(ctx: BaseAudioContext, dest: AudioNode, voice: Voice, t: number, dur: number, freq: number, gain: number): void {
  const amp = ctx.createGain();
  amp.connect(dest);
  switch (voice) {
    case 'pulse':
    case 'square':
    case 'tri': {
      const o = osc(ctx, voice === 'tri' ? 'triangle' : voice, freq, t);
      const peak = voice === 'square' ? gain * 0.6 : voice === 'tri' ? gain * 1.6 : gain;
      const stop = envelope(amp.gain, t, dur, peak, 0.006, voice === 'tri' ? 0.85 : 0.6, 0.05);
      o.connect(amp);
      o.start(t);
      o.stop(stop);
      break;
    }
    case 'pluck': {
      // Shamisen-ish: a bright saw through a closing low-pass, quick decay.
      const o = osc(ctx, 'sawtooth', freq, t);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(Math.min(9000, freq * 10), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), t + 0.18);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(gain * 0.9, t + 0.003);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(0.9, 0.25 + dur));
      o.connect(lp).connect(amp);
      o.start(t);
      o.stop(t + 1);
      break;
    }
    case 'flute': {
      // Shakuhachi-ish: a sine with a slow attack and a little vibrato that grows in.
      const o = osc(ctx, 'sine', freq, t);
      const o2 = osc(ctx, 'triangle', freq * 2, t);
      const g2 = ctx.createGain();
      g2.gain.value = 0.15;
      const lfo = osc(ctx, 'sine', 5.2, t);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(0.5, dur));
      lfo.connect(depth);
      depth.connect(o.frequency);
      depth.connect(o2.frequency);
      const stop = envelope(amp.gain, t, dur, gain * 1.5, 0.07, 0.8, 0.12);
      o.connect(amp);
      o2.connect(g2).connect(amp);
      for (const x of [o, o2, lfo]) {
        x.start(t);
        x.stop(stop);
      }
      break;
    }
    case 'bell': {
      // Music box: a little FM, bright at the strike and mellowing as it rings.
      const carrier = osc(ctx, 'sine', freq, t);
      const mod = osc(ctx, 'sine', freq * 3.5, t);
      const index = ctx.createGain();
      index.gain.setValueAtTime(freq * 1.6, t);
      index.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.6);
      mod.connect(index).connect(carrier.frequency);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(gain * 1.4, t + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + 1.4);
      carrier.connect(amp);
      for (const x of [carrier, mod]) {
        x.start(t);
        x.stop(t + 1.5);
      }
      break;
    }
  }
}

function noiseBurst(ctx: BaseAudioContext, dest: AudioNode, t: number, filter: BiquadFilterType, freq: number, q: number, gain: number, decay: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0008, t + decay);
  src.connect(f).connect(amp).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
}

function thump(ctx: BaseAudioContext, dest: AudioNode, t: number, from: number, to: number, sweep: number, gain: number, decay: number): void {
  const o = osc(ctx, 'sine', from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + sweep);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0008, t + decay);
  o.connect(amp).connect(dest);
  o.start(t);
  o.stop(t + decay + 0.02);
}

function drumHit(ctx: BaseAudioContext, dest: AudioNode, drum: Drum, t: number, vel: number): void {
  switch (drum) {
    case 'k':
      thump(ctx, dest, t, 150, 48, 0.1, 0.55 * vel, 0.22);
      break;
    case 't':
      // Taiko: a deep, slower thump with a skin slap on top.
      thump(ctx, dest, t, 105, 55, 0.25, 0.6 * vel, 0.6);
      noiseBurst(ctx, dest, t, 'lowpass', 500, 0.7, 0.2 * vel, 0.08);
      break;
    case 's':
      noiseBurst(ctx, dest, t, 'bandpass', 1900, 0.8, 0.28 * vel, 0.14);
      thump(ctx, dest, t, 220, 170, 0.05, 0.12 * vel, 0.08);
      break;
    case 'h':
      noiseBurst(ctx, dest, t, 'highpass', 7500, 0.7, 0.09 * vel, 0.035);
      break;
    case 'w': {
      // Hyōshigi: two wooden clappers.
      const o = osc(ctx, 'sine', 1250, t);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.22 * vel, t);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
      o.connect(amp).connect(dest);
      o.start(t);
      o.stop(t + 0.06);
      break;
    }
    case 'g': {
      // Chanchiki: a small hand gong, two clashing metallic partials.
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.05 * vel, t);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
      hp.connect(amp).connect(dest);
      for (const f of [2380, 3410]) {
        const o = osc(ctx, 'square', f, t);
        o.connect(hp);
        o.start(t);
        o.stop(t + 0.18);
      }
      break;
    }
  }
}

/** Renders a song for `bars` bars into a context (offline rendering for tools and tests). */
export function renderInto(ctx: BaseAudioContext, dest: AudioNode, song: Song, bars: number, mix: Mix = 'full', at = 0.05): number {
  const v = new SongVoice(ctx, song, dest, mix);
  for (let b = 0; b < bars; b++) v.scheduleBar(b % v.plan.bars, at + b * v.barSeconds);
  return at + bars * v.barSeconds;
}
