import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as ArrowDown, i as Trophy, n as VolumeX, o as RotateCcw, r as Volume2, s as ArrowUp, t as Zap } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B3aWWJuN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KEY = "lumen-run-save";
var VERSION = 1;
var defaults = {
	version: VERSION,
	best: 0,
	bestCombo: 0,
	bestDistance: 0,
	muted: false
};
function finite(n, fallback = 0) {
	return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function loadSave() {
	if (typeof localStorage === "undefined") return { ...defaults };
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { ...defaults };
		const parsed = JSON.parse(raw);
		let version = finite(parsed.version, 0);
		const next = {
			version,
			best: finite(parsed.best),
			bestCombo: finite(parsed.bestCombo),
			bestDistance: finite(parsed.bestDistance),
			muted: Boolean(parsed.muted)
		};
		if (version < 1) {
			next.version = 1;
			version = 1;
		}
		next.version = VERSION;
		return next;
	} catch {
		return { ...defaults };
	}
}
function writeSave(data) {
	if (typeof localStorage === "undefined") return;
	try {
		const payload = {
			...data,
			version: VERSION
		};
		localStorage.setItem(KEY, JSON.stringify(payload));
		localStorage.setItem(`${KEY}-bak`, JSON.stringify(payload));
	} catch {}
}
var bus = null;
var muted = false;
function ctxCtor() {
	if (typeof window === "undefined") return null;
	const w = window;
	return w.AudioContext ?? w.webkitAudioContext ?? null;
}
function makeNoise(ctx) {
	const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .4), ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	return buffer;
}
function unlockAudio() {
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
		sfx.gain.value = .9;
		music.gain.value = .4;
		bus = {
			ctx,
			master,
			sfx,
			music,
			noise: makeNoise(ctx)
		};
	}
	if (bus.ctx.state === "suspended") bus.ctx.resume();
}
function resumeAudio() {
	if (bus && bus.ctx.state === "suspended") bus.ctx.resume();
}
function setMuted(next) {
	muted = next;
	if (!bus) return;
	bus.master.gain.setTargetAtTime(next ? 0 : 1, bus.ctx.currentTime, .02);
}
function envGain(target, peak, dur, attack = .008) {
	const ctx = bus.ctx;
	const g = ctx.createGain();
	const t = ctx.currentTime;
	g.gain.setValueAtTime(1e-4, t);
	g.gain.exponentialRampToValueAtTime(Math.max(.001, peak), t + attack);
	g.gain.exponentialRampToValueAtTime(1e-4, t + Math.max(attack + .01, dur));
	g.connect(target);
	return g;
}
function tone(freq, dur, type, peak, slideTo) {
	if (!bus || muted) return;
	const ctx = bus.ctx;
	const osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, ctx.currentTime);
	if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + dur);
	const g = envGain(bus.sfx, peak, dur);
	osc.connect(g);
	osc.start();
	osc.stop(ctx.currentTime + dur + .02);
	osc.onended = () => {
		osc.disconnect();
		g.disconnect();
	};
}
function musicTone(freq, dur, peak) {
	if (!bus || muted) return;
	const ctx = bus.ctx;
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(freq, ctx.currentTime);
	const g = envGain(bus.music, peak, dur, .01);
	osc.connect(g);
	osc.start();
	osc.stop(ctx.currentTime + dur + .02);
	osc.onended = () => {
		osc.disconnect();
		g.disconnect();
	};
}
function noiseBurst(dur, peak, freq) {
	if (!bus || muted) return;
	const ctx = bus.ctx;
	const src = ctx.createBufferSource();
	src.buffer = bus.noise;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = freq;
	filter.Q.value = .7;
	const g = envGain(bus.sfx, peak, dur, .004);
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
var sfx = {
	jump() {
		tone(260, .11, "square", .055, 680);
	},
	land(impact) {
		const peak = Math.min(.14, .04 + impact / 5e3);
		tone(130, .09, "sine", peak, 62);
		noiseBurst(.05, peak * .55, 380);
	},
	slide() {
		noiseBurst(.13, .045, 980);
	},
	spark(combo) {
		const f = 640 + Math.min(combo, 16) * 26;
		tone(f, .08, "sine", .055, f * 1.45);
	},
	clear(combo) {
		tone(400 + Math.min(combo, 24) * 16, .06, "triangle", .04);
	},
	near() {
		tone(860, .1, "sine", .05, 1380);
	},
	hit() {
		noiseBurst(.24, .16, 220);
		tone(170, .26, "sawtooth", .07, 48);
	},
	tick(beat) {
		const scale = [
			196,
			247,
			294,
			330,
			392
		];
		musicTone(scale[beat % scale.length] ?? 196, .1, .02);
	}
};
var GRAVITY = 2800;
var JUMP_V = 980;
var COYOTE = .11;
var BUFFER = .13;
var SLIDE_DUR = .56;
var SLIDE_LOCK = .08;
var MIN_SPEED = 460;
var MAX_SPEED = 900;
var RAMP = 23;
var CHAIN = 2.7;
function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n));
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function hash(n) {
	let x = Math.imul(n | 0, 374761393) + 668265263;
	x = Math.imul(x ^ x >>> 13, 1274126177);
	return ((x ^ x >>> 16) >>> 0) / 4294967296;
}
function mix(a, b, t) {
	const pa = parseInt(a.slice(1), 16);
	const pb = parseInt(b.slice(1), 16);
	const ar = pa >> 16 & 255;
	const ag = pa >> 8 & 255;
	const ab = pa & 255;
	const br = pb >> 16 & 255;
	const bg = pb >> 8 & 255;
	const bb = pb & 255;
	return `rgb(${Math.round(lerp(ar, br, t))},${Math.round(lerp(ag, bg, t))},${Math.round(lerp(ab, bb, t))})`;
}
function makeObs() {
	return {
		alive: false,
		kind: "low",
		x: 0,
		w: 0,
		h: 0,
		thick: 36,
		scored: false,
		near: false
	};
}
function makeSpark() {
	return {
		alive: false,
		x: 0,
		y: 0,
		phase: 0
	};
}
function makeParticle() {
	return {
		alive: false,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		g: 0,
		life: 0,
		max: 1,
		size: 3,
		color: "#fff",
		front: false
	};
}
function makeFloater() {
	return {
		alive: false,
		x: 0,
		y: 0,
		vy: 0,
		life: 0,
		max: 1,
		text: "",
		color: "#fff"
	};
}
var Runner = class {
	canvas;
	ctx;
	onFrame;
	raf = 0;
	last = 0;
	running = false;
	dpr = 1;
	cssW = 1;
	cssH = 1;
	view = {
		w: 960,
		h: 540,
		ground: 420,
		scale: 1
	};
	reduced = false;
	mode = "menu";
	save;
	bestAtStart = 0;
	score = 0;
	scoreAcc = 0;
	combo = 0;
	peakCombo = 0;
	chain = 0;
	distance = 0;
	newBest = false;
	muted;
	reason = "";
	dirty = false;
	saveTimer = 0;
	scroll = 0;
	speed = 240;
	displaySpeed = MIN_SPEED;
	runTime = 0;
	time = 0;
	px = 220;
	feet = 0;
	vy = 0;
	grounded = true;
	coyote = COYOTE;
	jumpBuffer = 0;
	slideT = 0;
	slideBlend = 0;
	slideLock = 0;
	slideQueued = false;
	phase = 0;
	jumpStretch = 0;
	landSquash = 0;
	trauma = 0;
	flash = 0;
	hitTimer = 0;
	tumbleT = 0;
	dustAcc = 0;
	beatAcc = 0;
	beat = 0;
	nextX = 1200;
	lastKind = "";
	obstacles = Array.from({ length: 18 }, makeObs);
	sparks = Array.from({ length: 28 }, makeSpark);
	particles = Array.from({ length: 160 }, makeParticle);
	floaters = Array.from({ length: 10 }, makeFloater);
	scarf = Array.from({ length: 12 }, () => ({
		x: 180,
		y: 300
	}));
	scarfI = 0;
	scarfAcc = 0;
	streaks = Array.from({ length: 16 }, () => ({
		x: 0,
		y: 0,
		len: 40
	}));
	onKeyDown;
	onResize;
	onVis;
	ro = null;
	constructor(canvas, onFrame) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.onFrame = onFrame;
		this.save = loadSave();
		this.muted = this.save.muted;
		this.bestAtStart = this.save.best;
		setMuted(this.muted);
		this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
		this.onKeyDown = (e) => this.keyDown(e);
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
	start() {
		if (this.running) return;
		this.running = true;
		this.resize();
		this.seedStreaks();
		this.placeScarf();
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
	stop() {
		this.running = false;
		cancelAnimationFrame(this.raf);
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener("visibilitychange", this.onVis);
		this.ro?.disconnect();
		this.persist(true);
	}
	jump() {
		unlockAudio();
		if (this.mode === "menu" || this.mode === "over") {
			this.begin();
			this.jumpBuffer = BUFFER;
			return;
		}
		if (this.mode !== "run") return;
		this.jumpBuffer = BUFFER;
	}
	slide() {
		unlockAudio();
		if (this.mode === "menu" || this.mode === "over") {
			this.begin();
			return;
		}
		if (this.mode !== "run") return;
		this.slideQueued = true;
	}
	begin() {
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
		this.slideT = 0;
		this.slideBlend = 0;
		this.slideLock = 0;
		this.slideQueued = false;
		this.jumpStretch = 0;
		this.landSquash = .2;
		this.trauma = 0;
		this.flash = 0;
		this.hitTimer = 0;
		this.tumbleT = 0;
		this.reason = "";
		this.newBest = false;
		this.bestAtStart = this.save.best;
		this.speed = MIN_SPEED;
		this.displaySpeed = MIN_SPEED;
		this.dustAcc = 0;
		this.beatAcc = 0;
		for (const o of this.obstacles) o.alive = false;
		for (const s of this.sparks) s.alive = false;
		for (const f of this.floaters) f.alive = false;
		this.lastKind = "";
		this.nextX = this.scroll + this.view.w * .98;
		this.placeScarf();
		this.emit();
	}
	toggleMute() {
		this.muted = !this.muted;
		this.save.muted = this.muted;
		setMuted(this.muted);
		if (!this.muted) unlockAudio();
		this.dirty = true;
		this.persist(true);
		this.emit();
	}
	loop(now) {
		if (!this.running) return;
		const dt = Math.min(.1, (now - this.last) / 1e3);
		this.last = now;
		this.frame(dt);
		this.raf = requestAnimationFrame((t) => this.loop(t));
	}
	frame(dt) {
		this.time += dt;
		if (this.cssW < 2 || this.cssH < 2) {
			this.draw();
			return;
		}
		if (document.hidden) {
			this.draw();
			return;
		}
		if (this.mode === "hitstop") {
			this.hitTimer -= dt;
			this.trauma = Math.max(0, this.trauma - dt * .6);
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
			this.updateScarf(dt);
			if (this.tumbleT > .78) this.finish();
			this.draw();
			this.emit();
			return;
		}
		if (this.mode === "over") {
			this.scroll += 36 * dt;
			this.phase += dt * 2;
			this.updateParticles(dt);
			this.updateFloaters(dt);
			this.updateScarf(dt);
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
	step(h) {
		this.jumpStretch = Math.max(0, this.jumpStretch - h * 3.2);
		this.landSquash = Math.max(0, this.landSquash - h * 4);
		const slideTarget = this.slideT > 0 ? 1 : 0;
		this.slideBlend += (slideTarget - this.slideBlend) * Math.min(1, h * 14);
		this.trauma = Math.max(0, this.trauma - h * 1.6);
		this.updateScarf(h);
		this.updateParticles(h);
		this.updateFloaters(h);
		if (this.mode === "menu") {
			this.speed = 230;
			this.scroll += this.speed * h;
			this.phase += h * 11;
			this.feet = 0;
			this.grounded = true;
			this.spawnDust(h, .5);
			return;
		}
		this.runTime += h;
		this.speed = Math.min(MAX_SPEED, MIN_SPEED + this.runTime * RAMP);
		this.displaySpeed = this.speed;
		this.jumpBuffer = Math.max(0, this.jumpBuffer - h);
		this.slideLock = Math.max(0, this.slideLock - h);
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
				this.puff(6, "#f6f1e7", .35);
			}
		}
		if (this.jumpBuffer > 0 && this.canJump()) this.doJump();
		if (!(this.grounded && this.feet <= 0 && this.vy <= 0)) {
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
			if (wasAir) this.onLand(impact);
		} else {
			const wasGround = this.grounded;
			this.grounded = false;
			if (wasGround && this.feet <= 2) this.coyote = COYOTE;
			if (!supported && this.feet < -52 && this.vy < 0) {
				this.die("pit");
				return;
			}
		}
		if (this.grounded && this.slideT <= 0) this.phase += h * (10 + this.speed * .012);
		else this.phase += h * 3.2;
		this.scroll += this.speed * h;
		this.distance += this.speed * h / 52;
		const mult = Math.min(8, 1 + this.combo * .16);
		this.scoreAcc += h * this.speed * .062 * mult;
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
		this.collide(h);
		if (this.mode !== "run") return;
		this.collectSparks();
		this.scorePasses();
		this.spawnIfNeeded();
		this.recycle();
		if (this.grounded && this.slideT <= 0) this.spawnDust(h, 1);
		this.beatAcc += h;
		const interval = lerp(.5, .28, this.difficulty());
		if (this.beatAcc >= interval) {
			this.beatAcc = 0;
			this.beat += 1;
			sfx.tick(this.beat);
		}
		this.saveTimer -= h;
		if (this.dirty && this.saveTimer <= 0) this.persist(false);
	}
	canJump() {
		return (this.grounded || this.coyote > 0) && this.slideLock <= 0;
	}
	doJump() {
		this.vy = JUMP_V;
		this.feet = Math.max(this.feet, 0);
		this.grounded = false;
		this.coyote = 0;
		this.jumpBuffer = 0;
		this.slideT = 0;
		this.jumpStretch = 1;
		this.landSquash = 0;
		sfx.jump();
		this.puff(8, "#ffd7c2", .4);
	}
	onLand(impact) {
		this.landSquash = clamp(impact / 1400, .35, 1);
		this.jumpStretch = 0;
		if (impact > 120) {
			sfx.land(impact);
			this.puff(10, "#c9d2e0", .45);
		}
	}
	crouched() {
		return this.slideT > 0 || this.slideBlend > .35;
	}
	hurt() {
		if (this.crouched()) return {
			top: 34,
			bottom: 2,
			halfW: 26
		};
		return {
			top: 92,
			bottom: 4,
			halfW: 16
		};
	}
	hasGround(worldX) {
		return [
			worldX - 14,
			worldX,
			worldX + 14
		].some((wx) => !this.inPit(wx));
	}
	inPit(wx) {
		for (const o of this.obstacles) {
			if (!o.alive || o.kind !== "pit") continue;
			if (wx > o.x + 10 && wx < o.x + o.w - 10) return true;
		}
		return false;
	}
	collide(h) {
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
			if (Math.max(left + o.w, prevLeft + o.w) <= pL || sL >= pR) continue;
			if (o.kind === "beam") {
				const beamBottom = o.h;
				const beamTop = o.h + o.thick;
				if (top <= beamBottom + 6 && beamBottom - top < 18 && top > beamBottom - 22) o.near = true;
				if (top > beamBottom + 8 && bottom < beamTop) {
					this.die("beam");
					return;
				}
			} else {
				if (bottom < o.h - 8 && top > 4) {
					this.die(o.kind === "tall" ? "crate" : "crate");
					return;
				}
				if (bottom < o.h + 16 && bottom >= o.h - 8) o.near = true;
			}
		}
	}
	die(reason) {
		if (this.mode !== "run") return;
		this.mode = "hitstop";
		this.hitTimer = this.reduced ? .04 : .08;
		this.reason = reason;
		this.trauma = Math.min(1, this.trauma + .82);
		this.flash = 1;
		this.jumpBuffer = 0;
		this.slideQueued = false;
		if (this.feet < 0) this.feet = 0;
		sfx.hit();
		this.puff(22, reason === "pit" ? "#8ea0b8" : "#ff6a3d", 1);
		this.floater(reason === "pit" ? "낙하" : "충돌", this.px, this.view.ground - this.feet - 80, "#f6f1e7");
	}
	finish() {
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
	scorePasses() {
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
	collectSparks() {
		const crouched = this.crouched();
		const cy = this.feet + (crouched ? 24 : 62);
		for (const s of this.sparks) {
			if (!s.alive) continue;
			const sx = s.x - this.scroll;
			const dx = sx - this.px;
			const dy = s.y - cy;
			if (dx * dx + dy * dy > 1296) continue;
			s.alive = false;
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
	difficulty() {
		return clamp((this.speed - MIN_SPEED) / 440, 0, 1);
	}
	gapAfter(kind) {
		const d = this.difficulty();
		let t = lerp(.8, .48, d);
		if (kind === "tall") t = Math.max(t, .84);
		else if (kind === "beam") t = Math.max(t, .66);
		else if (kind === "pit") t = Math.max(t, .6);
		else t = Math.max(t, lerp(.74, .44, d));
		if (this.lastKind === "beam" && (kind === "low" || kind === "tall")) t = Math.max(t, .7);
		if (this.lastKind === "tall") t = Math.max(t, .78);
		return Math.max(170, this.speed * t);
	}
	pickKind() {
		const d = this.difficulty();
		const r = Math.random();
		if (d < .16) return "low";
		if (d < .36) return r < .64 ? "low" : "beam";
		if (d < .62) {
			if (r < .32) return "low";
			if (r < .55) return "beam";
			if (r < .76) return "tall";
			return "pit";
		}
		if (r < .26) return "low";
		if (r < .48) return "beam";
		if (r < .68) return "tall";
		if (r < .88) return "pit";
		return "beam";
	}
	spawnIfNeeded() {
		const horizon = this.scroll + this.view.w + 70;
		let guard = 0;
		while (this.nextX < horizon && guard++ < 4) this.spawnOne();
	}
	spawnOne() {
		const d = this.difficulty();
		const kind = this.pickKind();
		const o = this.alloc(this.obstacles, makeObs);
		o.alive = true;
		o.kind = kind;
		o.x = Math.max(this.nextX, this.scroll + this.view.w * .86);
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
			const air = 2 * JUMP_V / GRAVITY;
			const reach = this.speed * air * .48;
			o.w = clamp(100 + d * 100, 96, Math.min(210, reach));
			o.h = 0;
		}
		const gap = this.gapAfter(kind);
		this.nextX = o.x + o.w + gap;
		this.lastKind = kind;
		if (kind === "low" && Math.random() < .7) {
			this.addSpark(o.x + o.w * .5, o.h + 48);
			if (d > .3 && Math.random() < .5) this.addSpark(o.x + o.w * .5 - 28, o.h + 78);
		} else if (kind !== "pit" && Math.random() < .4) this.addSpark(o.x + o.w + gap * .42, 28);
	}
	addSpark(x, y) {
		const s = this.alloc(this.sparks, makeSpark);
		s.alive = true;
		s.x = x;
		s.y = y;
		s.phase = Math.random() * Math.PI * 2;
	}
	recycle() {
		const limit = this.scroll - 160;
		for (const o of this.obstacles) if (o.alive && o.x + o.w < limit) o.alive = false;
		for (const s of this.sparks) if (s.alive && s.x < limit) s.alive = false;
	}
	alloc(pool, make) {
		for (const item of pool) if (!item.alive) return item;
		const extra = make();
		pool.push(extra);
		return extra;
	}
	puff(n, color, spread) {
		this.burstAt(this.scroll + this.px, this.feet + 8, n, color, spread);
	}
	burstAt(worldX, height, n, color, spread = 1) {
		const count = this.reduced ? Math.ceil(n * .4) : n;
		for (let i = 0; i < count; i++) {
			const p = this.alloc(this.particles, makeParticle);
			const a = Math.random() * Math.PI * 2;
			const sp = (80 + Math.random() * 220) * spread;
			p.alive = true;
			p.x = worldX + (Math.random() - .5) * 16;
			p.y = height;
			p.vx = Math.cos(a) * sp;
			p.vy = Math.abs(Math.sin(a)) * sp * .8;
			p.g = 420;
			p.life = .35 + Math.random() * .35;
			p.max = p.life;
			p.size = 2 + Math.random() * 3.5;
			p.color = color;
			p.front = Math.random() > .35;
		}
	}
	spawnDust(h, rate) {
		this.dustAcc += h * rate;
		const every = .07;
		while (this.dustAcc >= every) {
			this.dustAcc -= every;
			const p = this.alloc(this.particles, makeParticle);
			p.alive = true;
			p.x = this.scroll + this.px - 16;
			p.y = 3 + Math.random() * 6;
			p.vx = -30 - Math.random() * 50;
			p.vy = 20 + Math.random() * 40;
			p.g = 220;
			p.life = .28;
			p.max = .28;
			p.size = 2.5;
			p.color = "#9aa6ba";
			p.front = false;
		}
	}
	updateParticles(h) {
		for (const p of this.particles) {
			if (!p.alive) continue;
			p.vy -= p.g * h;
			p.x += p.vx * h;
			p.y += p.vy * h;
			if (p.y < 0) {
				p.y = 0;
				p.vy *= -.25;
				p.vx *= .8;
			}
			p.life -= h;
			if (p.life <= 0) p.alive = false;
		}
	}
	floater(text, x, y, color) {
		const f = this.alloc(this.floaters, makeFloater);
		f.alive = true;
		f.text = text;
		f.x = x;
		f.y = y;
		f.vy = -52;
		f.life = .62;
		f.max = .62;
		f.color = color;
	}
	updateFloaters(h) {
		for (const f of this.floaters) {
			if (!f.alive) continue;
			f.y += f.vy * h;
			f.life -= h;
			if (f.life <= 0) f.alive = false;
		}
	}
	updateScarf(h) {
		const wind = (this.mode === "menu" ? 230 : this.speed) * h * .22;
		for (const p of this.scarf) p.x -= wind;
		this.scarfAcc += h;
		if (this.scarfAcc < .018) return;
		this.scarfAcc = 0;
		const neck = this.neck();
		const p = this.scarf[this.scarfI];
		p.x = neck.x;
		p.y = neck.y;
		this.scarfI = (this.scarfI + 1) % this.scarf.length;
	}
	neck() {
		const lift = this.mode === "tumble" ? Math.sin(Math.min(1, this.tumbleT) * Math.PI) * 64 : 0;
		const y = this.view.ground - this.feet - lift - lerp(78, 36, this.slideBlend);
		return {
			x: this.px + lerp(8, 36, this.slideBlend),
			y
		};
	}
	placeScarf() {
		const n = this.neck();
		this.scarf.forEach((p, i) => {
			p.x = n.x - i * 8;
			p.y = n.y + i * 2;
		});
	}
	night() {
		if (this.mode === "menu") return .12;
		return this.difficulty();
	}
	seedStreaks() {
		this.streaks.forEach((s, i) => {
			s.x = this.scroll + Math.random() * this.view.w;
			s.y = 40 + Math.random() * (this.view.ground - 80);
			s.len = 30 + i % 5 * 16;
		});
	}
	resize() {
		const rect = this.canvas.getBoundingClientRect();
		this.cssW = Math.max(1, rect.width);
		this.cssH = Math.max(1, rect.height);
		this.dpr = Math.min(2, window.devicePixelRatio || 1);
		this.canvas.width = Math.floor(this.cssW * this.dpr);
		this.canvas.height = Math.floor(this.cssH * this.dpr);
		const worldW = this.cssW < 720 ? 880 : this.cssW < 1200 ? 1e3 : 1120;
		const scale = this.cssW / worldW;
		this.view.w = worldW;
		this.view.scale = scale;
		this.view.h = this.cssH / scale;
		this.view.ground = this.view.h * .76;
		this.px = worldW * .24;
	}
	persist(force) {
		if (!this.dirty && !force) return;
		this.save.muted = this.muted;
		this.save.best = Math.max(this.save.best, Math.floor(this.score));
		writeSave(this.save);
		this.dirty = false;
		this.saveTimer = 2;
	}
	keyDown(e) {
		const target = e.target;
		if (target && (target.tagName === "BUTTON" || target.tagName === "A" || target.tagName === "INPUT")) return;
		if (e.repeat) return;
		if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
			e.preventDefault();
			this.jump();
		} else if (e.code === "ArrowDown" || e.code === "KeyS") {
			e.preventDefault();
			this.slide();
		} else if ((e.code === "KeyR" || e.code === "Enter") && (this.mode === "over" || this.mode === "menu")) {
			e.preventDefault();
			this.begin();
		} else if (e.code === "KeyM") this.toggleMute();
	}
	snapshot() {
		const shown = this.mode === "run" ? this.speed : this.displaySpeed;
		const norm = this.mode === "menu" ? .08 : clamp((shown - MIN_SPEED) / 440, 0, 1);
		return {
			mode: this.mode,
			score: Math.floor(this.score),
			best: Math.floor(this.save.best),
			combo: this.combo,
			peakCombo: this.peakCombo,
			distance: Math.floor(this.distance),
			speedNorm: norm,
			speedMult: shown / MIN_SPEED,
			newBest: this.newBest,
			muted: this.muted,
			feet: this.feet,
			sliding: this.slideT > 0 || this.slideBlend > .5,
			reason: this.reason
		};
	}
	emit() {
		const snap = this.snapshot();
		if (typeof window !== "undefined") window.__lumen = snap;
		this.onFrame(snap);
	}
	draw() {
		const ctx = this.ctx;
		if (!ctx) return;
		const { w, h, scale } = this.view;
		const mag = this.trauma * this.trauma * (this.reduced ? 2 : 14);
		const ox = Math.sin(this.time * 43) * mag;
		const oy = Math.cos(this.time * 37) * mag * .75;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = "#10141c";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, ox * this.dpr, oy * this.dpr);
		this.drawSky(ctx);
		this.drawCelestial(ctx);
		this.drawBuildings(ctx, .16, true);
		this.drawBuildings(ctx, .4, false);
		this.drawGround(ctx);
		this.drawObstacles(ctx);
		this.drawSparks(ctx);
		this.drawParticles(ctx, false);
		this.drawScarf(ctx);
		this.drawPlayer(ctx);
		this.drawParticles(ctx, true);
		this.drawStreaks(ctx);
		this.drawFloaters(ctx);
		if (this.flash > .01) {
			ctx.fillStyle = `rgba(246,241,231,${this.flash * .38})`;
			ctx.fillRect(-20, -20, w + 40, h + 40);
		}
		const vig = ctx.createRadialGradient(w * .5, h * .55, w * .25, w * .5, h * .5, w * .72);
		vig.addColorStop(0, "rgba(0,0,0,0)");
		vig.addColorStop(1, "rgba(0,0,0,0.28)");
		ctx.fillStyle = vig;
		ctx.fillRect(-20, -20, w + 40, h + 40);
	}
	drawSky(ctx) {
		const t = this.night();
		const { w, h } = this.view;
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, mix("#1b3054", "#070a14", t));
		g.addColorStop(.45, mix("#3e628c", "#141c33", t));
		g.addColorStop(.72, mix("#e08a62", "#3a2744", t));
		g.addColorStop(1, mix("#f3c48a", "#6e4458", t));
		ctx.fillStyle = g;
		ctx.fillRect(-30, -30, w + 60, h + 60);
		if (t > .25) {
			const stars = 28;
			for (let i = 0; i < stars; i++) {
				const n = hash(i + 42);
				const n2 = hash(i + 90);
				ctx.fillStyle = `rgba(246,241,231,${(t - .25) * (.3 + n2 % 1 * .7)})`;
				ctx.fillRect(n * w % w, n2 * this.view.ground * .7 % (this.view.ground * .65), 1.6, 1.6);
			}
		}
	}
	drawCelestial(ctx) {
		const t = this.night();
		const { w, ground } = this.view;
		const x = lerp(w * .72, w * .28, t);
		const y = lerp(ground * .38, ground * .22, t);
		const r = lerp(36, 18, t);
		ctx.beginPath();
		ctx.fillStyle = mix("#ffe1a8", "#f6f1e7", t);
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.fillStyle = mix("rgba(255,210,150,0.25)", "rgba(180,200,255,0.18)", t);
		ctx.arc(x, y, r * 2.3, 0, Math.PI * 2);
		ctx.fill();
	}
	drawBuildings(ctx, parallax, far) {
		const t = this.night();
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
			const bw = span * (.62 + n * .34);
			const bh = (far ? 46 : 70) + n2 * (far ? 110 : 190);
			const x = i * span - lead;
			ctx.fillStyle = far ? mix("#24344c", "#121826", t) : mix("#1b2838", "#0d121b", t);
			ctx.fillRect(x, base - bh, bw, bh + 8);
			if (!far && n3 > .42) {
				const antenna = 16 + n3 * 28;
				ctx.fillStyle = mix("#31445c", "#1c2636", t);
				ctx.fillRect(x + bw * .45, base - bh - antenna, 3, antenna);
			}
			const lit = .25 + t * .75;
			const cols = 2 + Math.floor(n * 3);
			const rows = 2 + Math.floor(n2 * 5);
			for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
				const win = hash(i * 100 + c * 17 + r * 13 + salt);
				if (win > .55 - t * .2) continue;
				ctx.fillStyle = win > .3 ? `rgba(255,186,96,${.35 + lit * .5})` : `rgba(126,210,255,${.18 + lit * .25})`;
				const wx = x + 8 + c * ((bw - 16) / cols);
				const wy = base - bh + 12 + r * 16;
				ctx.fillRect(wx, wy, Math.max(4, bw / cols - 8), 7);
			}
		}
	}
	drawGround(ctx) {
		const { w, h, ground } = this.view;
		const t = this.night();
		ctx.fillStyle = mix("#1a2230", "#10141c", t);
		ctx.fillRect(-20, ground, w + 40, h - ground + 40);
		ctx.fillStyle = mix("#f0b27a", "#5ee0b5", t);
		ctx.fillRect(-20, ground - 4, w + 40, 4);
		ctx.fillStyle = mix("#121822", "#0c1016", t);
		const plank = 46;
		const offset = this.scroll % plank;
		for (let x = -offset; x < w + plank; x += plank) ctx.fillRect(x, ground + 10, 40, h);
		ctx.strokeStyle = mix("rgba(246,241,231,0.18)", "rgba(94,224,181,0.35)", t);
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, ground + 28);
		ctx.lineTo(w, ground + 28);
		ctx.stroke();
		const dash = 26;
		const period = 46;
		const doff = this.scroll % period;
		ctx.fillStyle = mix("#f2c14e", "#5ee0b5", t);
		for (let x = -doff; x < w + period; x += period) {
			let draw = true;
			const world = this.scroll + x + dash / 2;
			if (this.inPit(world)) draw = false;
			if (draw) ctx.fillRect(x, ground + 24, dash, 4);
		}
	}
	drawObstacles(ctx) {
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
				const top = ground - o.h - o.thick;
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
			ctx.fillRect(x + o.w * .18, top + 10, o.w * .82, o.h);
			ctx.fillStyle = o.kind === "tall" ? "#314056" : "#3a4a63";
			ctx.beginPath();
			ctx.roundRect(x, top, o.w * .84, o.h, 6);
			ctx.fill();
			ctx.fillStyle = "#f2c14e";
			ctx.fillRect(x, top + o.h * .42, o.w * .84, 7);
			ctx.fillStyle = "#ff6a3d";
			ctx.fillRect(x + 8, top + 8, 10, 10);
		}
	}
	drawSparks(ctx) {
		const ground = this.view.ground;
		for (const s of this.sparks) {
			if (!s.alive) continue;
			const x = s.x - this.scroll;
			const bob = Math.sin(this.time * 5 + s.phase) * 4;
			const y = ground - s.y - bob;
			ctx.beginPath();
			ctx.fillStyle = "rgba(94,224,181,0.28)";
			ctx.arc(x, y, 14, 0, Math.PI * 2);
			ctx.fill();
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(this.time * 2 + s.phase);
			ctx.fillStyle = "#f6f1e7";
			ctx.beginPath();
			ctx.moveTo(0, -7);
			ctx.lineTo(4.5, 0);
			ctx.lineTo(0, 7);
			ctx.lineTo(-4.5, 0);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = "#5ee0b5";
			ctx.beginPath();
			ctx.moveTo(0, -4);
			ctx.lineTo(2.4, 0);
			ctx.lineTo(0, 4);
			ctx.lineTo(-2.4, 0);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
	}
	drawParticles(ctx, front) {
		const ground = this.view.ground;
		for (const p of this.particles) {
			if (!p.alive || p.front !== front) continue;
			ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x - this.scroll, ground - p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
	}
	drawScarf(ctx) {
		ctx.beginPath();
		const len = this.scarf.length;
		for (let k = 0; k < len; k++) {
			const idx = (this.scarfI + k) % len;
			const p = this.scarf[idx];
			if (k === 0) ctx.moveTo(p.x, p.y);
			else ctx.lineTo(p.x, p.y);
		}
		ctx.strokeStyle = "#f2c14e";
		ctx.lineWidth = 6;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.stroke();
		ctx.strokeStyle = "#ffe3a3";
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	drawPlayer(ctx) {
		const ground = this.view.ground;
		const falling = this.mode === "tumble" || this.mode === "over";
		const spin = falling ? Math.min(this.tumbleT, .7) : 0;
		const lift = falling ? Math.sin(spin / .7 * Math.PI) * 64 : 0;
		const rot = spin * 2.35;
		const knock = falling ? -spin * 56 : 0;
		const sy = 1 + this.jumpStretch * .18 - this.landSquash * .26;
		const sx = 1 / sy;
		const slide = this.slideBlend;
		ctx.save();
		ctx.translate(this.px + knock + slide * 10, ground - this.feet - lift);
		ctx.rotate(rot - slide * 1.05);
		ctx.scale(sx * (1 + slide * .08), sy * (1 - slide * .42));
		if (this.flash > .4 && this.mode !== "menu") ctx.globalAlpha = .85;
		const tuck = this.grounded ? 0 : clamp(.25 + this.vy / JUMP_V, 0, .85);
		const shadowScale = clamp(1 - this.feet / 180, .35, 1) * (1 - slide * .3);
		ctx.save();
		ctx.scale(1 / sx, 1 / (sy || 1));
		ctx.fillStyle = "rgba(0,0,0,0.28)";
		ctx.beginPath();
		ctx.ellipse(0, 6, 22 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		const swing = Math.sin(this.phase);
		this.limb(ctx, -1, swing, tuck, slide);
		this.arm(ctx, -1, -swing, tuck, slide);
		this.torso(ctx);
		this.limb(ctx, 1, swing, tuck, slide);
		this.arm(ctx, 1, -swing, tuck, slide);
		this.head(ctx);
		ctx.restore();
	}
	limb(ctx, side, swing, tuck, slide) {
		const dir = side > 0 ? 0 : Math.PI;
		const hipAng = Math.sin(this.phase + dir) * .75 * (1 - tuck) * (1 - slide) + tuck * .85 - slide * .4;
		const hipX = side * 5;
		const hipY = -52;
		const thigh = 30;
		const shin = 28;
		const kx = hipX + Math.sin(hipAng) * thigh;
		const ky = hipY + Math.cos(hipAng) * thigh;
		const bend = .35 + Math.max(0, -Math.sin(this.phase + dir)) * .85 * (1 - slide) + tuck * 1.05 + slide * .8;
		const fx = kx + Math.sin(hipAng + bend) * shin;
		const fy = ky + Math.cos(hipAng + bend) * shin;
		ctx.strokeStyle = "#171c27";
		ctx.lineWidth = 9;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(hipX, hipY);
		ctx.lineTo(kx, ky);
		ctx.lineTo(fx, fy);
		ctx.stroke();
		ctx.fillStyle = "#f6f1e7";
		ctx.beginPath();
		ctx.ellipse(fx + 6, fy, 8, 4.2, hipAng * .2, 0, Math.PI * 2);
		ctx.fill();
	}
	arm(ctx, side, swing, tuck, slide) {
		const shoulderX = side * 8;
		const shoulderY = -78;
		const ang = swing * .9 * (1 - tuck) * (1 - slide) + tuck * -.6 + (side > 0 ? slide * .9 : -slide * .4);
		const len = 28;
		const hx = shoulderX + Math.sin(ang) * len;
		const hy = shoulderY + Math.cos(ang) * len;
		ctx.strokeStyle = side > 0 ? "#ff6a3d" : "#d84e28";
		ctx.lineWidth = 7;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(shoulderX, shoulderY);
		ctx.lineTo(hx, hy);
		ctx.stroke();
		ctx.fillStyle = "#f0c2a2";
		ctx.beginPath();
		ctx.arc(hx, hy, 4, 0, Math.PI * 2);
		ctx.fill();
	}
	torso(ctx) {
		ctx.fillStyle = "#ff6a3d";
		ctx.beginPath();
		ctx.roundRect(-16, -96, 32, 48, 12);
		ctx.fill();
		ctx.fillStyle = "#1c2330";
		ctx.beginPath();
		ctx.roundRect(-14, -58, 28, 16, 6);
		ctx.fill();
		ctx.fillStyle = "#5ee0b5";
		ctx.fillRect(-4, -86, 8, 12);
	}
	head(ctx) {
		ctx.fillStyle = "#f0c2a2";
		ctx.beginPath();
		ctx.arc(4, -110, 15, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#241c1a";
		ctx.beginPath();
		ctx.arc(2, -116, 14, Math.PI, Math.PI * 2);
		ctx.fill();
		ctx.fillRect(-8, -118, 22, 8);
		ctx.beginPath();
		ctx.moveTo(12, -118);
		ctx.quadraticCurveTo(24, -112, 18, -104);
		ctx.quadraticCurveTo(10, -110, 8, -116);
		ctx.fill();
		ctx.fillStyle = "#1a120e";
		ctx.beginPath();
		ctx.ellipse(12, -110, 2.3, 2.6, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#f6f1e7";
		ctx.fillRect(13.2, -111.2, 1.1, 1.1);
	}
	drawStreaks(ctx) {
		const d = this.mode === "run" ? this.difficulty() : 0;
		if (d < .28) return;
		ctx.strokeStyle = `rgba(246,241,231,${.08 + d * .18})`;
		ctx.lineWidth = 2;
		ctx.lineCap = "round";
		for (const s of this.streaks) {
			let x = s.x - this.scroll * (1.05 + d * .3);
			const span = this.view.w + 200;
			x = (x % span + span) % span - 40;
			ctx.beginPath();
			ctx.moveTo(x, s.y);
			ctx.lineTo(x + s.len * (.6 + d), s.y);
			ctx.stroke();
		}
	}
	drawFloaters(ctx) {
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
};
var initialHud = {
	mode: "menu",
	score: 0,
	best: 0,
	combo: 0,
	peakCombo: 0,
	distance: 0,
	newBest: false,
	muted: false,
	reason: ""
};
function fmt(n) {
	return Math.floor(n).toLocaleString("ko-KR");
}
function reasonCopy(reason) {
	if (reason === "beam") return "낮은 표지판에 부딪혔어요";
	if (reason === "pit") return "끊긴 지붕을 못 넘었어요";
	if (reason === "crate") return "상자에 걸렸어요";
	return "넘어졌어요";
}
function RunnerGame() {
	const canvasRef = (0, import_react.useRef)(null);
	const engineRef = (0, import_react.useRef)(null);
	const scoreRef = (0, import_react.useRef)(null);
	const bestRef = (0, import_react.useRef)(null);
	const distRef = (0, import_react.useRef)(null);
	const multRef = (0, import_react.useRef)(null);
	const barRef = (0, import_react.useRef)(null);
	const [hud, setHud] = (0, import_react.useState)(initialHud);
	const hudRef = (0, import_react.useRef)(hud);
	hudRef.current = hud;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let alive = true;
		const engine = new Runner(canvas, (s) => {
			if (!alive) return;
			if (scoreRef.current) scoreRef.current.textContent = fmt(s.score);
			if (bestRef.current) bestRef.current.textContent = fmt(s.best);
			if (distRef.current) distRef.current.textContent = `${fmt(s.distance)}m`;
			if (multRef.current) multRef.current.textContent = `×${s.speedMult.toFixed(2)}`;
			if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(.04, s.speedNorm)})`;
			const prev = hudRef.current;
			const score = s.mode === "run" ? prev.score : s.score;
			const distance = s.mode === "run" ? prev.distance : s.distance;
			if (prev.mode === s.mode && prev.combo === s.combo && prev.best === s.best && prev.muted === s.muted && prev.newBest === s.newBest && prev.peakCombo === s.peakCombo && prev.reason === s.reason && prev.score === score && prev.distance === distance) return;
			const next = {
				mode: s.mode,
				score,
				best: s.best,
				combo: s.combo,
				peakCombo: s.peakCombo,
				distance,
				newBest: s.newBest,
				muted: s.muted,
				reason: s.reason
			};
			hudRef.current = next;
			setHud(next);
		});
		engineRef.current = engine;
		engine.start();
		return () => {
			alive = false;
			engine.stop();
			engineRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let down = null;
		let used = false;
		const onDown = (e) => {
			if (e.button !== 0) return;
			down = {
				x: e.clientX,
				y: e.clientY,
				t: performance.now()
			};
			used = false;
		};
		const onMove = (e) => {
			if (!down || used) return;
			const dy = e.clientY - down.y;
			const dx = e.clientX - down.x;
			if (dy > 36 && dy > Math.abs(dx)) {
				used = true;
				engineRef.current?.slide();
			}
		};
		const onUp = (e) => {
			if (!down) return;
			const dy = e.clientY - down.y;
			const dx = e.clientX - down.x;
			const tap = Math.hypot(dx, dy) < 24 && performance.now() - down.t < 450;
			down = null;
			if (used) return;
			if (tap || dy <= 36) engineRef.current?.jump();
		};
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, []);
	const playing = hud.mode === "run" || hud.mode === "hitstop" || hud.mode === "tumble";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative h-dvh w-full overflow-hidden bg-bg text-fg select-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full touch-none",
				"aria-label": "루멘런 게임 화면"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-wide text-muted",
							children: "점수"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl leading-none text-fg sm:text-4xl",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								ref: scoreRef,
								children: "0"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: ["거리 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								ref: distRef,
								children: "0m"
							})]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center justify-center gap-1 text-xs font-medium text-accent",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, {
								className: "size-3.5",
								"aria-hidden": "true"
							}), "콤보"]
						}), hud.combo > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "combo-pop font-display text-4xl leading-none text-accent sm:text-5xl",
							children: hud.combo
						}, hud.combo) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-4xl leading-none text-muted sm:text-5xl",
							children: "0"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "flex items-center justify-end gap-1 text-xs font-medium text-gold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, {
									className: "size-3.5",
									"aria-hidden": "true"
								}), "최고"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-2xl leading-none text-gold sm:text-3xl",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									ref: bestRef,
									children: "0"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 ml-auto flex items-center justify-end gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									ref: multRef,
									className: "text-xs tabular-nums text-muted",
									children: "×1.00"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block h-1.5 w-16 overflow-hidden rounded-full bg-border",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										ref: barRef,
										className: "block h-full origin-left bg-primary",
										style: { transform: "scaleX(0.08)" }
									})
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: `z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg ${hud.mode === "menu" ? "absolute bottom-4 left-4" : "absolute top-20 right-4"}`,
				onClick: () => engineRef.current?.toggleMute(),
				"aria-label": hud.muted ? "소리 켜기" : "소리 끄기",
				children: hud.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
			}),
			hud.newBest && playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pointer-events-none absolute top-24 left-4 z-10 text-sm font-semibold text-gold",
				children: "최고 기록 경신 중"
			}) : null,
			hud.mode === "menu" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 z-20 flex items-start justify-center p-4 sm:items-center sm:justify-end sm:p-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel-in pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-primary",
							children: "ENDLESS ROOFTOP"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display mt-1 text-5xl leading-none text-fg",
							children: "루멘런"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm leading-relaxed text-muted",
							children: "상자는 점프, 머리 위 표지판은 슬라이드, 끊긴 지붕은 점프. 속도가 붙을수록 간격이 좁아집니다."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-4 grid grid-cols-3 gap-2 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, {
											className: "mx-auto size-4 text-primary",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "mt-1 text-sm font-semibold text-fg",
											children: "점프"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "text-xs text-muted",
											children: "탭 · 스페이스"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, {
											className: "mx-auto size-4 text-gold",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "mt-1 text-sm font-semibold text-fg",
											children: "슬라이드"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "text-xs text-muted",
											children: "스와이프 · ↓"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, {
											className: "mx-auto size-4 text-accent",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "mt-1 text-sm font-semibold text-fg",
											children: "콤보"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "text-xs text-muted",
											children: "연속 회피"
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-4 text-sm text-muted",
							children: ["최고 기록 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-gold",
								children: fmt(hud.best)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-4 h-14 w-full rounded-xl bg-primary text-lg font-semibold text-on-primary",
							onPointerDown: (e) => e.stopPropagation(),
							onClick: () => engineRef.current?.begin(),
							children: "달리기"
						})
					]
				})
			}) : null,
			hud.mode === "over" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-20 flex items-end justify-center bg-bg/45 p-4 sm:items-center",
				onPointerDown: (e) => {
					if (e.target === e.currentTarget) engineRef.current?.begin();
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel-in safe-b w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl",
					role: "status",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-primary",
							children: hud.newBest ? "새로운 최고 기록" : reasonCopy(hud.reason)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display mt-1 text-6xl leading-none text-fg",
							children: fmt(hud.score)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-4 grid grid-cols-3 gap-2 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-xs text-muted",
										children: "거리"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
										className: "mt-1 text-lg font-semibold text-fg",
										children: [fmt(hud.distance), "m"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-xs text-muted",
										children: "최고 콤보"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "mt-1 text-lg font-semibold text-accent",
										children: hud.peakCombo
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl bg-bg px-2 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-xs text-muted",
										children: "최고 점수"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "mt-1 text-lg font-semibold text-gold",
										children: fmt(hud.best)
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-semibold text-on-primary",
							onClick: () => engineRef.current?.begin(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
								className: "size-5",
								"aria-hidden": "true"
							}), "다시 달리기"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-center text-xs text-muted",
							children: "스페이스 또는 화면을 탭해도 다시 시작합니다"
						})
					]
				})
			}) : null,
			playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "safe-b absolute inset-x-0 bottom-0 z-20 flex gap-3 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface/90 text-base font-semibold text-fg backdrop-blur-md",
					onPointerDown: (e) => {
						e.preventDefault();
						e.stopPropagation();
						engineRef.current?.slide();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, {
						className: "size-5 text-gold",
						"aria-hidden": "true"
					}), "슬라이드"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-on-primary",
					onPointerDown: (e) => {
						e.preventDefault();
						e.stopPropagation();
						engineRef.current?.jump();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, {
						className: "size-5",
						"aria-hidden": "true"
					}), "점프"]
				})]
			}) : null
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunnerGame, {});
}
//#endregion
export { Home as component };
