import { loadSave, writeSave, type Pace, type SaveData } from "@/game/save";
import { resumeAudio, setMuted, sfx, unlockAudio } from "@/game/audio";

export type { Pace };

export type Mode = "menu" | "run" | "pause" | "hitstop" | "tumble" | "over";
export type DeathReason = "" | "crate" | "beam" | "pit";

export type Snapshot = {
  mode: Mode;
  score: number;
  best: number;
  combo: number;
  peakCombo: number;
  distance: number;
  speedNorm: number;
  speedMult: number;
  newBest: boolean;
  muted: boolean;
  feet: number;
  airLeft: number;
  sliding: boolean;
  reason: DeathReason;
  pace: Pace;
  shields: number;
  flying: boolean;
  flightLabel: string;
  title: string;
};

declare global {
  interface Window {
    __lumen?: Snapshot;
  }
}

const GRAVITY = 2800;
const JUMP_V = 980;
const COYOTE = 0.11;
const BUFFER = 0.13;
const SLIDE_DUR = 0.56;
const SLIDE_LOCK = 0.08;
const PACE_SPEED: Record<Pace, number> = { slow: 460, mid: 620, fast: 780 };
const MAX_SPEED = 1060;
const RAMP = 23;
const CHAIN = 2.7;

const BODY_TIERS: { at: number; name: string; rgb: [number, number, number] }[] = [
  { at: 0, name: "", rgb: [244, 239, 230] },
  { at: 5, name: "살구", rgb: [255, 176, 136] },
  { at: 12, name: "금빛", rgb: [246, 196, 83] },
  { at: 20, name: "민트", rgb: [126, 224, 192] },
  { at: 32, name: "하늘", rgb: [159, 212, 255] },
];

type Kind = "low" | "tall" | "beam" | "pit";

type Obs = {
  alive: boolean;
  kind: Kind;
  x: number;
  w: number;
  h: number;
  thick: number;
  scored: boolean;
  near: boolean;
};

type Spark = { alive: boolean; x: number; y: number; phase: number; wing: boolean };
type Particle = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  front: boolean;
};
type Floater = { alive: boolean; x: number; y: number; vy: number; life: number; max: number; text: string; color: string };
type Streak = { x: number; y: number; len: number };

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash(n: number): number {
  let x = Math.imul(n | 0, 374761393) + 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

function makeObs(): Obs {
  return { alive: false, kind: "low", x: 0, w: 0, h: 0, thick: 36, scored: false, near: false };
}
function makeSpark(): Spark {
  return { alive: false, x: 0, y: 0, phase: 0, wing: false };
}
function makeParticle(): Particle {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 3, color: "#fff", front: false };
}
function makeFloater(): Floater {
  return { alive: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: "", color: "#fff" };
}

export class Runner {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private onFrame: (s: Snapshot) => void;
  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private view = { w: 960, h: 540, ground: 420, scale: 1 };
  private reduced = false;

  private mode: Mode = "menu";
  private save: SaveData;
  private bestAtStart = 0;
  private score = 0;
  private scoreAcc = 0;
  private combo = 0;
  private peakCombo = 0;
  private chain = 0;
  private distance = 0;
  private newBest = false;
  private muted: boolean;
  private reason: DeathReason = "";
  private dirty = false;
  private saveTimer = 0;

  private scroll = 0;
  private speed = 240;
  private displaySpeed = PACE_SPEED.mid;
  private pace: Pace = "mid";
  private baseSpeed = PACE_SPEED.mid;
  private runTime = 0;
  private time = 0;
  private px = 220;
  private feet = 0;
  private vy = 0;
  private grounded = true;
  private coyote = COYOTE;
  private jumpBuffer = 0;
  private queued = 0;
  private airLeft = 3;
  private shields = 0;
  private shieldsGiven = 0;
  private invuln = 0;
  private lastWeather: "clear" | "wind" | "rain" | "snow" = "clear";
  private nextWingAt = 10000;
  private flapSign = 0;
  private flying = false;
  private flightLabel = "";
  private flightT = 0;
  private title = "";
  private titleT = 0;
  private flightTarget = 220;
  private flightVy = 0;
  private dayTold = false;
  private drops = Array.from({ length: 80 }, () => ({
    x: Math.random(),
    y: Math.random(),
    v: 0.45 + Math.random() * 0.7,
    s: 0.4 + Math.random(),
  }));
  private lastJumpAt = 0;
  private tintR = 244;
  private tintG = 239;
  private tintB = 230;
  private tintTier = 0;
  private slideT = 0;
  private slideBlend = 0;
  private slideLock = 0;
  private slideQueued = false;
  private phase = 0;
  private jumpStretch = 0;
  private landSquash = 0;
  private trauma = 0;
  private flash = 0;
  private hitTimer = 0;
  private tumbleT = 0;
  private dustAcc = 0;
  private beatAcc = 0;
  private beat = 0;
  private nextX = 1200;
  private lastKind: Kind | "" = "";

  private obstacles: Obs[] = Array.from({ length: 18 }, makeObs);
  private sparks: Spark[] = Array.from({ length: 28 }, makeSpark);
  private particles: Particle[] = Array.from({ length: 160 }, makeParticle);
  private floaters: Floater[] = Array.from({ length: 10 }, makeFloater);
  private streaks: Streak[] = Array.from({ length: 16 }, () => ({ x: 0, y: 0, len: 40 }));

  private onKeyDown: (e: KeyboardEvent) => void;
  private onResize: () => void;
  private onVis: () => void;
  private ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, onFrame: (s: Snapshot) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFrame = onFrame;
    this.save = loadSave();
    this.pace = this.save.pace;
    this.baseSpeed = PACE_SPEED[this.pace];
    this.displaySpeed = this.baseSpeed;
    this.muted = this.save.muted;
    this.bestAtStart = this.save.best;
    setMuted(this.muted);
    this.reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
    this.onResize = () => this.resize();
    this.onVis = () => {
      if (document.hidden) {
        this.persist(true);
        this.last = performance.now();
      } else {
        resumeAudio();
        this.last = performance.now();
      }
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    this.seedStreaks();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.last = performance.now();
    this.draw();
    this.emit();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.ro?.disconnect();
    this.persist(true);
  }

  jump(): void {
    unlockAudio();
    const now = performance.now();
    if (this.mode === "menu" || this.mode === "over") {
      this.begin();
      this.queued = 1;
      this.lastJumpAt = now;
      return;
    }
    if (this.mode !== "run") return;
    if (this.flying) {
      this.nudgeFly(1);
      return;
    }
    if (now - this.lastJumpAt < 40) return;
    this.lastJumpAt = now;
    if (this.airLeft <= 0) return;
    this.queued = Math.min(this.airLeft, this.queued + 1);
  }

