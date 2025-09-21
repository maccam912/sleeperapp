import { Handlers, PageProps } from "$fresh/server.ts";
import { buildRosters, type Roster, type SleeperRoster, type RawPlayer } from "../lib/sleeper.ts";

interface SleeperState {
  season?: string;
  week?: number | null;
  season_type?: string | null;
}

interface ProjectionItem {
  player_id: string;
  stats?: { pts_ppr?: number };
  player?: { injury_status?: string | null };
}

interface RosterPlayerView {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  pprProj: number | null;
  status: string | null;
  isStarter: boolean;
}

interface RosterView {
  owner: string;
  starters: RosterPlayerView[];
  bench: RosterPlayerView[];
}

export const handler: Handlers<{ rosters: RosterView[]; season: string; week: number; seasonType: "pre" | "regular" | "post" }> = {
  async GET(_req, ctx) {
    const leagueId = "1248432621554237440";
    // Fetch base data
    const [rostersRes, playersRes, usersRes, stateRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch("https://api.sleeper.app/v1/players/nfl"),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
      fetch("https://api.sleeper.app/v1/state/nfl"),
    ]);

    const rostersData: SleeperRoster[] = await rostersRes.json();
    const playersData: Record<string, RawPlayer> = await playersRes.json();
    const usersData = await usersRes.json();
    const state: SleeperState = await stateRes.json();

    let season = new Date().getFullYear().toString();
    let week = 1;
    let seasonType: "pre" | "regular" | "post" = "regular";
    if (state && typeof state === "object") {
      if (state.season && /^\d{4}$/.test(state.season)) season = state.season;
      if (typeof state.week === "number" && isFinite(state.week) && state.week >= 1) week = state.week;
      const st = (state.season_type ?? "regular").toLowerCase();
      if (st === "pre" || st === "regular" || st === "post") seasonType = st;
    }

    // Fetch projections for the detected week
    const pprMap = new Map<string, number>();
    const statusMap = new Map<string, string | null>();
    try {
      const projRes = await fetch(`https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=${seasonType}`);
      if (projRes.ok) {
        const projData: ProjectionItem[] = await projRes.json();
        for (const item of projData) {
          const pid = item.player_id;
          const ppr = item?.stats?.pts_ppr;
          if (pid && typeof ppr === "number") pprMap.set(pid, ppr);
          if (pid) statusMap.set(pid, (item.player?.injury_status ?? null) as string | null);
        }
      }
    } catch (_err) {
      // Leave map empty on failure
    }

    // Use buildRosters for consistent owner naming
    const basicRosters: Roster[] = buildRosters(rostersData, playersData, usersData);

    // Build enriched roster view, aligning by index with rostersData
    const rosters: RosterView[] = rostersData.map((r, idx) => {
      const owner = basicRosters[idx]?.owner ?? `Roster ${r.roster_id}`;
      const startersIds = (r.starters ?? []).filter((id): id is string => typeof id === "string");
      const startersSet = new Set(startersIds);

      const toView = (id: string, isStarter: boolean): RosterPlayerView => {
        const rp = playersData[id];
        const name = rp?.full_name ?? id;
        const position = rp?.position ?? null;
        const team = rp?.team ?? null;
        const status = (statusMap.get(id) ?? rp?.injury_status ?? null) as string | null;
        const pprProj = pprMap.get(id) ?? null;
        return { id, name, position, team, pprProj, status, isStarter };
      };

      const starters: RosterPlayerView[] = startersIds
        .filter((id) => id && playersData[id])
        .map((id) => toView(id, true));

      const bench: RosterPlayerView[] = (r.players ?? [])
        .filter((id) => id && !startersSet.has(id))
        .map((id) => toView(id, false));

      return { owner, starters, bench };
    });

    return ctx.render({ rosters, season, week, seasonType });
  },
};

export default function Home(
  { data }: PageProps<{ rosters: RosterView[]; season: string; week: number; seasonType: "pre" | "regular" | "post" }>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <nav class="mb-4 space-x-4">
        <a href="/players" class="underline">Players</a>
        <a href="/league" class="underline">League Info</a>
        <a href="/matchups" class="underline">Matchups</a>
      </nav>
      <h1 class="text-2xl font-bold mb-2">League Rosters</h1>
      <p class="text-sm text-gray-600 mb-4">Week {data.week} projections — {data.season} ({data.seasonType})</p>
      {data.rosters.map((roster) => (
        <div class="mb-6" key={roster.owner}>
          <h2 class="text-xl font-semibold">{roster.owner}</h2>
          <div class="mt-1">
            <h3 class="font-medium">Starters</h3>
            <ul class="list-disc list-inside">
              {roster.starters.map((p) => {
                const stat = p.pprProj != null ? `${p.pprProj.toFixed(1)} PPR` : "N/A";
                const status = p.status ? ` — ${p.status.toUpperCase()}` : "";
                return (
                  <li key={p.id}>
                    {p.name} {p.team ? `(${p.team})` : ""} {p.position ?? ""} — {stat}{status}
                  </li>
                );
              })}
            </ul>
          </div>
          <div class="mt-2">
            <h3 class="font-medium">Bench</h3>
            <ul class="list-disc list-inside">
              {roster.bench.map((p) => {
                const stat = p.pprProj != null ? `${p.pprProj.toFixed(1)} PPR` : "N/A";
                const status = p.status ? ` — ${p.status.toUpperCase()}` : "";
                return (
                  <li key={p.id}>
                    {p.name} {p.team ? `(${p.team})` : ""} {p.position ?? ""} — {stat}{status}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ))}
    </main>
  );
}
