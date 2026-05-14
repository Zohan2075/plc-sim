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

Notes:

- This is intentionally a *minimal* server: it only serves static UI files and a health check.
- Future work can add APIs/WebSockets for multi-user sessions without changing the engine.
