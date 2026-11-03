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

## Social preview (Open Graph / Twitter)

`ui/index.html` contains static OG/Twitter tags. All absolute URLs come from one
build-time value, `VITE_PUBLIC_URL` (absolute origin, no trailing slash):

```bash
VITE_PUBLIC_URL=https://<domain> pnpm build
```

- Set `VITE_PUBLIC_URL` in the Netlify/Vercel/Docker build environment before building.
- The card image is `ui/public/og-image.png` (1200x630 PNG, ~39 KB). The Vite
  config serves this overlay in dev and copies it into `ui/dist` on build, so it
  is published at the site root as `/og-image.png`.
- Verify after deploy: `curl -I https://<domain>/og-image.png` must return
  `200`, `Content-Type: image/png` and `Content-Length` under 5 MB.

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
