#!/usr/bin/env node
// Minimal MCP server over stdio (newline-delimited JSON-RPC 2.0). No dependencies.
import { createInterface } from "node:readline";
import { TOOLS } from "./tools.mjs";

const PROTOCOL = "2025-06-18";
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { method, params } = msg;
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "small-bookclub", version: "1.0.0" },
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) throw Object.assign(new Error(`unknown tool: ${params?.name}`), { code: -32602 });
      try {
        const out = await tool.run(params.arguments ?? {});
        return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e.message) }] };
      }
    }
    default:
      throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
  }
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return fail(null, -32700, "parse error");
  }
  if (msg.id === undefined) return; // notifications need no reply
  try {
    send({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) });
  } catch (e) {
    fail(msg.id, e.code ?? -32603, e.message);
  }
});
