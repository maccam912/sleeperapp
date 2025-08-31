import { assertEquals } from "$std/assert/mod.ts";
import { buildPlayers, buildRosters } from "./sleeper.ts";

Deno.test("buildRosters maps owners and players", () => {
  const rosters = [
    { roster_id: 1, owner_id: "u1", players: ["p1", "p2"] },
    { roster_id: 2, owner_id: "u2", players: [] },
  ];
  const players = {
    p1: { full_name: "Player One" },
    p2: { full_name: "Player Two" },
  };
  const users = [
    { user_id: "u1", display_name: "Alice" },
  ];
  const result = buildRosters(rosters, players, users);
  assertEquals(result, [
    { owner: "Alice", players: ["Player One", "Player Two"] },
    { owner: "Roster 2", players: [] },
  ]);
});

Deno.test("buildPlayers sorts and limits players", () => {
  const data = {
    a: { player_id: "a", full_name: "Beta", position: "RB" },
    b: { player_id: "b", full_name: "Alpha", position: "QB" },
    c: { player_id: "c", full_name: "Gamma" },
  };
  const result = buildPlayers(data);
  assertEquals(result, [
    { id: "b", name: "Alpha", position: "QB", team: null },
    { id: "a", name: "Beta", position: "RB", team: null },
  ]);
});
