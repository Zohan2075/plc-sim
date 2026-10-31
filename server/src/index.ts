import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = Number(process.env.PORT ?? 3000);
const uiDist = path.resolve(__dirname, "..", "..", "ui", "dist");
const hasUiDist = existsSync(path.join(uiDist, "index.html"));

app.disable("x-powered-by");

// Serve the built UI when running as the all-in-one host (local/Docker).
// Vercel's Express service is API-only and does not ship ui/dist.
if (hasUiDist) {
  app.use(express.static(uiDist));
}

// Basic health endpoints for deployments.
function health(_req: express.Request, res: express.Response): void {
  res.status(200).type("text/plain").send("ok");
}

app.get("/healthz", health);

// Public path exposed by the Vercel `/api/(.*)` rewrite.
app.get("/api/healthz", health);

// SPA fallback (for future routing), only when the UI build is present.
if (hasUiDist) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(uiDist, "index.html"));
  });
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[plc-sim] server listening on http://localhost:${port}`);
});