  slide(): void {
    unlockAudio();
    if (this.mode === "menu" || this.mode === "over") {
      this.begin();
      return;
    }
    if (this.mode !== "run") return;
    if (this.flying) {
      this.nudgeFly(-1);
      return;
    }
    this.slideQueued = true;
  }

  inFlight(): boolean {
    return this.flying && this.mode === "run";
  }

  flyTo(clientY: number): void {
    if (!this.inFlight()) return;
    const rect = this.canvas.getBoundingClientRect();
    const t = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    this.flightTarget = lerp(this.view.h * 0.62, 90, t);
  }

  private nudgeFly(dir: number): void {
    if (!this.flying) return;
    this.flightTarget = clamp(this.flightTarget + dir * 80, 90, this.view.h * 0.62);
  }

  private checkFlight(): void {
    while (this.score >= this.nextWingAt) {
      const peak = (JUMP_V * JUMP_V) / (2 * GRAVITY);
      this.addSpark(this.scroll + this.view.w + 40, peak * 0.96, true);
      this.nextWingAt = this.advanceWingScore(this.nextWingAt);
    }
  }

  private advanceWingScore(after: number): number {
    if (after < 100000) return after + 30000;
    if (after < 200000) return after + 20000;
    return after + 10000;
  }

  private startFlight(seconds: number): void {
    const fresh = !this.flying;
    this.flying = true;
    this.flightLabel = "3초 비행";
    this.flightT = Math.max(this.flightT, seconds);
    if (fresh) this.flightTarget = Math.max(this.feet + 90, this.view.h * 0.42);
    this.grounded = false;
    this.queued = 0;
    this.floater("3초 비행", this.px, this.view.ground - this.feet - 110, "#9fd4ff");
  }

  begin(): void {
    unlockAudio();
    this.mode = "run";
    this.runTime = 0;
    this.score = 0;
    this.scoreAcc = 0;
    this.combo = 0;
    this.peakCombo = 0;
    this.chain = 0;
    this.distance = 0;
    this.feet = 0;
    this.vy = 0;
    this.grounded = true;
    this.coyote = COYOTE;
    this.jumpBuffer = 0;
    this.queued = 0;
    this.airLeft = 3;
    this.shields = 0;
    this.shieldsGiven = 0;
    this.invuln = 0;
    this.lastWeather = "clear";
    this.nextWingAt = 10000;
    this.flapSign = 0;
    this.flying = false;
    this.flightLabel = "";
    this.flightT = 0;
    this.title = "";
    this.titleT = 0;
    this.flightVy = 0;
    this.dayTold = false;
    this.tintTier = 0;
    this.tintR = BODY_TIERS[0].rgb[0];
    this.tintG = BODY_TIERS[0].rgb[1];
    this.tintB = BODY_TIERS[0].rgb[2];
    this.slideT = 0;
    this.slideBlend = 0;
    this.slideLock = 0;
    this.slideQueued = false;
    this.jumpStretch = 0;
    this.landSquash = 0.2;
    this.trauma = 0;
    this.flash = 0;
    this.hitTimer = 0;
    this.tumbleT = 0;
    this.reason = "";
    this.newBest = false;
    this.bestAtStart = this.save.best;
    this.speed = this.baseSpeed;
    this.displaySpeed = this.baseSpeed;
    this.dustAcc = 0;
    this.beatAcc = 0;
    for (const o of this.obstacles) o.alive = false;
    for (const s of this.sparks) s.alive = false;
    for (const f of this.floaters) f.alive = false;
    this.lastKind = "";
    this.nextX = this.scroll + this.view.w * 0.98;
    this.emit();
  }

  togglePause(): void {
    if (this.mode === "run") {
      this.mode = "pause";
      this.queued = 0;
      this.jumpBuffer = 0;
      this.slideQueued = false;
      this.emit();
      return;
    }
    if (this.mode === "pause") {
      this.mode = "run";
      this.last = performance.now();
      this.emit();
    }
  }

  toMenu(): void {
    if (this.mode !== "over") return;
    this.mode = "menu";
    this.score = 0;
    this.scoreAcc = 0;
    this.combo = 0;
    this.distance = 0;
    this.feet = 0;
    this.vy = 0;
    this.grounded = true;
    this.reason = "";
    this.shields = 0;
    this.invuln = 0;
    this.trauma = 0;
    this.flash = 0;
    for (const o of this.obstacles) o.alive = false;
    for (const s of this.sparks) s.alive = false;
    this.lastKind = "";
    this.nextX = this.scroll + this.view.w * 0.98;
    this.emit();
  }

  setPace(pace: Pace): void {
    if (pace !== "slow" && pace !== "mid" && pace !== "fast") return;
    this.pace = pace;
    this.baseSpeed = PACE_SPEED[pace];
    this.save.pace = pace;
    this.dirty = true;
    this.persist(true);
    if (this.mode !== "run") this.displaySpeed = this.baseSpeed;
    this.emit();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.save.muted = this.muted;
    setMuted(this.muted);
    if (!this.muted) unlockAudio();
    this.dirty = true;
    this.persist(true);
    this.emit();
  }

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frame(dt);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private frame(dt: number): void {
    this.time += dt;
    if (this.cssW < 2 || this.cssH < 2) {
      this.draw();
      return;
    }
    if (document.hidden) {
      if (this.mode === "run") this.mode = "pause";
      this.draw();
      this.emit();
      return;
    }
    if (this.mode === "pause") {
      this.draw();
      this.emit();
      return;
    }
    if (this.mode === "hitstop") {
      this.hitTimer -= dt;
      this.trauma = Math.max(0, this.trauma - dt * 0.6);
      this.flash = Math.max(0, this.flash - dt * 2.4);
      this.updateParticles(dt);
      this.updateFloaters(dt);
      if (this.hitTimer <= 0) {
        this.mode = "tumble";
        this.tumbleT = 0;
      }
      this.draw();
      this.emit();
      return;
    }
    if (this.mode === "tumble") {
      this.tumbleT += dt;
      this.speed = Math.max(0, this.speed - dt * 780);
      this.scroll += this.speed * dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.1);
      this.flash = Math.max(0, this.flash - dt * 1.4);
      this.updateParticles(dt);
      this.updateFloaters(dt);
      if (this.tumbleT > 0.46) this.finish();
      this.draw();
      this.emit();
      return;
    }

    if (this.mode === "over") {
      this.scroll += 36 * dt;
      this.phase += dt * 2;
      this.updateParticles(dt);
      this.updateFloaters(dt);
      this.draw();
      this.emit();
      return;
    }

