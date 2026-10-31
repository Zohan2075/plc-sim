# Deployment (Base)

The repo is structured to be deployable as a single Node.js server that hosts the built UI.

## Build

```bash
pnpm install
pnpm build
```

## Run locally (server hosting UI)

```bash
pnpm start
```

- Server: `http://localhost:3000`
- Health check: `http://localhost:3000/healthz`

## Docker (optional)

```bash
docker build -t plc-sim .
docker run -p 3000:3000 plc-sim
```

## Netlify

The static UI can be deployed from the repository root with the checked-in Netlify config.

```bash
pnpm --filter @plc-sim/ui... run build
```

- Build config: `netlify.toml`
- Publish directory: `ui/dist`
- The `@plc-sim/ui` filter includes its workspace dependencies, so Netlify builds `ladder-types/` and `plc-engine/` first.

## Vercel (Services)

`vercel.json` defines a multi-service Vercel project:

| Service | Source | Public path | Notes |
|---------|--------|-------------|-------|
| `app` | root `Dockerfile` (`runtime: "container"`) | `/` | All-in-one host: built UI + `/healthz` |
| `server` | `server/` (`framework: "express"`) | `/api` | API-only when `ui/dist` is absent; exposes `/api/healthz` |

- The Vite UI is built inside the `app` container; there is no separate `ui` service.
- Top-level rewrites: `/api/(.*)` → `server`, then `/(.*)` → `app` (specific first, catch-all last).
- **No service bindings are declared.** No service calls another over the internal network; the browser calls the public `/api/*` route directly, which is not a binding.
- The container image copies `data/` before building because `ui/vite.config.ts` uses `../data` as `publicDir`.
- Local multi-service run: `vercel dev` (or `vercel dev -L` without cloud auth).

Notes:

- This is intentionally a *minimal* server: it only serves static UI files and a health check.
- Future work can add APIs/WebSockets for multi-user sessions without changing the engine.
