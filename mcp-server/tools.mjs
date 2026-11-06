// Read-only project tools. No dependencies; no writes; fixed network allowlist.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_ORIGINS = {
  staging: "https://small-bookclub-staging.onrender.com",
  demo: "https://small-bookclub-demo.onrender.com",
};
const METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/** Parse openapi.yaml paths by indentation (no YAML dependency). */
export function parseOperations(yamlText) {
  const ops = [];
  let inPaths = false;
  let route = null;
  let op = null;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line)) break;
    let m = line.match(/^ {2}(\/\S*):\s*$/);
    if (m) {
      route = m[1];
      op = null;
      continue;
    }
    m = line.match(/^ {4}([a-z]+):\s*$/);
    if (m && route && METHODS.has(m[1])) {
      op = { method: m[1].toUpperCase(), path: route, operationId: null, public: false };
      ops.push(op);
      continue;
    }
    if (!op) continue;
    m = line.match(/^ {6}operationId:\s*(\S+)/);
    if (m) op.operationId = m[1];
    if (/^ {6}security:\s*\[\s*\]\s*$/.test(line)) op.public = true;
  }
  return ops;
}

export async function listApiOperations({ publicOnly = false } = {}) {
  const ops = parseOperations(await readFile(path.join(ROOT, "openapi.yaml"), "utf8"));
  return publicOnly ? ops.filter((o) => o.public) : ops;
}

export async function readProjectRules() {
  const text = (await readFile(path.join(ROOT, "AGENTS.md"), "utf8")).replace(/\r\n/g, "\n");
  const start = text.indexOf("\n## Rules\n");
  if (start < 0) throw new Error("AGENTS.md has no Rules section");
  const rest = text.slice(start + "\n## Rules\n".length);
  const end = rest.indexOf("\n## ");
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

export async function demoHealth({ target }, fetchImpl = fetch) {
  const origin = DEMO_ORIGINS[target];
  if (!origin) throw new Error(`target must be one of: ${Object.keys(DEMO_ORIGINS).join(", ")}`);
  const res = await fetchImpl(`${origin}/api/health`, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json().catch(() => null);
  return { target, status: res.status, body };
}

export const TOOLS = [
  {
    name: "list_api_operations",
    description:
      "List operations in openapi.yaml (method, path, operationId, public). Use to find which endpoints are unauthenticated when reviewing spoiler or permission exposure.",
    inputSchema: { type: "object", properties: { publicOnly: { type: "boolean" } }, additionalProperties: false },
    run: listApiOperations,
  },
  {
    name: "read_project_rules",
    description: "Return the Rules section of AGENTS.md so an agent can check its work against current project rules.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: readProjectRules,
  },
  {
    name: "demo_health",
    description:
      "GET /api/health on the fictional staging or demo instance. Read-only; only two fixed origins are reachable.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string", enum: Object.keys(DEMO_ORIGINS) } },
      required: ["target"],
      additionalProperties: false,
    },
    run: demoHealth,
  },
];
