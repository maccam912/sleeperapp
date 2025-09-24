import { Handlers } from "$fresh/server.ts";
import {
  callTool,
  err,
  type JsonRpcId,
  type JsonRpcRequest,
  ok,
  PROTOCOL_VERSION,
} from "../lib/mcp_server.ts";

interface Session {
  id: string;
  send: (obj: unknown, event?: string) => void;
  close: () => void;
  closed: boolean;
}

const sessions = new Map<string, Session>();

function sseHeaders(): HeadersInit {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "x-accel-buffering": "no",
    "access-control-allow-origin": "*",
  };
}

function writeSSE(
  controller: ReadableStreamDefaultController<Uint8Array>,
  data: string,
  event?: string,
) {
  const enc = new TextEncoder();
  const prefix = event ? `event: ${event}\n` : "";
  controller.enqueue(
    enc.encode(prefix + "data: " + data.replace(/\n/g, "\ndata: ") + "\n\n"),
  );
}

function createSession(): { response: Response; id: string } {
  const id = crypto.randomUUID();

  let interval: number | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown, event?: string) => {
        writeSSE(controller, JSON.stringify(obj), event);
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      const session: Session = { id, send, close, closed: false };
      sessions.set(id, session);

      // Announce session and readiness
      send({
        jsonrpc: "2.0",
        method: "notifications/session",
        params: { session: id },
      }, "message");
      send({
        jsonrpc: "2.0",
        method: "notifications/ready",
        params: { now: new Date().toISOString() },
      }, "message");

      // Heartbeat
      interval = setInterval(() => {
        if (!closed) {
          writeSSE(controller, JSON.stringify({ ts: Date.now() }), "ping");
        }
      }, 25000) as unknown as number;
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      sessions.delete(id);
    },
  });

  const response = new Response(stream, { headers: sseHeaders() });
  return { response, id };
}

async function handleJsonRpc(msg: JsonRpcRequest, session: Session) {
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
        session.send(resp, "message");
        break;
      }
      case "tools/list": {
        const resp = ok(id, (await import("../lib/mcp_server.ts")).toolsList());
        session.send(resp, "message");
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
        session.send(ok(id, result), "message");
        break;
      }
      case "ping": {
        session.send(
          ok(id, { pong: "ok", at: new Date().toISOString() }),
          "message",
        );
        break;
      }
      default: {
        session.send(err(id, -32601, `Method not found: ${method}`), "message");
      }
    }
  } catch (e) {
    session.send(
      err(id, -32000, (e as Error)?.message ?? "Internal error"),
      "message",
    );
  }
}

export const handler: Handlers = {
  GET(_req) {
    // Create a new session and return SSE stream.
    const { response } = createSession();
    return response;
  },

  async POST(req) {
    const url = new URL(req.url);
    const id = url.searchParams.get("session") ??
      req.headers.get("x-session-id") ?? "";
    const session = id ? sessions.get(id) : undefined;
    if (!session) return new Response("No such session", { status: 404 });

    let msg: JsonRpcRequest;
    try {
      msg = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    await handleJsonRpc(msg, session);
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*" },
    });
  },

  // Basic CORS for POST preflight if needed
  OPTIONS(_req) {
    const headers = new Headers({
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-session-id",
    });
    return new Response(null, { headers });
  },
};

export default {};
