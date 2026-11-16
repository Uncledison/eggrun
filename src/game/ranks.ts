const KEY = "eggrun-ranks";
const NAME_KEY = "eggrun-name";

export type RankEntry = {
  name: string;
  score: number;
  at: number;
};

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, 12);
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

const KAKAO_KEY = "b164cb70562279d71ca5496b07c42624";
const GAME_URL = "https://eggrun.vercel.app";

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: object) => void };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

function loadKakao(): Promise<void> {
  if (window.Kakao) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";
    script.integrity = "sha384-WAtVcQYcmTO/N+C1N+1m6Gp8qxh+3NlnP7X1U7qP6P5dQY/MsRBNTh+e1ahJrkEm";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("kakao"));
    document.head.appendChild(script);
  });
}

export async function shareScore(name: string, score: number): Promise<"shared" | "copied" | "cancelled"> {
  const who = cleanName(name);
  const points = `${Math.floor(score).toLocaleString("ko-KR")}점`;
  const text = `${who} ${points} — 에그런\n${GAME_URL}`;
  try {
    await loadKakao();
    const kakao = window.Kakao;
    if (!kakao) throw new Error("kakao");
    if (!kakao.isInitialized()) kakao.init(KAKAO_KEY);
    kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: `${who} ${points}`,
        description: "에그런에서 같이 달려 보세요.",
        imageUrl: `${GAME_URL}/share-egg.png`,
        link: { mobileWebUrl: GAME_URL, webUrl: GAME_URL },
      },
      buttons: [{ title: "게임 열기", link: { mobileWebUrl: GAME_URL, webUrl: GAME_URL } }],
    });
    return "shared";
  } catch {
    /* fall through to the phone share sheet */
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "에그런", text, url: GAME_URL });
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
