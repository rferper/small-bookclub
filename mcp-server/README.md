# Project MCP server

A small Model Context Protocol server (stdio, newline-delimited JSON-RPC) that gives agents three read-only project tools. It uses only Node 24 built-ins: no dependency, account or key.

| Tool | Purpose |
|---|---|
| `list_api_operations` | Operations in `openapi.yaml` (method, path, operationId, `public` flag); `publicOnly` filters to unauthenticated ones, useful for spoiler/permission review. |
| `read_project_rules` | The Rules section of `AGENTS.md`. |
| `demo_health` | `GET /api/health` on the fictional `staging` or `demo` instance; two fixed origins, redirects refused, 60 s timeout. |

## Install (Claude Code, project scope)

```bash
claude mcp add --scope project small-bookclub -- node mcp-server/server.mjs
```

This writes `.mcp.json`; review it before committing. Any MCP client can run `node mcp-server/server.mjs` from the repository root.

## Test

```bash
node --test mcp-server/server.test.mjs
```

Covers the YAML path parser, the real contract, the fixed network allowlist (no request for unknown targets) and the stdio protocol including error codes. CI runs it in the backend job.

## Permissions and limits

- Read-only: reads `openapi.yaml` and `AGENTS.md`; the only network call is the fixed health GET. No writes, shell, database, secrets or club data.
- Inputs are validated (`target` is an enum); tool errors return `isError` without stack traces.
- The path parser is indentation-based and assumes the current `openapi.yaml` layout; it is a convenience, not a contract validator.
- It runs with your user's rights like any local process; review changes to this folder as code. See `docs/permissions.md` and `security/agent-security.md`.
