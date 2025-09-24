export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function safeEnv(name: string): string | undefined {
  try {
    // Accessing env may require permission; handle gracefully for tests
    // without --allow-env.
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

export const DEFAULT_LEAGUE_ID = safeEnv("DEFAULT_LEAGUE_ID") ??
  "1248432621554237440";
export const PROTOCOL_VERSION = "2024-11-05";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

export function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function err(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

export interface MCPTextContent {
  type: "text";
  text: string;
}
export interface CallToolResult {
  content: MCPTextContent[];
  isError: boolean;
}

export interface JSONSchema {
  type: string;
  properties?: Record<
    string,
    JSONSchema | { type: string; description?: string }
  >;
  required?: string[];
  description?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export function toolsList(): { tools: ToolSpec[] } {
  const tools: ToolSpec[] = [
    {
      name: "league_info",
      description:
        "Get basic Sleeper league info (name, season, total rosters).",
      inputSchema: {
        type: "object",
        properties: {
          leagueId: { type: "string", description: "Sleeper league id" },
        },
        required: [],
      },
    },
    {
      name: "matchups",
      description: "Get matchups for a given league and week.",
      inputSchema: {
        type: "object",
        properties: {
          leagueId: { type: "string", description: "Sleeper league id" },
          week: { type: "number", description: "NFL week (1-18)" },
        },
        required: ["week"],
      },
    },
    {
      name: "player_search",
      description:
        "Search NFL players by substring. Returns basic info and optional PPR projection if available.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Substring of player name" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: ["query"],
      },
    },
  ];
  return { tools };
}

export interface LeagueResponse {
  name?: string;
  season?: string;
  total_rosters?: number;
}
export interface Matchup {
  matchup_id: number;
  roster_id: number;
  points?: number;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  switch (name) {
    case "league_info": {
      const leagueId = String(args.leagueId ?? DEFAULT_LEAGUE_ID);
      const data = await fetchJson<LeagueResponse>(
        `https://api.sleeper.app/v1/league/${leagueId}`,
      );
      const result = {
        leagueId,
        name: data?.name ?? null,
        season: data?.season ?? null,
        totalRosters: data?.total_rosters ?? null,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: false,
      };
    }
    case "matchups": {
      const leagueId = String(args.leagueId ?? DEFAULT_LEAGUE_ID);
      const weekRaw = args.week;
      const week = typeof weekRaw === "number" && Number.isFinite(weekRaw)
        ? weekRaw
        : Number(weekRaw);
      if (!Number.isFinite(week) || week < 1) {
        return {
          content: [{ type: "text", text: "Invalid 'week' value" }],
          isError: true,
        };
      }
      const data = await fetchJson<Matchup[]>(
        `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
      );
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ leagueId, week, matchups: data }),
        }],
        isError: false,
      };
    }
    case "player_search": {
      const query = String(args.query ?? "").trim();
      const limit = Math.max(1, Math.min(100, Number(args.limit ?? 20)));
      if (!query) {
        return {
          content: [{ type: "text", text: "Missing 'query'" }],
          isError: true,
        };
      }

      // Players dataset
      const playersData = await fetchJson<
        Record<string, { full_name?: string; position?: string; team?: string }>
      >(
        "https://api.sleeper.app/v1/players/nfl",
      );

      const q = query.toLowerCase();
      const items = Object.entries(playersData)
        .filter(([, p]) =>
          p && p.full_name && p.position &&
          p.full_name.toLowerCase().includes(q)
        )
        .slice(0, 2000) // light pre-trim
        .map(([id, p]) => ({
          id,
          name: p.full_name!,
          position: p.position!,
          team: p.team ?? null,
        }))
        .slice(0, limit);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ query, results: items }),
        }],
        isError: false,
      };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
