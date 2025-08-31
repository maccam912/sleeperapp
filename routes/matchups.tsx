import { Handlers, PageProps } from "$fresh/server.ts";

interface Matchup {
  matchup_id: number;
  roster_id: number;
  points: number;
}

export const handler: Handlers<{ matchups: Matchup[] }> = {
  async GET(_req, ctx) {
    const leagueId = "1248432621554237440";
    const week = 1;
    const res = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
    );
    const data = await res.json();
    return ctx.render({ matchups: data });
  },
};

export default function MatchupsPage(
  { data }: PageProps<{ matchups: Matchup[] }>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">Week 1 Matchups</h1>
      <ul class="space-y-1">
        {data.matchups.map((m) => (
          <li key={`${m.matchup_id}-${m.roster_id}`}>
            Matchup {m.matchup_id}: Roster {m.roster_id} - {m.points} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
