import { Handlers, PageProps } from "$fresh/server.ts";
import { buildPlayers, type Player, type RawPlayer } from "../lib/sleeper.ts";

interface SleeperSeasonStatItem {
  player_id: string;
  stats?: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
  };
}

type PlayerWithStats = Player & {
  ppr?: number | null;
};

interface SleeperState {
  season?: string;
  week?: number | null;
  season_type?: string | null;
}

export const handler: Handlers<{
  players: PlayerWithStats[];
  season: string;
  mode: "season" | "week" | "proj";
  week?: number;
  seasonType: "pre" | "regular" | "post";
}> = {
  async GET(_req, ctx) {
    const url = new URL(_req.url);
    const modeParam = (url.searchParams.get("view") ?? "").toLowerCase();
    const mode = (modeParam === "week" || modeParam === "proj") ? modeParam : "proj";
    const weekParam = url.searchParams.get("week");

    // Fetch base player info
    const playersRes = await fetch("https://api.sleeper.app/v1/players/nfl");
    const playersData: Record<string, RawPlayer> = await playersRes.json();
    const basePlayers: Player[] = buildPlayers(playersData);

    // Autodetect current season/week/season_type from Sleeper state
    let season = new Date().getFullYear().toString();
    let currentWeek: number | undefined;
    let seasonType: "pre" | "regular" | "post" = "regular";
    try {
      const stateRes = await fetch("https://api.sleeper.app/v1/state/nfl");
      if (stateRes.ok) {
        const state: SleeperState = await stateRes.json();
        if (state.season && /^\d{4}$/.test(state.season)) season = state.season;
        if (typeof state.week === "number" && isFinite(state.week)) currentWeek = state.week;
        const st = (state.season_type ?? "regular").toLowerCase();
        if (st === "pre" || st === "regular" || st === "post") seasonType = st;
      }
    } catch (_) {
      // leave defaults
    }

    // Determine target week. Avoid treating null as 0.
    let week: number;
    if (typeof weekParam === "string" && /^(\d{1,2})$/.test(weekParam)) {
      week = parseInt(weekParam, 10);
    } else if (typeof currentWeek === "number" && isFinite(currentWeek)) {
      week = currentWeek;
    } else {
      week = 1;
    }
    if (!Number.isFinite(week) || week < 1) week = 1;

    // Decide endpoint based on mode
    let endpoint = `https://api.sleeper.com/stats/nfl/${season}?season_type=${seasonType}`;
    if (mode === "week") {
      endpoint = `https://api.sleeper.com/stats/nfl/${season}/${week}?season_type=${seasonType}`;
    } else if (mode === "proj") {
      endpoint = `https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=${seasonType}`;
    }

    const statsRes = await fetch(endpoint);
    let statsData: SleeperSeasonStatItem[] = [];
    try {
      if (statsRes.ok) {
        statsData = await statsRes.json();
      }
    } catch (_) {
      // swallow and leave statsData empty so the page still renders
    }

    const pprMap = new Map<string, number>();
    for (const item of statsData) {
      const pid = item.player_id;
      const ppr = item?.stats?.pts_ppr;
      if (pid && typeof ppr === "number") pprMap.set(pid, ppr);
    }

    // Prefer building the list from the stats keys to avoid N/A rows.
    let players: PlayerWithStats[];
    if (pprMap.size > 0) {
      players = Array.from(pprMap.entries())
        .map(([id, ppr]) => {
          const rp = playersData[id];
          if (!rp || !rp.position || !rp.full_name) return null;
          return {
            id,
            name: rp.full_name,
            position: rp.position!,
            team: rp.team ?? null,
            ppr,
          } as PlayerWithStats;
        })
        .filter((x): x is PlayerWithStats => x !== null)
        .sort((a, b) => (b.ppr ?? 0) - (a.ppr ?? 0))
        .slice(0, 200);
    } else {
      // Fallback: show a small list even if stats endpoint returned nothing
      players = basePlayers
        .map((p) => ({ ...p, ppr: pprMap.get(p.id) ?? null }))
        .filter((p) => p.ppr != null);
    }

    return ctx.render({
      players,
      season,
      mode,
      week: Number.isFinite(week) ? week : undefined,
      seasonType,
    });
  },
};

export default function PlayersPage(
  { data }: PageProps<{ players: PlayerWithStats[]; season: string; mode: "season" | "week" | "proj"; week?: number; seasonType: "pre" | "regular" | "post" }>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">Players</h1>
      <nav class="mb-3 space-x-3 text-sm">
        <a href="/players" class="underline">Season {data.season}</a>
        <a href={`/players?view=week${data.week ? `&week=${data.week}` : ""}`} class="underline">
          Week {data.week ?? "?"}
        </a>
        <a href={`/players?view=proj${data.week ? `&week=${data.week}` : ""}`} class="underline">
          Week {data.week ?? "?"} Proj
        </a>
      </nav>
      <p class="mb-2 text-sm text-gray-600">
        {data.mode === "season" && (
          <>Showing season-to-date PPR for {data.season} ({data.seasonType}).</>
        )}
        {data.mode === "week" && data.week && (
          <>Showing Week {data.week} PPR for {data.season} ({data.seasonType}).</>
        )}
        {data.mode === "proj" && data.week && (
          <>Showing Week {data.week} projected PPR for {data.season} ({data.seasonType}).</>
        )}
      </p>
      {data.players.length === 0 && (
        <p class="text-sm text-gray-600">No player stats found for this view. Try switching views or week.</p>
      )}
      {data.players.length > 0 && (
        <ul class="space-y-1">
          {data.players.map((p) => {
            const stat = p.ppr != null ? `${p.ppr.toFixed(1)} PPR` : "N/A";
            return (
              <li key={p.id}>
                {p.name} - {p.team ?? "FA"} {p.position} - {stat}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
