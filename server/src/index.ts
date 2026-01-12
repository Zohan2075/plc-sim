import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = Number(process.env.PORT ?? 3000);
const uiDist = path.resolve(__dirname, "..", "..", "ui", "dist");

app.disable("x-powered-by");

// Serve the built UI.
app.use(express.static(uiDist));

// Basic health endpoint for deployments.
app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

// SPA fallback (for future routing).
app.get("*", (_req, res) => {
  res.sendFile(path.join(uiDist, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[plc-sim] server listening on http://localhost:${port}`);
});
