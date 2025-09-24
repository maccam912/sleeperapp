import { Handlers } from "$fresh/server.ts";
import {
  callTool,
  err,
  type JsonRpcId,
  type JsonRpcRequest,
  ok,
  PROTOCOL_VERSION,
  toolsList,
} from "../lib/mcp_server.ts";

export const handler: Handlers = {
  GET(req) {
    // Allow simple GET to describe endpoint when not upgrading
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response(
        "MCP WebSocket endpoint. Connect with subprotocol 'mcp' at /mcp.",
        {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }

    let socket: WebSocket;
    try {
      const upgraded = Deno.upgradeWebSocket(req, {
        protocol: "mcp",
        idleTimeout: 120,
      });
      socket = upgraded.socket;

      socket.onopen = () => {
        // Optionally announce readiness via a notification-like message
        // (Clients may ignore unknown methods; this is informational.)
        const note = {
          jsonrpc: "2.0",
          method: "notifications/ready",
          params: { now: new Date().toISOString() },
        };
        try {
          socket.send(JSON.stringify(note));
        } catch (_) { /* ignore */ }
      };

      socket.onmessage = async (ev: MessageEvent) => {
        const raw = typeof ev.data === "string"
          ? ev.data
          : await (ev.data as Blob).text();
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
              const nameVal = (params as { name?: unknown }).name;
              const argsVal = (params as { arguments?: unknown }).arguments;
              const name = typeof nameVal === "string"
                ? nameVal
                : String(nameVal ?? "");
              const args = (argsVal && typeof argsVal === "object")
                ? argsVal as Record<string, unknown>
                : {};
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
          const resp = err(
            id,
            -32000,
            (e as Error)?.message ?? "Internal error",
          );
          try {
            socket.send(JSON.stringify(resp));
          } catch { /* ignore */ }
        }
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch { /* ignore */ }
      };
      socket.onclose = () => {/* no-op */};

      return upgraded.response;
    } catch (_err) {
      return new Response("Failed to upgrade to WebSocket", { status: 400 });
    }
  },
};

export default {};
