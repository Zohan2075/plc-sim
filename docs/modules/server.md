---
type: documentation
entity: module
module: "server"
version: 1.0
---

# Module: server

> Part of [jPLC Sim](../README.md)

## Overview

`server/` (package `@plc-sim/server`) is a deliberately minimal Express host: it serves the built
UI and a health check. **There is no API** (plan out-of-scope: no REST/WebSocket; adding session
endpoints is explicitly future work).

### Responsibility

- **Is**: static hosting of `ui/dist`, `/healthz`, SPA fallback.
- **Is not**: simulation, data APIs, authentication, file storage.

### Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| express | library | HTTP server |
| `ui/dist` | artifact | Built UI served from disk (`server/src/index.ts:11,16`) |

## Structure

| Path | Type | Purpose |
|------|------|---------|
| `server/src/index.ts` | file | The whole module (31 lines) |

## Key Symbols

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `app.use(express.static(uiDist))` | middleware | `server/src/index.ts:16` | Serves the built UI |
| `GET /healthz` | route | `server/src/index.ts:19` | `200 text/plain "ok"` for deployment probes |
| `GET *` | route | `server/src/index.ts:24` | SPA fallback to `ui/dist/index.html` |
| `PORT` | env | `server/src/index.ts:10` | Port (default 3000) |

## Data Flow

Request → static file from `ui/dist` → else `/healthz` → else index.html. The UI loads its data
files (`data/`) as static assets at runtime; in dev they come from vite's `publicDir`.

## Configuration

- `PORT` (env, default `3000`); started with `pnpm start`.

## Inventory Notes

- **Coverage**: full.
- **Notes**: verified 2026-10-30; no tests of its own (static host only).
