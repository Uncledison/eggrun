const KEY = "lumen-run-save";
const VERSION = 1;

export type SaveData = {
  version: number;
  best: number;
  bestCombo: number;
  bestDistance: number;
  muted: boolean;
};

const defaults: SaveData = {
  version: VERSION,
  best: 0,
  bestCombo: 0,
  bestDistance: 0,
  muted: false,
};

function finite(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    let version = finite(parsed.version, 0);
    const next: SaveData = {
      version,
      best: finite(parsed.best),
      bestCombo: finite(parsed.bestCombo),
      bestDistance: finite(parsed.bestDistance),
      muted: Boolean(parsed.muted),
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

export function writeSave(data: SaveData): void {
  if (typeof localStorage === "undefined") return;
  try {
    const payload: SaveData = { ...data, version: VERSION };
    localStorage.setItem(KEY, JSON.stringify(payload));
    localStorage.setItem(`${KEY}-bak`, JSON.stringify(payload));
  } catch {
    /* private mode / quota — keep playing in memory */
  }
}
