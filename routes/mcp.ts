import { Handlers } from "$fresh/server.ts";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const DEFAULT_LEAGUE_ID = Deno.env.get("DEFAULT_LEAGUE_ID") ?? "1248432621554237440";
const PROTOCOL_VERSION = "2024-11-05";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function err(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function toolsList() {
  return {
    tools: [
      {
        name: "league_info",
        description: "Get basic Sleeper league info (name, season, total rosters).",
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
    ],
  };
}

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "league_info": {
      const leagueId = String(args.leagueId ?? DEFAULT_LEAGUE_ID);
      const data = await fetchJson<any>(`https://api.sleeper.app/v1/league/${leagueId}`);
      const result = {
        leagueId,
        name: data?.name ?? null,
        season: data?.season ?? null,
        totalRosters: data?.total_rosters ?? null,
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }], isError: false };
    }
    case "matchups": {
      const leagueId = String(args.leagueId ?? DEFAULT_LEAGUE_ID);
      const weekRaw = args.week;
      const week = typeof weekRaw === "number" && Number.isFinite(weekRaw) ? weekRaw : Number(weekRaw);
      if (!Number.isFinite(week) || week < 1) {
        return { content: [{ type: "text", text: "Invalid 'week' value" }], isError: true };
      }
      const data = await fetchJson<any[]>(
        `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
      );
      return { content: [{ type: "text", text: JSON.stringify({ leagueId, week, matchups: data }) }], isError: false };
    }
    case "player_search": {
      const query = String(args.query ?? "").trim();
      const limit = Math.max(1, Math.min(100, Number(args.limit ?? 20)));
      if (!query) return { content: [{ type: "text", text: "Missing 'query'" }], isError: true };

      // Players dataset
      const playersData = await fetchJson<Record<string, { full_name?: string; position?: string; team?: string }>>(
        "https://api.sleeper.app/v1/players/nfl",
      );

      const q = query.toLowerCase();
      const items = Object.entries(playersData)
        .filter(([, p]) => p && p.full_name && p.position && p.full_name.toLowerCase().includes(q))
        .slice(0, 2000) // light pre-trim
        .map(([id, p]) => ({ id, name: p.full_name!, position: p.position!, team: p.team ?? null }))
        .slice(0, limit);

      return { content: [{ type: "text", text: JSON.stringify({ query, results: items }) }], isError: false };
    }
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

export const handler: Handlers = {
  GET(req) {
    // Allow simple GET to describe endpoint when not upgrading
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response(
        "MCP WebSocket endpoint. Connect with subprotocol 'mcp' at /mcp.",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    let socket: WebSocket;
    try {
      const upgraded = Deno.upgradeWebSocket(req, { protocol: "mcp", idleTimeout: 120 });
      socket = upgraded.socket;

      socket.onopen = () => {
        // Optionally announce readiness via a notification-like message
        // (Clients may ignore unknown methods; this is informational.)
        const note = { jsonrpc: "2.0", method: "notifications/ready", params: { now: new Date().toISOString() } };
        try { socket.send(JSON.stringify(note)); } catch (_) { /* ignore */ }
      };

      socket.onmessage = async (ev: MessageEvent) => {
        const raw = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
        let msg: JsonRpcRequest;
        try {
          msg = JSON.parse(raw);
        } catch (_err) {
          // Not JSON-RPC; ignore
          return;
        }

        const id = (msg.id ?? null) as JsonRpcId;
        const method = msg.method;
        const params = (msg.params ?? {}) as Record<string, unknown>;

        try {
          switch (method) {
            case "initialize": {
              const resp = ok(id, {
                protocolVersion: PROTOCOL_VERSION,
                serverInfo: { name: "sleeper-mcp", version: "0.1.0" },
                capabilities: { tools: {}, resources: {}, prompts: {} },
              });
              socket.send(JSON.stringify(resp));
              break;
            }
            case "tools/list": {
              const resp = ok(id, toolsList());
              socket.send(JSON.stringify(resp));
              break;
            }
            case "tools/call": {
              const name = String((params as any).name ?? "");
              const args = ((params as any).arguments ?? {}) as Record<string, unknown>;
              const result = await callTool(name, args);
              const resp = ok(id, result);
              socket.send(JSON.stringify(resp));
              break;
            }
            case "ping": {
              const resp = ok(id, { pong: "ok", at: new Date().toISOString() });
              socket.send(JSON.stringify(resp));
              break;
            }
            default: {
              const resp = err(id, -32601, `Method not found: ${method}`);
              socket.send(JSON.stringify(resp));
            }
          }
        } catch (e) {
          const resp = err(id, -32000, (e as Error)?.message ?? "Internal error");
          try { socket.send(JSON.stringify(resp)); } catch { /* ignore */ }
        }
      };

      socket.onerror = () => {
        try { socket.close(); } catch { /* ignore */ }
      };
      socket.onclose = () => { /* no-op */ };

      return upgraded.response;
    } catch (_err) {
      return new Response("Failed to upgrade to WebSocket", { status: 400 });
    }
  },
};

export default {};

