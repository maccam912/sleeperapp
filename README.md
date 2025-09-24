# Sleeperapp

This repository contains a [Fresh](https://fresh.deno.dev) web application built
with Deno that renders data from the [Sleeper](https://sleeper.com) fantasy
football API. The home page lists rosters for league `1248432621554237440`.
Additional routes expose more league information:

- `/players` – alphabetical list of NFL players
- `/league` – basic info about the league
- `/matchups` – week 1 matchups for the league

Most Sleeper API endpoints are proxied through `/api/sleeper/*` which forwards
requests to `https://api.sleeper.app/v1/`.

## MCP Server (Model Context Protocol)

This app exposes an MCP server over WebSocket so compatible LLM clients can
connect and use Sleeper lookups as tools.

- WebSocket URL: `ws://localhost:8000/mcp` (dev) or `wss://<your-host>/mcp` (prod)
- Subprotocol: `mcp`
- Supported methods: `initialize`, `tools/list`, `tools/call`
- Tools:
  - `league_info` — Get basic league info. Args: `{ leagueId?: string }`
  - `matchups` — Get matchups for a week. Args: `{ week: number, leagueId?: string }`
  - `player_search` — Search players. Args: `{ query: string, limit?: number }`

Optional env var:

- `DEFAULT_LEAGUE_ID` — Default league used when a tool omits `leagueId`.

Example Claude/MCP WebSocket config (conceptual):

```json
{
  "mcpServers": {
    "sleeper": {
      "type": "websocket",
      "url": "ws://localhost:8000/mcp"
    }
  }
}
```

Once connected, the client can call `tools/list` to discover available tools and
use `tools/call` with the tool `name` and `arguments` to query data.

## Development

Run the development server:

```sh
deno task start
```

## Docker

Build and run the application with Docker:

```sh
docker build -t sleeperapp .
docker run -p 8000:8000 sleeperapp
```

## GitHub Container Registry

Pushes to the `main` branch trigger a GitHub Actions workflow that builds the
Docker image and publishes it to the GitHub Container Registry.
