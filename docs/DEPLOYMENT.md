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

Notes:

- This is intentionally a *minimal* server: it only serves static UI files and a health check.
- Future work can add APIs/WebSockets for multi-user sessions without changing the engine.
