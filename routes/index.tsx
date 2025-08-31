import { Handlers, PageProps } from "$fresh/server.ts";

interface Roster {
  owner: string;
  players: string[];
}

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

    const users = new Map(
      usersData.map((u: { user_id: string; display_name: string }) => [
        u.user_id,
        u.display_name,
      ]),
    );

    const rosters = rostersData.map((r: {
      roster_id: number;
      owner_id: string;
      players: string[];
    }) => ({
      owner: users.get(r.owner_id) ?? `Roster ${r.roster_id}`,
      players: (r.players ?? []).map(
        (id: string) => playersData[id]?.full_name ?? id,
      ),
    }));

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
