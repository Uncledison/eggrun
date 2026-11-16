import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pause, RotateCcw, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { Runner, type DeathReason, type Mode, type Pace, type Snapshot } from "@/game/engine";

type Hud = {
  mode: Mode;
  score: number;
  best: number;
  combo: number;
  peakCombo: number;
  distance: number;
  newBest: boolean;
  muted: boolean;
  reason: DeathReason;
  pace: Pace;
  shields: number;
  flying: boolean;
};

const initialHud: Hud = {
  mode: "menu",
  score: 0,
  best: 0,
  combo: 0,
  peakCombo: 0,
  distance: 0,
  newBest: false,
  muted: false,
  reason: "",
  pace: "mid",
  shields: 0,
  flying: false,
};

function fmt(n: number): string {
  return Math.floor(n).toLocaleString("ko-KR");
}

function reasonCopy(reason: DeathReason): string {
  if (reason === "beam") return "낮은 표지판에 부딪혔어요";
  if (reason === "pit") return "끊긴 지붕을 못 넘었어요";
  if (reason === "crate") return "상자에 걸렸어요";
  return "넘어졌어요";
}

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Runner | null>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const multRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [hud, setHud] = useState<Hud>(initialHud);
  const [coach, setCoach] = useState(false);
  const hudRef = useRef(hud);
  const modeRef = useRef(hud.mode);
  hudRef.current = hud;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    const engine = new Runner(canvas, (s: Snapshot) => {
      if (!alive) return;
      if (scoreRef.current) scoreRef.current.textContent = fmt(s.score);
      if (bestRef.current) bestRef.current.textContent = fmt(s.best);
      if (distRef.current) distRef.current.textContent = `${fmt(s.distance)}m`;
      if (multRef.current) multRef.current.textContent = `×${s.speedMult.toFixed(2)}`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0.04, s.speedNorm)})`;
      const prev = hudRef.current;
      const score = s.mode === "run" ? prev.score : s.score;
      const distance = s.mode === "run" ? prev.distance : s.distance;
      if (
        prev.mode === s.mode &&
        prev.combo === s.combo &&
        prev.best === s.best &&
        prev.muted === s.muted &&
        prev.newBest === s.newBest &&
        prev.peakCombo === s.peakCombo &&
        prev.reason === s.reason &&
        prev.pace === s.pace &&
        prev.shields === s.shields &&
        prev.flying === s.flying &&
        prev.score === score &&
        prev.distance === distance
      ) {
        return;
      }
      const next: Hud = {
        mode: s.mode,
        score,
        best: s.best,
        combo: s.combo,
        peakCombo: s.peakCombo,
        distance,
        newBest: s.newBest,
        muted: s.muted,
        reason: s.reason,
        pace: s.pace,
        shields: s.shields,
        flying: s.flying,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let down: { x: number; y: number; t: number } | null = null;
    let used = false;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (engineRef.current?.inFlight()) {
        engineRef.current.flyTo(e.clientY);
        down = { x: e.clientX, y: e.clientY, t: performance.now() };
        used = true;
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      used = false;
    };
    const onMove = (e: PointerEvent) => {
      if (engineRef.current?.inFlight()) {
        if (down) engineRef.current.flyTo(e.clientY);
        return;
      }
      if (!down || used) return;
      const dy = e.clientY - down.y;
      const dx = e.clientX - down.x;
      if (dy > 36 && dy > Math.abs(dx)) {
        used = true;
        engineRef.current?.slide();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (engineRef.current?.inFlight()) {
        down = null;
        return;
      }
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

  useEffect(() => {
    const prev = modeRef.current;
    modeRef.current = hud.mode;
    if (hud.mode !== "run" || (prev !== "menu" && prev !== "over")) return;
    setCoach(true);
    const timer = window.setTimeout(() => setCoach(false), 3800);
    return () => window.clearTimeout(timer);
  }, [hud.mode]);

  const playing = hud.mode === "run" || hud.mode === "hitstop" || hud.mode === "tumble";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="에그런 게임 화면" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted">점수</p>
          <p className="font-display text-3xl leading-none text-fg sm:text-4xl">
            <span ref={scoreRef}>0</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            거리 <span ref={distRef}>0m</span>
            {hud.shields > 0 ? <span className="ml-2 font-semibold text-accent">방어 {hud.shields}</span> : null}
          </p>
        </div>

        <div className="pointer-events-none text-center">
          <p className="flex items-center justify-center gap-1 text-xs font-medium text-accent">
            <Zap className="size-3.5" aria-hidden="true" />
            콤보
          </p>
          {hud.combo > 0 ? (
            <p key={hud.combo} className="combo-pop font-display text-4xl leading-none text-accent sm:text-5xl">
              {hud.combo}
            </p>
          ) : (
            <p className="font-display text-4xl leading-none text-muted sm:text-5xl">0</p>
          )}
        </div>

        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-xs font-medium text-gold">
            <Trophy className="size-3.5" aria-hidden="true" />
            최고
          </p>
          <p className="font-display text-2xl leading-none text-gold sm:text-3xl">
            <span ref={bestRef}>0</span>
          </p>
          <div className="mt-2 ml-auto flex items-center justify-end gap-2">
            <span ref={multRef} className="text-xs tabular-nums text-muted">
              ×1.00
            </span>
            <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-border">
              <span ref={barRef} className="block h-full origin-left bg-primary" style={{ transform: "scaleX(0.08)" }} />
            </span>
          </div>
        </div>
      </header>

      <button
        type="button"
        className={`z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg ${
          hud.mode === "menu" ? "absolute bottom-4 left-4" : "absolute top-20 right-4"
        }`}
        onClick={() => engineRef.current?.toggleMute()}
        aria-label={hud.muted ? "소리 켜기" : "소리 끄기"}
      >
        {hud.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      {hud.mode === "pause" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/55 p-4">
          <section className="panel-in w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold tracking-widest text-primary">PAUSED</p>
            <h2 className="font-display mt-1 text-5xl leading-none text-fg">잠깐 멈춤</h2>
            <p className="mt-3 text-sm text-muted">점수와 위치는 그대로입니다.</p>
            <button
              type="button"
              className="mt-5 h-14 w-full rounded-xl bg-primary text-lg font-semibold text-on-primary"
              onClick={() => engineRef.current?.togglePause()}
            >
              이어서 달리기
            </button>
            <p className="mt-3 text-xs text-muted">이어서 달리기를 누르면 그 자리에서 다시 뜁니다</p>
          </section>
        </div>
      ) : null}
      {hud.flying && hud.mode === "run" ? (
        <p className="pointer-events-none absolute top-24 left-1/2 z-10 w-[min(92vw,22rem)] -translate-x-1/2 rounded-full bg-surface/95 px-4 py-2 text-center text-sm font-semibold text-fg shadow-lg">
          5초 비행. 손가락을 위아래로 움직이세요
        </p>
      ) : null}
      {coach && hud.mode === "run" && !hud.flying ? (
        <p className="pointer-events-none absolute top-24 left-1/2 z-10 w-[min(92vw,20rem)] -translate-x-1/2 rounded-full bg-surface/95 px-4 py-2 text-center text-sm font-semibold text-fg shadow-lg">
          점프를 연타하면 세 번까지 뜁니다
        </p>
      ) : null}
      {hud.newBest && playing ? (
        <p className="pointer-events-none absolute top-24 left-4 z-10 text-sm font-semibold text-gold">최고 기록 경신 중</p>
      ) : null}

      {hud.mode === "menu" ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center p-4 sm:items-center sm:justify-end sm:p-10">
          <section className="panel-in pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur-md">
            <p className="text-xs font-semibold tracking-widest text-primary">ENDLESS ROOFTOP</p>
            <h1 className="font-display mt-1 text-5xl leading-none text-fg">에그런</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              상자는 점프, 머리 위 표지판은 슬라이드. 1000점마다 방어막이 생기고, 한 번 부딪히면 사라집니다.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg px-2 py-3">
                <ArrowUp className="mx-auto size-4 text-primary" aria-hidden="true" />
                <dt className="mt-1 text-sm font-semibold text-fg">점프</dt>
                <dd className="text-xs text-muted">연타하면 3번</dd>
              </div>
              <div className="rounded-xl bg-bg px-2 py-3">
                <ArrowDown className="mx-auto size-4 text-gold" aria-hidden="true" />
                <dt className="mt-1 text-sm font-semibold text-fg">슬라이드</dt>
                <dd className="text-xs text-muted">스와이프 · ↓</dd>
              </div>
              <div className="rounded-xl bg-bg px-2 py-3">
                <Zap className="mx-auto size-4 text-accent" aria-hidden="true" />
                <dt className="mt-1 text-sm font-semibold text-fg">콤보</dt>
                <dd className="text-xs text-muted">연속 회피</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              최고 기록 <span className="font-semibold text-gold">{fmt(hud.best)}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="시작 속도">
              {(
                [
                  ["slow", "느리게"],
                  ["mid", "중간"],
                  ["fast", "빠르게"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`h-11 rounded-xl text-sm font-semibold ${
                    hud.pace === id ? "bg-primary text-on-primary" : "bg-bg text-fg"
                  }`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => engineRef.current?.setPace(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 h-14 w-full rounded-xl bg-primary text-lg font-semibold text-on-primary"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => engineRef.current?.begin()}
            >
              달리기
            </button>
          </section>
        </div>
      ) : null}

      {hud.mode === "over" ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-bg/45 p-4 sm:items-center">
          <section
            className="panel-in safe-b w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl"
            role="status"
          >
            <p className="text-sm font-medium text-primary">{hud.newBest ? "새로운 최고 기록" : reasonCopy(hud.reason)}</p>
            <h2 className="font-display mt-1 text-6xl leading-none text-fg">{fmt(hud.score)}</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg px-2 py-3">
                <dt className="text-xs text-muted">거리</dt>
                <dd className="mt-1 text-lg font-semibold text-fg">{fmt(hud.distance)}m</dd>
              </div>
              <div className="rounded-xl bg-bg px-2 py-3">
                <dt className="text-xs text-muted">최고 콤보</dt>
                <dd className="mt-1 text-lg font-semibold text-accent">{hud.peakCombo}</dd>
              </div>
              <div className="rounded-xl bg-bg px-2 py-3">
                <dt className="text-xs text-muted">최고 점수</dt>
                <dd className="mt-1 text-lg font-semibold text-gold">{fmt(hud.best)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-semibold text-on-primary"
              onClick={() => engineRef.current?.begin()}
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              다시 시도
            </button>
            <button
              type="button"
              className="mt-2 h-12 w-full rounded-xl border border-border bg-bg text-base font-semibold text-fg"
              onClick={() => engineRef.current?.toMenu()}
            >
              레벨 선택
            </button>
            <p className="mt-3 text-center text-xs text-muted">다시 시도는 같은 속도입니다. 레벨 선택에서 느리게를 고를 수 있습니다.</p>
          </section>
        </div>
      ) : null}

      {playing ? (
        <div className="safe-b absolute inset-x-0 bottom-0 z-20 flex gap-3 p-4">
          <button
            type="button"
            className="flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-surface/90 text-xs font-semibold text-fg backdrop-blur-md"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engineRef.current?.togglePause();
            }}
            aria-label="일시정지"
          >
            <Pause className="size-5" aria-hidden="true" />
            멈춤
          </button>
          <button
            type="button"
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface/90 text-base font-semibold text-fg backdrop-blur-md"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engineRef.current?.slide();
            }}
          >
            <ArrowDown className="size-5 text-gold" aria-hidden="true" />
            슬라이드
          </button>
          <button
            type="button"
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-on-primary"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engineRef.current?.jump();
            }}
          >
            <ArrowUp className="size-5" aria-hidden="true" />
            점프
          </button>
        </div>
      ) : null}
    </main>
  );
}
