import { Handlers, PageProps } from "$fresh/server.ts";

interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
}

interface RawPlayer {
  player_id: string;
  full_name: string;
  position?: string;
  team?: string;
}

export const handler: Handlers<{ players: Player[] }> = {
  async GET(_req, ctx) {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl");
    const data = (await res.json()) as Record<string, RawPlayer>;

    const players: Player[] = Object.values(data)
      .filter((p) => p.position)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .slice(0, 50)
      .map((p) => ({
        id: p.player_id,
        name: p.full_name,
        position: p.position!,
        team: p.team ?? null,
      }));

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
