import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseOperations, demoHealth, listApiOperations, readProjectRules } from "./tools.mjs";

const SERVER = fileURLToPath(new URL("./server.mjs", import.meta.url));

function rpc(requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", () =>
      resolve(
        out
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l)),
      ),
    );
    child.stdin.end(requests.map((r) => JSON.stringify(r)).join("\n") + "\n");
  });
}

test("parseOperations reads methods, ids and public flag", () => {
  const yaml =
    "paths:\n  /api/a:\n    get:\n      operationId: getA\n      security: []\n  /api/b:\n    post:\n      operationId: postB\ncomponents:\n  x: 1\n";
  assert.deepEqual(parseOperations(yaml), [
    { method: "GET", path: "/api/a", operationId: "getA", public: true },
    { method: "POST", path: "/api/b", operationId: "postB", public: false },
  ]);
});

test("real openapi.yaml lists health as public", async () => {
  const pub = await listApiOperations({ publicOnly: true });
  assert.ok(pub.some((o) => o.operationId === "getHealth"));
});

test("rules section is returned", async () => {
  assert.match(await readProjectRules(), /openapi\.yaml/);
});

test("demoHealth rejects non-allowlisted targets without a request", async () => {
  let called = false;
  await assert.rejects(
    demoHealth({ target: "evil" }, async () => {
      called = true;
    }),
    /target must be one of/,
  );
  assert.equal(called, false);
});

test("demoHealth uses a fixed origin and path", async () => {
  let url;
  const r = await demoHealth({ target: "demo" }, async (u) => {
    url = u;
    return { status: 200, json: async () => ({ status: "ok" }) };
  });
  assert.equal(url, "https://small-bookclub-demo.onrender.com/api/health");
  assert.equal(r.status, 200);
});

test("stdio protocol: initialize, list, call, errors", async () => {
  const res = await rpc([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "read_project_rules" } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "demo_health", arguments: { target: "x" } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } },
    { jsonrpc: "2.0", id: 6, method: "bogus" },
  ]);
  const by = Object.fromEntries(res.map((r) => [r.id, r]));
  assert.equal(by[1].result.serverInfo.name, "small-bookclub");
  assert.deepEqual(
    by[2].result.tools.map((t) => t.name),
    ["list_api_operations", "read_project_rules", "demo_health"],
  );
  assert.match(by[3].result.content[0].text, /openapi/);
  assert.equal(by[4].result.isError, true);
  assert.equal(by[5].error.code, -32602);
  assert.equal(by[6].error.code, -32601);
  assert.equal(res.length, 6);
});
