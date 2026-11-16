type Bus = {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  noise: AudioBuffer;
};

let bus: Bus | null = null;
let muted = false;

function ctxCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function unlockAudio(): void {
  const Ctor = ctxCtor();
  if (!Ctor) return;
  if (!bus) {
    const ctx = new Ctor();
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    master.gain.value = muted ? 0 : 1;
    sfx.gain.value = 0.9;
    music.gain.value = 0.4;
    bus = { ctx, master, sfx, music, noise: makeNoise(ctx) };
  }
  if (bus.ctx.state === "suspended") void bus.ctx.resume();
}

export function resumeAudio(): void {
  if (bus && bus.ctx.state === "suspended") void bus.ctx.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  if (!bus) return;
  bus.master.gain.setTargetAtTime(next ? 0 : 1, bus.ctx.currentTime, 0.02);
}

function envGain(target: GainNode, peak: number, dur: number, attack = 0.008): GainNode {
  const ctx = bus!.ctx;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, dur));
  g.connect(target);
  return g;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number): void {
  if (!bus || muted) return;
  const ctx = bus.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + dur);
  const g = envGain(bus.sfx, peak, dur);
  osc.connect(g);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function musicTone(freq: number, dur: number, peak: number): void {
  if (!bus || muted) return;
  const ctx = bus.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  const g = envGain(bus.music, peak, dur, 0.01);
  osc.connect(g);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function noiseBurst(dur: number, peak: number, freq: number): void {
  if (!bus || muted) return;
  const ctx = bus.ctx;
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const g = envGain(bus.sfx, peak, dur, 0.004);
  src.connect(filter);
  filter.connect(g);
  src.start();
  src.stop(ctx.currentTime + dur);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
  };
}

function chirp(delay: number, from: number, to: number): void {
  if (!bus || muted) return;
  const ctx = bus.ctx;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g);
  g.connect(bus.sfx);
  osc.start(t);
  osc.stop(t + 0.1);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export const sfx = {
  jump() {
    tone(260, 0.11, "square", 0.055, 680);
  },
  land(impact: number) {
    const peak = Math.min(0.14, 0.04 + impact / 5000);
    tone(130, 0.09, "sine", peak, 62);
    noiseBurst(0.05, peak * 0.55, 380);
  },
  slide() {
    noiseBurst(0.13, 0.045, 980);
  },
  spark(combo: number) {
    const f = 640 + Math.min(combo, 16) * 26;
    tone(f, 0.08, "sine", 0.055, f * 1.45);
  },
  coin() {
    tone(1568, 0.07, "sine", 0.08, 2093);
    chirp(0.06, 2093, 2637);
  },
  clear(combo: number) {
    tone(400 + Math.min(combo, 24) * 16, 0.06, "triangle", 0.04);
  },
  near() {
    tone(860, 0.1, "sine", 0.05, 1380);
  },
  hit() {
    noiseBurst(0.24, 0.16, 220);
    tone(170, 0.26, "sawtooth", 0.07, 48);
  },
  tick(beat: number) {
    const scale = [196, 247, 294, 330, 392];
    musicTone(scale[beat % scale.length] ?? 196, 0.1, 0.02);
  },
  peep() {
    chirp(0, 920, 1480);
    chirp(0.11, 1040, 1620);
  },
};
