// The chiptune synth that plays songs.ts: pulse and square leads, a plucked shamisen-ish voice,
// a breathy flute, music-box bells, a triangle bass and synthesised drums (kick, taiko, snare,
// hats, woodblock, chanchiki). Works on any BaseAudioContext, so tools/music can render songs
// offline to listen to them.

import { compile, type Drum, type MusicEvent, type Plan, type Song, type Voice } from './songs.js';

/** How the parts sit: everything, or thinned and muffled while players talk into their phones. */
export type Mix = 'full' | 'under';

interface Levels {
  lead: number;
  comp: number;
  bass: number;
  low: number;
  high: number;
  /** Low-pass cutoff, Hz. */
  cutoff: number;
  song: number;
}

// "under" keeps the low end (bass, kick, taiko) and drops the lead and most of the high drums, then
// low-passes the lot, so the speech band (about 1–4 kHz) the phone mics need stays clear.
const MIXES: Record<Mix, Levels> = {
  full: { lead: 1, comp: 1, bass: 1, low: 1, high: 1, cutoff: 16_000, song: 1 },
  under: { lead: 0, comp: 0.7, bass: 0.9, low: 0.8, high: 0.15, cutoff: 900, song: 0.7 },
};

/** Mastered recordings are much louder than the synth's parts. */
const TRACK_LEVEL = 0.5;

const LOW_DRUMS: ReadonlySet<Drum> = new Set(['k', 't']);

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A bus whose low-pass and level follow the mix. */
function mixBus(ctx: BaseAudioContext, dest: AudioNode): { input: BiquadFilterNode; out: GainNode } {
  const out = ctx.createGain();
  const input = ctx.createBiquadFilter();
  input.type = 'lowpass';
  input.Q.value = 0.7;
  input.connect(out).connect(dest);
  return { input, out };
}

function ramp(ctx: BaseAudioContext, param: AudioParam, value: number, seconds: number): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds > 0) param.linearRampToValueAtTime(value, now + seconds);
  else param.setValueAtTime(value, now);
}

/** One song playing (or ready to play) into `out`, with its own part buses so the mix can move. */
export class SongVoice {
  readonly plan: Plan;
  readonly sixteenth: number;
  private readonly song: Song;
  private readonly out: GainNode;
  private readonly filter: BiquadFilterNode;
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
    const { input, out } = mixBus(ctx, dest);
    this.filter = input;
    this.out = out;
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.filter);
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
    to(this.filter.frequency, lv.cutoff);
    to(this.out.gain, lv.song);
  }

  /** Fades out and lets go of the nodes. */
  fadeOut(seconds = 0.6): void {
    ramp(this.ctx, this.out.gain, 0, seconds);
    setTimeout(() => this.out.disconnect(), (seconds + 2) * 1000);
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

const buffers = new Map<string, Promise<AudioBuffer>>();
function load(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: ${r.status}`))))
      .then((data) => ctx.decodeAudioData(data));
    p.catch(() => buffers.delete(url));
    buffers.set(url, p);
  }
  return p;
}

/**
 * A recorded track looping into `out`. It can't drop its lead like a synth song, so "under" only
 * low-passes it and turns it down. Starts once the file has loaded.
 */
export class TrackVoice {
  private readonly filter: BiquadFilterNode;
  private readonly out: GainNode;
  private src: AudioBufferSourceNode | null = null;
  private stopped = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    url: string,
    dest: AudioNode,
    mix: Mix = 'full',
  ) {
    const { input, out } = mixBus(ctx, dest);
    this.filter = input;
    this.out = out;
    this.setMix(mix, 0);
    load(ctx, url).then(
      (buffer) => {
        if (this.stopped) return;
        this.src = ctx.createBufferSource();
        this.src.buffer = buffer;
        this.src.loop = true;
        this.src.connect(this.filter);
        this.src.start(ctx.currentTime + 0.05);
      },
      () => {
        // No file, no music: the round carries on in silence.
      },
    );
  }

  setMix(mix: Mix, seconds = 0.8): void {
    ramp(this.ctx, this.filter.frequency, MIXES[mix].cutoff, seconds);
    ramp(this.ctx, this.out.gain, TRACK_LEVEL * (mix === 'full' ? 1 : 0.6), seconds);
  }

  fadeOut(seconds = 0.6): void {
    this.stopped = true;
    ramp(this.ctx, this.out.gain, 0, seconds);
    const src = this.src;
    setTimeout(() => {
      src?.stop();
      this.out.disconnect();
    }, (seconds + 0.2) * 1000);
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
