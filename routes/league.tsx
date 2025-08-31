import { Handlers, PageProps } from "$fresh/server.ts";

interface LeagueData {
  name: string;
  season: string;
  totalRosters: number;
}

export const handler: Handlers<LeagueData> = {
  async GET(_req, ctx) {
    const leagueId = "1248432621554237440";
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const data = await res.json();
    const league = {
      name: data.name,
      season: data.season,
      totalRosters: data.total_rosters,
    };
    return ctx.render(league);
  },
};

export default function LeaguePage(
  { data }: PageProps<LeagueData>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">League Info</h1>
      <p>
        <span class="font-semibold">Name:</span> {data.name}
      </p>
      <p>
        <span class="font-semibold">Season:</span> {data.season}
      </p>
      <p>
        <span class="font-semibold">Total Rosters:</span> {data.totalRosters}
      </p>
    </main>
  );
}
