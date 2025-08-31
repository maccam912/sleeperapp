import { Handlers, PageProps } from "$fresh/server.ts";
import { buildPlayers, type Player } from "../lib/sleeper.ts";

export const handler: Handlers<{ players: Player[] }> = {
  async GET(_req, ctx) {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl");
    const data = await res.json();

    const players: Player[] = buildPlayers(data);

    return ctx.render({ players });
  },
};

export default function PlayersPage(
  { data }: PageProps<{ players: Player[] }>,
) {
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">Players</h1>
      <ul class="space-y-1">
        {data.players.map((p) => (
          <li key={p.id}>
            {p.name} - {p.team ?? "FA"} {p.position}
          </li>
        ))}
      </ul>
    </main>
  );
}
