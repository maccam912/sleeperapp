import { Handlers, PageProps } from "$fresh/server.ts";
import { buildRosters, type Roster } from "../lib/sleeper.ts";

export const handler: Handlers<{ rosters: Roster[] }> = {
  async GET(_req, ctx) {
    const leagueId = "1248432621554237440";
    const [rostersRes, playersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch("https://api.sleeper.app/v1/players/nfl"),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    ]);

    const rostersData = await rostersRes.json();
    const playersData = await playersRes.json();
    const usersData = await usersRes.json();

    const rosters = buildRosters(rostersData, playersData, usersData);

    return ctx.render({ rosters });
  },
};

export default function Home(
  { data }: PageProps<{ rosters: Roster[] }>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">League Rosters</h1>
      {data.rosters.map((roster) => (
        <div class="mb-6">
          <h2 class="text-xl font-semibold">{roster.owner}</h2>
          <ul class="list-disc list-inside">
            {roster.players.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      ))}
    </main>
  );
}
