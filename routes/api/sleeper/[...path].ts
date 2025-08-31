import { Handlers } from "$fresh/server.ts";

async function proxy(req: Request, ctx: { params: Record<string, string> }) {
  const url = new URL(req.url);
  const target = `https://api.sleeper.app/v1/${ctx.params.path}${url.search}`;
  const res = await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
  });
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(res.body, { status: res.status, headers });
}

export const handler: Handlers = {
  GET: proxy,
  POST: proxy,
  PUT: proxy,
  PATCH: proxy,
  DELETE: proxy,
  OPTIONS(_req) {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    });
    return new Response(null, { headers });
  },
};
