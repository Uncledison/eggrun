const KEY = "eggrun-ranks";
const NAME_KEY = "eggrun-name";

export type RankEntry = {
  name: string;
  score: number;
  at: number;
};

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, 8);
  return trimmed || "에그";
}

export function loadLastName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function loadRanks(): RankEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RankEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.name === "string" && typeof row.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function recordRank(name: string, score: number): RankEntry[] {
  const nextName = cleanName(name);
  const rows = loadRanks().filter((row) => row.name !== nextName);
  const previous = loadRanks().find((row) => row.name === nextName);
  const best = Math.max(previous?.score ?? 0, Math.floor(score));
  rows.push({ name: nextName, score: best, at: Date.now() });
  rows.sort((a, b) => b.score - a.score);
  const kept = rows.slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
    localStorage.setItem(NAME_KEY, nextName);
  } catch {
    /* keep the in-memory list */
  }
  return kept;
}

export async function shareScore(name: string, score: number): Promise<"shared" | "copied" | "cancelled"> {
  const who = cleanName(name);
  const text = `${who} ${Math.floor(score).toLocaleString("ko-KR")}점 — 에그런`;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "에그런", text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  return "cancelled";
}