    let left = dt;
    let guard = 0;
    while (left > 0 && guard++ < 6 && (this.mode === "run" || this.mode === "menu")) {
      const h = Math.min(left, 1 / 60);
      this.step(h);
      left -= h;
    }
    this.draw();
    this.emit();
  }

  private step(h: number): void {
    this.jumpStretch = Math.max(0, this.jumpStretch - h * 3.2);
    this.landSquash = Math.max(0, this.landSquash - h * 4);
    const slideTarget = this.slideT > 0 ? 1 : 0;
    this.slideBlend += (slideTarget - this.slideBlend) * Math.min(1, h * 14);
    this.trauma = Math.max(0, this.trauma - h * 1.6);
    this.updateParticles(h);
    this.updateFloaters(h);

    if (this.mode === "menu") {
      this.speed = 230;
      this.scroll += this.speed * h;
      this.phase += h * 11;
      this.feet = 0;
      this.grounded = true;
      this.spawnDust(h, 0.5);
      return;
    }

    this.runTime += h;
    this.speed = Math.min(MAX_SPEED, this.baseSpeed + this.runTime * RAMP);
    this.displaySpeed = this.speed;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - h);
    if (this.queued > 0) this.jumpBuffer = BUFFER;
    this.slideLock = Math.max(0, this.slideLock - h);
    this.invuln = Math.max(0, this.invuln - h);
    this.titleT = Math.max(0, this.titleT - h);
    if (this.titleT === 0) this.title = "";
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - h);
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - h);
    if (this.chain > 0) {
      this.chain = Math.max(0, this.chain - h);
      if (this.chain === 0) this.combo = 0;
    }

    if (this.slideQueued) {
      this.slideQueued = false;
      if (this.slideT <= 0) {
        this.slideT = SLIDE_DUR;
        this.slideLock = SLIDE_LOCK;
        if (!this.grounded) this.vy = Math.min(this.vy, -520);
        sfx.slide();
        this.puff(6, "#f6f1e7", 0.35);
      }
    }

    if (this.queued > 0 && this.jumpBuffer > 0 && this.canJump() && !this.flying) {
      this.queued -= 1;
      if (this.queued <= 0) this.jumpBuffer = 0;
      this.doJump();
    }

    const resting = this.grounded && this.feet <= 0 && this.vy <= 0 && !this.flying;
    if (this.flying) {
      this.flightT -= h;
      const goal = clamp(this.flightTarget, 90, this.view.h * 0.62);
      const prev = this.feet;
      this.feet += (goal - this.feet) * Math.min(1, h * 5);
      this.flightVy = (this.feet - prev) / Math.max(h, 0.001);
      this.vy = this.flightVy;
      this.grounded = false;
      if (this.flightT <= 0) {
        this.flying = false;
        this.flightLabel = "";
        this.vy = -120;
        this.floater("낙하", this.px, this.view.ground - this.feet - 70, "#f6f1e7");
      } else {
        const flap = Math.sin(this.time * 2.4);
        const sign = flap >= 0 ? 1 : -1;
        if (sign !== this.flapSign && sign > 0) sfx.peep();
        this.flapSign = sign;
      }
    } else if (!resting) {
      this.vy -= GRAVITY * h;
      this.feet += this.vy * h;
    }

    const supported = this.hasGround(this.scroll + this.px);
    if (supported && this.feet <= 0 && this.vy <= 0) {
      const wasAir = !this.grounded;
      const impact = -this.vy;
      this.feet = 0;
      this.vy = 0;
      this.grounded = true;
      this.coyote = COYOTE;
      this.airLeft = 3;
      this.queued = 0;
      if (wasAir) this.onLand(impact);
    } else {
      const wasGround = this.grounded;
      this.grounded = false;
      if (wasGround && this.feet <= 2) this.coyote = COYOTE;
      if (!supported && this.feet < -24 && this.vy < 0 && !this.flying) {
        if (this.invuln > 0) {
          this.feet = 20;
          this.vy = 360;
        } else {
          this.die("pit");
          return;
        }
      }
    }

    if (this.grounded && this.slideT <= 0) this.phase += h * (10 + this.speed * 0.012);
    else this.phase += h * 3.2;

    this.scroll += this.speed * h;
    this.distance += (this.speed * h) / 52;
    const mult = Math.min(8, 1 + this.combo * 0.16);
    this.scoreAcc += h * this.speed * 0.062 * mult;
    if (this.scoreAcc >= 1) {
      const add = Math.floor(this.scoreAcc);
      this.score += add;
      this.scoreAcc -= add;
      if (this.score > this.save.best) {
        this.save.best = this.score;
        this.newBest = this.score > this.bestAtStart;
        this.dirty = true;
      }
    }

    this.checkFlight();
    this.collide(h);
    if (this.mode !== "run") return;
    this.collectSparks();
    this.scorePasses();
    this.spawnIfNeeded();
    this.recycle();
    if (this.grounded && this.slideT <= 0) this.spawnDust(h, 1);
    this.beatAcc += h;
    const interval = lerp(0.5, 0.28, this.difficulty());
    if (this.beatAcc >= interval) {
      this.beatAcc = 0;
      this.beat += 1;
      sfx.tick(this.beat);
    }
    this.saveTimer -= h;
    if (this.dirty && this.saveTimer <= 0) this.persist(false);
    this.refreshShields();
    this.checkFlight();
    this.updateWeather(h);
    this.refreshTint(h);
  }

  private refreshTint(h: number): void {
    let tier = 0;
    for (let i = 1; i < BODY_TIERS.length; i++) {
      if (this.peakCombo >= BODY_TIERS[i].at) tier = i;
    }
    if (tier > this.tintTier) {
      this.tintTier = tier;
      const next = BODY_TIERS[tier];
      this.floater(next.name, this.px + 8, this.view.ground - this.feet - 118, "#f6f1e7");
      this.puff(10, `rgb(${next.rgb[0]},${next.rgb[1]},${next.rgb[2]})`, 0.55);
    }
    const target = BODY_TIERS[this.tintTier].rgb;
    const k = Math.min(1, h * 4.5);
    this.tintR += (target[0] - this.tintR) * k;
    this.tintG += (target[1] - this.tintG) * k;
    this.tintB += (target[2] - this.tintB) * k;
  }

  private bodyFill(): string {
    return `rgb(${this.tintR | 0},${this.tintG | 0},${this.tintB | 0})`;
  }

  private canJump(): boolean {
    if (this.airLeft <= 0) return false;
    if (this.grounded && this.slideLock > 0) return false;
    return true;
  }

  private doJump(): void {
    this.airLeft -= 1;
    const fromGround = this.grounded || this.coyote > 0;
    this.vy = JUMP_V;
    this.feet = Math.max(this.feet, 0);
    this.grounded = false;
    this.coyote = 0;
    this.slideT = 0;
    this.jumpStretch = 1;
    this.landSquash = 0;
    sfx.jump();
    this.puff(fromGround ? 8 : 6, fromGround ? "#ffd7c2" : "#f2c14e", 0.4);
  }

  private onLand(impact: number): void {
    this.landSquash = clamp(impact / 1400, 0.35, 1);
    this.jumpStretch = 0;
    if (impact > 120) {
      sfx.land(impact);
      this.puff(10, "#c9d2e0", 0.45);
    }
  }

  private crouched(): boolean {
    return this.slideT > 0 || this.slideBlend > 0.35;
  }

  private bodyScale(): { sx: number; sy: number } {
    const falling = this.mode === "tumble" || this.mode === "over";
    const slide = falling ? 0 : this.slideBlend;
    const air = !falling && slide < 0.3 && (!this.grounded || this.feet > 6);
    if (slide > 0.01) return { sx: lerp(1, 1.72, slide), sy: lerp(1, 0.4, slide) };
    if (air) {
      const rise = clamp(this.vy / JUMP_V, 0, 1);
      const sy = 1.08 + rise * 0.22;
      const sx = 1 - (sy - 1) * 0.2;
      return { sx, sy };
    }
    if (falling) return { sx: 1, sy: 1 };
    const hop = Math.abs(Math.sin(this.phase * 2)) * 0.06;
    return {
      sx: 1 + this.landSquash * 0.3 - hop * 0.5,
      sy: 1 - this.landSquash * 0.34 + hop,
    };
  }

  private hurt(): { top: number; bottom: number; halfW: number } {
    const { sx, sy } = this.bodyScale();
    return { top: 72 * sy, bottom: 6, halfW: 22 * sx };
  }

  private hasGround(worldX: number): boolean {
    const samples = [worldX - 14, worldX, worldX + 14];
    return samples.some((wx) => !this.inPit(wx));
  }

  private inPit(wx: number): boolean {
    for (const o of this.obstacles) {
      if (!o.alive || o.kind !== "pit") continue;
      if (wx > o.x + 10 && wx < o.x + o.w - 10) return true;
    }
    return false;
  }

  private collide(h: number): void {
    if (this.invuln > 0 || this.flying) return;
    const prevScroll = this.scroll - this.speed * h;
    const hb = this.hurt();
    const pL = this.px - hb.halfW;
    const pR = this.px + hb.halfW;
    const bottom = this.feet + hb.bottom;
    const top = this.feet + hb.top;
    for (const o of this.obstacles) {
      if (!o.alive || o.kind === "pit") continue;
      const left = o.x - this.scroll;
      const prevLeft = o.x - prevScroll;
      const sL = Math.min(left, prevLeft);
      const sR = Math.max(left + o.w, prevLeft + o.w);
      if (sR <= pL || sL >= pR) continue;
      if (o.kind === "beam") {
        const beamBottom = o.h;
        const beamTop = o.h + o.thick;
        const into = top - beamBottom;
        if (into >= 16 && bottom < beamTop) {
          this.die("beam");
          return;
        }
        if (into > -8 && into <= 16) o.near = true;
      } else {
        const into = o.h - bottom;
        if (into >= 16 && top > 10) {
          this.die("crate");
          return;
        }
        if (into > -12 && into <= 16) o.near = true;
      }
    }
  }

  private die(reason: DeathReason): void {
    if (this.mode !== "run" || this.invuln > 0) return;
    if (this.shields > 0) {
      this.shields -= 1;
      this.invuln = 0.95;
      this.flash = 0.5;
      this.trauma = Math.min(1, this.trauma + 0.35);
      this.floater("방어", this.px, this.view.ground - this.feet - 96, "#7ee0c0");
      this.puff(16, "#7ee0c0", 0.75);
      sfx.near();
      if (reason === "pit") {
        this.feet = 56;
        this.vy = 720;
        this.grounded = false;
      } else if (reason === "beam") {
        this.slideT = Math.max(this.slideT, 0.4);
        this.vy = Math.min(this.vy, -200);
      } else {
        this.vy = Math.max(this.vy, 680);
        this.feet += 24;
        this.grounded = false;
      }
      return;
    }
    this.mode = "hitstop";
    this.hitTimer = this.reduced ? 0.04 : 0.08;
    this.reason = reason;
    this.trauma = Math.min(1, this.trauma + 0.82);
    this.flash = 1;
    this.jumpBuffer = 0;
    this.queued = 0;
    this.slideQueued = false;
    if (this.feet < 0) this.feet = 0;
    sfx.hit();
    this.puff(22, reason === "pit" ? "#8ea0b8" : "#ff6a3d", 1);
    this.floater(reason === "pit" ? "낙하" : "충돌", this.px, this.view.ground - this.feet - 80, "#f6f1e7");
  }

  private finish(): void {
    if (this.mode === "over") return;
    this.mode = "over";
    this.speed = 0;
    if (this.score > this.save.best) this.save.best = Math.floor(this.score);
    if (this.peakCombo > this.save.bestCombo) this.save.bestCombo = this.peakCombo;
    if (this.distance > this.save.bestDistance) this.save.bestDistance = this.distance;
    this.newBest = Math.floor(this.score) > this.bestAtStart && this.score > 0;
    this.dirty = true;
    this.persist(true);
  }

  private scorePasses(): void {
    const playerWorld = this.scroll + this.px - 8;
    for (const o of this.obstacles) {
      if (!o.alive || o.scored) continue;
      if (o.x + o.w > playerWorld) continue;
      o.scored = true;
      this.combo += o.near ? 2 : 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.chain = CHAIN;
      const bonus = (o.near ? 22 : 12) * Math.min(this.combo, 48);
      this.score += bonus;
      if (o.near) {
        sfx.near();
        this.floater("아슬", this.px + 26, this.view.ground - 120, "#5ee0b5");
      } else {
        sfx.clear(this.combo);
        this.floater(`+${bonus}`, this.px + 18, this.view.ground - 100, "#f2c14e");
      }
      if (this.score > this.save.best) {
        this.save.best = this.score;
        this.newBest = this.score > this.bestAtStart;
        this.dirty = true;
      }
    }
  }

  private collectSparks(): void {
    const crouched = this.crouched();
    const cy = this.feet + (crouched ? 24 : 62);
    for (const s of this.sparks) {
      if (!s.alive) continue;
      const sx = s.x - this.scroll;
      const dx = sx - this.px;
      const dy = s.y - cy;
      if (dx * dx + dy * dy > 72 * 72) continue;
      s.alive = false;
      if (s.wing) this.startFlight(3);
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.chain = CHAIN;
      const bonus = 8 * Math.min(Math.max(1, this.combo), 48);
      this.score += bonus;
      sfx.spark(this.combo);
      this.floater(`+${bonus}`, sx, this.view.ground - s.y - 16, "#5ee0b5");
      this.burstAt(s.x, s.y, 8, "#5ee0b5");
    }
  }

  private difficulty(): number {
    return clamp((this.speed - this.baseSpeed) / (MAX_SPEED - this.baseSpeed), 0, 1);
  }

  private gapAfter(kind: Kind): number {
    const d = this.difficulty();
    const dense = lerp(0.8, 0.48, d);
    let t = dense;
    if (kind === "tall") t = Math.max(t, 0.84);
    else if (kind === "beam") t = Math.max(t, 0.66);
    else if (kind === "pit") t = Math.max(t, 0.6);
    else t = Math.max(t, lerp(0.74, 0.44, d));
    if (this.lastKind === "beam" && (kind === "low" || kind === "tall")) t = Math.max(t, 0.7);
    if (this.lastKind === "tall") t = Math.max(t, 0.78);
    return Math.max(170, this.speed * t);
  }

  private pickKind(): Kind {
    const d = this.difficulty();
    const r = Math.random();
    if (d < 0.16) return "low";
    if (d < 0.36) return r < 0.64 ? "low" : "beam";
    if (d < 0.62) {
      if (r < 0.32) return "low";
      if (r < 0.55) return "beam";
      if (r < 0.76) return "tall";
      return "pit";
    }
    if (r < 0.26) return "low";
    if (r < 0.48) return "beam";
    if (r < 0.68) return "tall";
    if (r < 0.88) return "pit";
    return "beam";
  }

  private spawnIfNeeded(): void {
    const horizon = this.scroll + this.view.w + 70;
    let guard = 0;
    while (this.nextX < horizon && guard++ < 4) this.spawnOne();
  }

  private spawnOne(): void {
    const d = this.difficulty();
    const kind = this.pickKind();
    const o = this.alloc(this.obstacles, makeObs);
    o.alive = true;
    o.kind = kind;
    o.x = Math.max(this.nextX, this.scroll + this.view.w * 0.86);
    o.scored = false;
    o.near = false;
    o.thick = 38;
    if (kind === "low") {
      o.w = 58 + Math.random() * 26;
      o.h = 58 + Math.random() * 20 + d * 10;
    } else if (kind === "tall") {
      o.w = 50 + Math.random() * 18;
      o.h = 112 + Math.random() * 22;
    } else if (kind === "beam") {
      o.w = Math.min(156, 78 + Math.random() * 46 + d * 30);
      o.h = 56;
    } else {
      const air = (2 * JUMP_V) / GRAVITY;
      const reach = this.speed * air * 0.48;
      o.w = clamp(100 + d * 100, 96, Math.min(210, reach));
      o.h = 0;
    }
    const gap = this.gapAfter(kind);
    this.nextX = o.x + o.w + gap;
    this.lastKind = kind;
    const peak = (JUMP_V * JUMP_V) / (2 * GRAVITY);
    const itemY = peak * 0.96;
    if (kind === "low" || kind === "tall") {
      this.addSpark(o.x + o.w + 28 + this.speed * 0.08, itemY);
    } else if (kind === "pit") {
      this.addSpark(o.x + o.w * 0.5, itemY);
    }
  }

  private addSpark(x: number, y: number, wing = false): void {
    const s = this.alloc(this.sparks, makeSpark);
    s.alive = true;
    s.x = x;
    s.y = y;
    s.phase = Math.random() * Math.PI * 2;
    s.wing = wing;
  }

  private recycle(): void {
    const limit = this.scroll - 160;
    for (const o of this.obstacles) if (o.alive && o.x + o.w < limit) o.alive = false;
    for (const s of this.sparks) if (s.alive && s.x < limit) s.alive = false;
  }

  private alloc<T extends { alive: boolean }>(pool: T[], make: () => T): T {
    for (const item of pool) if (!item.alive) return item;
    const extra = make();
    pool.push(extra);
    return extra;
  }

  private puff(n: number, color: string, spread: number): void {
    this.burstAt(this.scroll + this.px, this.feet + 8, n, color, spread);
  }

  private burstAt(worldX: number, height: number, n: number, color: string, spread = 1): void {
    const count = this.reduced ? Math.ceil(n * 0.4) : n;
    for (let i = 0; i < count; i++) {
      const p = this.alloc(this.particles, makeParticle);
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 220) * spread;
      p.alive = true;
      p.x = worldX + (Math.random() - 0.5) * 16;
      p.y = height;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.abs(Math.sin(a)) * sp * 0.8;
      p.g = 420;
      p.life = 0.35 + Math.random() * 0.35;
      p.max = p.life;
      p.size = 2 + Math.random() * 3.5;
      p.color = color;
      p.front = Math.random() > 0.35;
    }
  }

  private spawnDust(h: number, rate: number): void {
    this.dustAcc += h * rate;
    const every = 0.07;
    while (this.dustAcc >= every) {
      this.dustAcc -= every;
      const p = this.alloc(this.particles, makeParticle);
      p.alive = true;
      p.x = this.scroll + this.px - 16;
      p.y = 3 + Math.random() * 6;
      p.vx = -30 - Math.random() * 50;
      p.vy = 20 + Math.random() * 40;
      p.g = 220;
      p.life = 0.28;
      p.max = 0.28;
      p.size = 2.5;
      p.color = "#9aa6ba";
      p.front = false;
    }
  }

  private updateParticles(h: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.vy -= p.g * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (p.y < 0) {
        p.y = 0;
        p.vy *= -0.25;
        p.vx *= 0.8;
      }
      p.life -= h;
      if (p.life <= 0) p.alive = false;
    }
  }

  private floater(text: string, x: number, y: number, color: string): void {
    const f = this.alloc(this.floaters, makeFloater);
    f.alive = true;
    f.text = text;
    f.x = x;
    f.y = y;
    f.vy = -52;
    f.life = 0.62;
    f.max = 0.62;
    f.color = color;
  }

  private updateFloaters(h: number): void {
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.y += f.vy * h;
      f.life -= h;
      if (f.life <= 0) f.alive = false;
    }
  }

  private night(): number {
    if (this.mode === "menu") return 0.12;
    return this.difficulty();
  }

  private daylight(): number {
    if (this.mode !== "run") return 0;
    return clamp((this.distance - 460) / 520, 0, 1);
  }

  private seedStreaks(): void {
    this.streaks.forEach((s, i) => {
      s.x = this.scroll + Math.random() * this.view.w;
      s.y = 40 + Math.random() * (this.view.ground - 80);
      s.len = 30 + (i % 5) * 16;
    });
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    const worldW = this.cssW < 480 ? 500 : this.cssW < 720 ? 680 : this.cssW < 1200 ? 1000 : 1120;
    const scale = this.cssW / worldW;
    this.view.w = worldW;
    this.view.scale = scale;
    this.view.h = this.cssH / scale;
    this.view.ground = this.view.h * 0.76;
    this.px = worldW * 0.24;
  }

  private persist(force: boolean): void {
    if (!this.dirty && !force) return;
    this.save.muted = this.muted;
    this.save.best = Math.max(this.save.best, Math.floor(this.score));
    writeSave(this.save);
    this.dirty = false;
    this.saveTimer = 2;
  }

  private keyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === "Escape" || e.code === "KeyP") {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (this.mode === "pause") return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      this.jump();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      this.slide();
    } else if ((e.code === "KeyR" || e.code === "Enter") && (this.mode === "over" || this.mode === "menu")) {
      e.preventDefault();
      this.begin();
    } else if (e.code === "KeyM") {
      this.toggleMute();
    }
  }

  private snapshot(): Snapshot {
    const shown = this.mode === "run" ? this.speed : this.displaySpeed;
    const norm = this.mode === "menu" ? 0.08 : clamp((shown - this.baseSpeed) / (MAX_SPEED - this.baseSpeed), 0, 1);
    return {
      mode: this.mode,
      score: Math.floor(this.score),
      best: Math.floor(this.save.best),
      combo: this.combo,
      peakCombo: this.peakCombo,
      distance: Math.floor(this.distance),
      speedNorm: norm,
      speedMult: shown / this.baseSpeed,
      newBest: this.newBest,
      muted: this.muted,
      feet: this.feet,
      airLeft: this.airLeft,
      sliding: this.slideT > 0 || this.slideBlend > 0.5,
      reason: this.reason,
      pace: this.pace,
      shields: this.shields,
      flying: this.flying,
      flightLabel: this.flying ? this.flightLabel : "",
      title: this.titleT > 0 ? this.title : "",
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    if (typeof window !== "undefined") window.__lumen = snap;
    this.onFrame(snap);
  }

  private refreshShields(): void {
    const tier = Math.floor(this.score / 5000);
    if (tier < 1 || tier <= this.shieldsGiven) return;
    const grant = this.shields < 1;
    this.shieldsGiven = tier;
    if (!grant) return;
    this.shields = 1;
    this.title = "보호막";
    this.titleT = 1.8;
    this.puff(12, "#7ee0c0", 0.55);
  }

  private weatherKind(): "clear" | "wind" | "rain" | "snow" {
    if (this.mode !== "run" || this.distance < 180) return "clear";
    const phase = Math.floor((this.distance - 180) / 280) % 3;
    if (phase === 0) return "wind";
    if (phase === 1) return "rain";
    return "snow";
  }

  private updateWeather(h: number): void {
    const kind = this.weatherKind();
    if (kind !== this.lastWeather) {
      this.lastWeather = kind;
      const name = kind === "wind" ? "바람" : kind === "rain" ? "비" : kind === "snow" ? "눈" : "";
      if (name) this.floater(name, this.view.w * 0.62, 96, "#f6f1e7");
    }
    if (!this.dayTold && this.daylight() > 0.35) {
      this.dayTold = true;
      this.floater("낮", this.view.w * 0.42, 88, "#ffe1a8");
    }
    if (kind === "clear") return;
    const fall = kind === "rain" ? 0.55 : kind === "snow" ? 0.08 : 0;
    const blow = kind === "wind" ? 0.55 : kind === "rain" ? 0.12 : 0.04;
    for (const d of this.drops) {
      d.x += h * blow * d.v;
      d.y += h * fall * d.v;
      if (d.x > 1.3) d.x -= 1.5;
      if (d.y > 1.08) {
        d.y = -0.05;
        d.x = Math.random();
      }
    }
  }

  private drawWeather(ctx: CanvasRenderingContext2D): void {
    const kind = this.weatherKind();
    if (kind === "clear" || this.reduced) return;
    const { w, h } = this.view;
    ctx.save();
    for (const d of this.drops) {
      const x = (((d.x % 1) + 1) % 1) * w;
      const y = (((d.y % 1) + 1) % 1) * h;
      ctx.globalAlpha = 0.28 + d.s * 0.35;
      if (kind === "wind") {
        ctx.strokeStyle = "rgba(246,241,231,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y * 0.78);
        ctx.lineTo(x + 24 + d.s * 36, y * 0.78 + 1);
        ctx.stroke();
      } else if (kind === "rain") {
        ctx.strokeStyle = "rgba(186,214,255,0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 16 + d.s * 12);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#f7f4ee";
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + d.s * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h, scale } = this.view;
    const mag = this.trauma * this.trauma * (this.reduced ? 2 : 14);
    const ox = Math.sin(this.time * 43) * mag;
    const oy = Math.cos(this.time * 37) * mag * 0.75;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, ox * this.dpr, oy * this.dpr);
    this.drawSky(ctx);
    this.drawCelestial(ctx);
    this.drawBuildings(ctx, 0.16, true);
    this.drawBuildings(ctx, 0.4, false);
    this.drawGround(ctx);
    this.drawObstacles(ctx);
    this.drawSparks(ctx);
    this.drawParticles(ctx, false);
    this.drawPlayer(ctx);
    this.drawWeather(ctx);
    this.drawParticles(ctx, true);
    this.drawStreaks(ctx);
    this.drawFloaters(ctx);
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(246,241,231,${this.flash * 0.38})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.25, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vig;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const t = this.night();
    const day = this.daylight();
    const { w, h } = this.view;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, mix(mix("#1b3054", "#070a14", t), "#79c8ff", day));
    g.addColorStop(0.45, mix(mix("#3e628c", "#141c33", t), "#d7f1ff", day));
    g.addColorStop(0.72, mix(mix("#e08a62", "#3a2744", t), "#ffe3b0", day));
    g.addColorStop(1, mix(mix("#f3c48a", "#6e4458", t), "#fff6d8", day));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, w + 60, h + 60);
    if (t > 0.25 && day < 0.8) {
      const stars = 28;
      for (let i = 0; i < stars; i++) {
        const n = hash(i + 42);
        const n2 = hash(i + 90);
        const alpha = (t - 0.25) * (1 - day) * (0.3 + (n2 % 1) * 0.7);
        ctx.fillStyle = `rgba(246,241,231,${alpha})`;
        ctx.fillRect((n * w) % w, (n2 * this.view.ground * 0.7) % (this.view.ground * 0.65), 1.6, 1.6);
      }
    }
  }

  private drawCelestial(ctx: CanvasRenderingContext2D): void {
    const t = this.night();
    const day = this.daylight();
    const { w, ground } = this.view;
    if (day < 0.98) {
      const x = lerp(w * 0.72, w * 0.28, t);
      const y = lerp(ground * 0.38, ground * 0.22, t);
      const r = lerp(36, 18, t);
      ctx.save();
      ctx.globalAlpha = 1 - day;
      ctx.beginPath();
      ctx.fillStyle = mix("#ffe1a8", "#f6f1e7", t);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = mix("rgba(255,210,150,0.25)", "rgba(180,200,255,0.18)", t);
      ctx.arc(x, y, r * 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (day > 0.02) {
      const x = lerp(w * 0.18, w * 0.7, day);
      const y = lerp(ground * 0.92, ground * 0.2, day);
      const r = lerp(18, 34, day);
      ctx.save();
      ctx.globalAlpha = clamp(day * 1.3, 0, 1);
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,196,64,0.28)";
      ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "#ffe56a";
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBuildings(ctx: CanvasRenderingContext2D, parallax: number, far: boolean): void {
    const t = this.night();
    const day = this.daylight();
    const span = far ? 86 : 108;
    const lead = this.scroll * parallax;
    const i0 = Math.floor(lead / span) - 1;
    const count = Math.ceil(this.view.w / span) + 4;
    const base = this.view.ground;
    for (let i = i0; i < i0 + count; i++) {
      const salt = far ? 11 : 77;
      const n = hash(i * 3 + salt);
      const n2 = hash(i * 5 + salt + 4);
      const n3 = hash(i * 7 + salt + 9);
      const bw = span * (0.62 + n * 0.34);
      const bh = (far ? 46 : 70) + n2 * (far ? 110 : 190);
      const x = i * span - lead;
      const body = mix(
        far ? mix("#24344c", "#121826", t) : mix("#1b2838", "#0d121b", t),
        far ? "#6d8eae" : "#4d6d8c",
        day,
      );
      ctx.fillStyle = body;
      ctx.fillRect(x, base - bh, bw, bh + 8);
      if (!far && n3 > 0.42) {
        const antenna = 16 + n3 * 28;
        ctx.fillStyle = mix("#31445c", "#1c2636", t);
        ctx.fillRect(x + bw * 0.45, base - bh - antenna, 3, antenna);
      }
      const lit = 0.25 + t * 0.75;
      const cols = 2 + Math.floor(n * 3);
      const rows = 2 + Math.floor(n2 * 5);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const win = hash(i * 100 + c * 17 + r * 13 + salt);
          if (win > 0.55 - t * 0.2) continue;
          ctx.fillStyle = win > 0.3 ? `rgba(255,186,96,${0.35 + lit * 0.5})` : `rgba(126,210,255,${0.18 + lit * 0.25})`;
          const wx = x + 8 + c * ((bw - 16) / cols);
          const wy = base - bh + 12 + r * 16;
          ctx.fillRect(wx, wy, Math.max(4, bw / cols - 8), 7);
        }
      }
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const { w, h, ground } = this.view;
    const t = this.night();
    ctx.fillStyle = mix("#1a2230", "#10141c", t);
    ctx.fillRect(-20, ground, w + 40, h - ground + 40);
    ctx.fillStyle = mix("#f0b27a", "#5ee0b5", t);
    ctx.fillRect(-20, ground - 4, w + 40, 4);
    ctx.fillStyle = mix("#121822", "#0c1016", t);
    const plank = 46;
    const offset = this.scroll % plank;
    for (let x = -offset; x < w + plank; x += plank) {
      ctx.fillRect(x, ground + 10, plank - 6, h);
    }
    ctx.strokeStyle = mix("rgba(246,241,231,0.18)", "rgba(94,224,181,0.35)", t);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ground + 28);
    ctx.lineTo(w, ground + 28);
    ctx.stroke();
    const dash = 26;
    const gap = 20;
    const period = dash + gap;
    const doff = this.scroll % period;
    ctx.fillStyle = mix("#f2c14e", "#5ee0b5", t);
    for (let x = -doff; x < w + period; x += period) {
      let draw = true;
      const world = this.scroll + x + dash / 2;
      if (this.inPit(world)) draw = false;
      if (draw) ctx.fillRect(x, ground + 24, dash, 4);
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D): void {
    const ground = this.view.ground;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      const x = o.x - this.scroll;
      if (x > this.view.w + 80 || x + o.w < -80) continue;
      if (o.kind === "pit") {
        ctx.fillStyle = "#07090e";
        ctx.fillRect(x, ground - 4, o.w, this.view.h - ground + 20);
        ctx.fillStyle = "#2a3344";
        ctx.fillRect(x - 6, ground - 8, 10, 18);
        ctx.fillRect(x + o.w - 4, ground - 8, 10, 18);
        ctx.fillStyle = "#ff6a3d";
        ctx.fillRect(x - 6, ground - 8, 10, 3);
        ctx.fillRect(x + o.w - 4, ground - 8, 10, 3);
        continue;
      }
      if (o.kind === "beam") {
        const bottom = ground - o.h;
        const top = bottom - o.thick;
        ctx.strokeStyle = "#8b93a7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 12, top);
        ctx.lineTo(x + 12, 18);
        ctx.moveTo(x + o.w - 12, top);
        ctx.lineTo(x + o.w - 12, 28);
        ctx.stroke();
        ctx.fillStyle = "#2c3548";
        ctx.fillRect(x, top, o.w, o.thick);
        const stripes = Math.ceil(o.w / 16);
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 === 0 ? "#f2c14e" : "#1a120e";
          ctx.fillRect(x + i * 16, top + o.thick - 10, 16, 10);
        }
        ctx.fillStyle = "#f6f1e7";
        ctx.fillRect(x, top, o.w, 3);
        continue;
      }
      const top = ground - o.h;
      ctx.fillStyle = "#1e2838";
      ctx.fillRect(x + o.w * 0.18, top + 10, o.w * 0.82, o.h);
      ctx.fillStyle = o.kind === "tall" ? "#314056" : "#3a4a63";
      ctx.beginPath();
      ctx.roundRect(x, top, o.w * 0.84, o.h, 6);
      ctx.fill();
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(x, top + o.h * 0.42, o.w * 0.84, 7);
      ctx.fillStyle = "#ff6a3d";
      ctx.fillRect(x + 8, top + 8, 10, 10);
    }
  }

  private drawWing(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
    const tw = 0.55 + Math.sin(this.time * 9 + phase) * 0.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.3 + tw * 0.45;
    ctx.fillStyle = "#ffe56a";
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffe14a";
    ctx.beginPath();
    ctx.moveTo(8, -18);
    ctx.lineTo(-4, -2);
    ctx.lineTo(5, -2);
    ctx.lineTo(-10, 18);
    ctx.lineTo(3, 1);
    ctx.lineTo(-6, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fffaf0";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = this.time * 4 + phase + i * 1.57;
      const rr = 20 + (i % 2) * 7;
      ctx.globalAlpha = 0.4 + tw * 0.6;
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#ffe56a";
      ctx.fillRect(Math.cos(a) * rr - 1.6, Math.sin(a) * rr - 1.6, 3.2, 3.2);
    }
    ctx.restore();
  }

  private drawSparks(ctx: CanvasRenderingContext2D): void {
    const ground = this.view.ground;
    for (const s of this.sparks) {
      if (!s.alive) continue;
      const x = s.x - this.scroll;
      const bob = Math.sin(this.time * 5 + s.phase) * 4;
      const y = ground - s.y - bob;
      if (s.wing) {
        this.drawWing(ctx, x, y, s.phase);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,93,122,0.28)";
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#ff5d7a";
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-18, -6, -10, -18, 0, -8);
      ctx.bezierCurveTo(10, -18, 18, -6, 0, 8);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, front: boolean): void {
    const ground = this.view.ground;
    for (const p of this.particles) {
      if (!p.alive || p.front !== front) continue;
      const alpha = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - this.scroll, ground - p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const ground = this.view.ground;
    const falling = this.mode === "tumble" || this.mode === "over";
    const spin = falling ? Math.min(this.tumbleT, 0.46) : 0;
    const lift = falling ? Math.sin((spin / 0.46) * Math.PI) * 36 : 0;
    const { sx, sy } = falling ? { sx: 1, sy: 1 } : this.bodyScale();

    const R = 40;
    ctx.save();
    ctx.translate(this.px + (falling ? -spin * 36 : 0), ground - this.feet - lift);
    const shade = clamp(1 - this.feet / 200, 0.35, 1);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 26 * sx * shade, 6.5 * shade, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(falling ? spin * 2.1 : clamp(this.flying ? -this.flightVy / 700 : 0, -0.65, 0.45));

    if (this.flying && !falling) {
      ctx.save();
      ctx.translate(0, -40);
      ctx.fillStyle = "#ffe14a";
      ctx.beginPath();
      ctx.moveTo(16, -36);
      ctx.lineTo(-6, -4);
      ctx.lineTo(10, -4);
      ctx.lineTo(-18, 36);
      ctx.lineTo(6, 2);
      ctx.lineTo(-12, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.scale(sx, sy);
    ctx.translate(0, -R);

    const pulse = Math.sin(this.time * 2.1) * 0.5 + 0.5;
    const flicker = Math.pow(Math.abs(Math.sin(this.time * 16)), 1.4);
    ctx.save();
    ctx.scale(1 / sx, 1 / sy);
    if (this.shields > 0 && !falling) this.drawNeon(ctx, "126,224,192", R + 16, pulse, flicker, "glow");
    if (this.flying && !falling) this.drawNeon(ctx, "255,220,70", R + 52, pulse, flicker, "glow");
    ctx.restore();

    ctx.fillStyle = this.flash > 0.45 && this.mode !== "menu" ? "#ffffff" : this.bodyFill();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();

    if (this.shields > 0 && !falling) {
      ctx.save();
      ctx.scale(1 / sx, 1 / sy);
      this.drawNeon(ctx, "126,224,192", R + 16, pulse, Math.abs(Math.sin(this.time * 13)), "line");
      ctx.restore();
    }
    if (this.flying && !falling) {
      ctx.save();
      ctx.scale(1 / sx, 1 / sy);
      this.drawNeon(ctx, "255,220,70", R + 52, pulse, flicker, "line");
      ctx.restore();
    }

    const cycle = this.time % 3.1;
    const blink = !falling && ((cycle > 2.42 && cycle < 2.56) || (cycle > 2.7 && cycle < 2.84));
    const lookY = !this.grounded && this.feet > 6 ? -1.4 : 0;
    const eyes = [
      { x: -1, y: 2 },
      { x: 22, y: 2 },
    ];
    for (const eye of eyes) {
      ctx.save();
      ctx.translate(eye.x, eye.y);
      ctx.scale(1 / sx, 1 / sy);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a120e";
      ctx.fillStyle = "#1a120e";
      ctx.lineWidth = 3.2;
      if (falling) {
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(-6.4, -12);
        ctx.lineTo(6.4, 12);
        ctx.moveTo(6.4, -12);
        ctx.lineTo(-6.4, 12);
        ctx.stroke();
      } else if (blink) {
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.4, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f6f1e7";
        ctx.beginPath();
        ctx.ellipse(1.9, -4.1 + lookY, 2.7, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawNeon(
    ctx: CanvasRenderingContext2D,
    rgb: string,
    lineR: number,
    pulse: number,
    flicker: number,
    part: "glow" | "line",
  ): void {
    const spread = 26 + pulse * 42;
    const outer = lineR + spread;
    if (part === "glow") {
      const g = ctx.createRadialGradient(0, 0, lineR * 0.2, 0, 0, outer);
      g.addColorStop(0, `rgba(${rgb},${0.62 + pulse * 0.28})`);
      g.addColorStop(0.42, `rgba(${rgb},0.22)`);
      g.addColorStop(0.78, `rgba(${rgb},0.08)`);
      g.addColorStop(1, `rgba(${rgb},${0.01 + flicker * 0.18})`);
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(0, 0, outer, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${rgb},0.95)`;
    ctx.arc(0, 0, lineR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.12 + flicker * 0.88;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${rgb},1)`;
    ctx.arc(0, 0, outer, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawStreaks(ctx: CanvasRenderingContext2D): void {
    const d = this.mode === "run" ? this.difficulty() : 0;
    if (d < 0.28) return;
    ctx.strokeStyle = `rgba(246,241,231,${0.08 + d * 0.18})`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const s of this.streaks) {
      let x = s.x - this.scroll * (1.05 + d * 0.3);
      const span = this.view.w + 200;
      x = ((x % span) + span) % span - 40;
      ctx.beginPath();
      ctx.moveTo(x, s.y);
      ctx.lineTo(x + s.len * (0.6 + d), s.y);
      ctx.stroke();
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.font = "700 18px 'IBM Plex Sans KR', sans-serif";
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      if (!f.alive) continue;
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
