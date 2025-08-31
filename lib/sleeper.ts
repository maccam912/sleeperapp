export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
}

export interface SleeperPlayer {
  full_name: string;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
}

export interface Roster {
  owner: string;
  players: string[];
}

export function buildRosters(
  rosters: SleeperRoster[],
  players: Record<string, SleeperPlayer>,
  users: SleeperUser[],
): Roster[] {
  const userMap = new Map(users.map((u) => [u.user_id, u.display_name]));

  return rosters.map((r) => ({
    owner: userMap.get(r.owner_id) ?? `Roster ${r.roster_id}`,
    players: (r.players ?? []).map((id) => players[id]?.full_name ?? id),
  }));
}

export interface RawPlayer {
  player_id: string;
  full_name: string;
  position?: string;
  team?: string;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
}

export function buildPlayers(data: Record<string, RawPlayer>): Player[] {
  return Object.values(data)
    .filter((p) => p.position)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .slice(0, 50)
    .map((p) => ({
      id: p.player_id,
      name: p.full_name,
      position: p.position!,
      team: p.team ?? null,
    }));
}
