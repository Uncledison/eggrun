import { createServerFn } from "@tanstack/react-start";

export type BoardRow = { name: string; score: number };

function cleanName(name: string): string {
  return name.trim().slice(0, 8);
}

function validName(name: string): boolean {
  return /^[\p{L}\p{N}]{1,8}$/u.test(name);
}

export const listRanks = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return sql<BoardRow>`select name, score from ranks order by score desc, id asc limit 10`;
});

export const submitRank = createServerFn({ method: "POST" })
  .validator((input: { name: string; score: number }) => {
    const name = cleanName(String(input?.name ?? ""));
    const score = Math.floor(Number(input?.score));
    if (!validName(name) || !Number.isFinite(score) || score < 1 || score > 5_000_000) {
      throw new Error("기록을 남길 수 없습니다");
    }
    return { name, score };
  })
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into ranks (name, score)
      values (${data.name}, ${data.score})
      on conflict (name) do update
      set score = excluded.score, created_at = now()
      where ranks.score < excluded.score
    `;
    return sql<BoardRow>`select name, score from ranks order by score desc, id asc limit 10`;
  });
