import { assert, assertEquals } from "$std/assert/mod.ts";
import { stub } from "$std/testing/mock.ts";
import { callTool, toolsList } from "./mcp_server.ts";

function makeResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("toolsList includes expected tools", () => {
  const list = toolsList();
  const names = new Set(list.tools.map((t: any) => t.name));
  assert(names.has("league_info"));
  assert(names.has("matchups"));
  assert(names.has("player_search"));
});

Deno.test("callTool league_info returns basic league info", async () => {
  const s = stub(globalThis, "fetch", (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/league/L1")) {
      return Promise.resolve(
        makeResponse({ name: "My League", season: "2024", total_rosters: 12 }),
      );
    }
    return Promise.resolve(makeResponse({}, 404));
  });
  try {
    const result = await callTool("league_info", { leagueId: "L1" });
    assertEquals(result.isError, false);
    const text = (result.content?.[0] as any)?.text as string;
    const parsed = JSON.parse(text);
    assertEquals(parsed, {
      leagueId: "L1",
      name: "My League",
      season: "2024",
      totalRosters: 12,
    });
  } finally {
    s.restore();
  }
});

Deno.test("callTool matchups validates week and returns data", async () => {
  const s = stub(globalThis, "fetch", (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/league/L2/matchups/3")) {
      return Promise.resolve(
        makeResponse([{ matchup_id: 1, roster_id: 10, points: 99.9 }]),
      );
    }
    return Promise.resolve(makeResponse({}, 404));
  });
  try {
    const bad = await callTool("matchups", { week: 0, leagueId: "L2" });
    assertEquals(bad.isError, true);
    const ok = await callTool("matchups", { week: 3, leagueId: "L2" });
    assertEquals(ok.isError, false);
    const parsed = JSON.parse((ok.content?.[0] as any)?.text as string);
    assertEquals(parsed.week, 3);
    assertEquals(parsed.leagueId, "L2");
    assertEquals(parsed.matchups.length, 1);
  } finally {
    s.restore();
  }
});

Deno.test("callTool player_search filters and limits", async () => {
  const s = stub(globalThis, "fetch", (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/players/nfl")) {
      return Promise.resolve(makeResponse({
        a: { full_name: "Alpha Man", position: "QB", team: "AAA" },
        b: { full_name: "Beta Guy", position: "RB", team: "BBB" },
        g: { full_name: "Gamma Dude", position: undefined, team: "CCC" },
      }));
    }
    return Promise.resolve(makeResponse({}, 404));
  });
  try {
    const res = await callTool("player_search", { query: "a", limit: 1 });
    assertEquals(res.isError, false);
    const parsed = JSON.parse((res.content?.[0] as any)?.text as string);
    assertEquals(parsed.results.length, 1);
    assertEquals(parsed.results[0].name, "Alpha Man");
  } finally {
    s.restore();
  }
});

Deno.test("callTool unknown tool returns error", async () => {
  const res = await callTool("does_not_exist", {});
  assertEquals(res.isError, true);
});
