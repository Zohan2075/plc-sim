import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
// This repo's public root is ../data (it also serves program-data/, settings/
// and tag-data/). ui/public is an overlay for static metadata assets such as
// the social card; it is served in dev and copied into dist on build.
const dataDirectory = fileURLToPath(new URL("../data", import.meta.url));
const uiPublicDirectory = fileURLToPath(new URL("./public", import.meta.url));
const distDirectory = fileURLToPath(new URL("./dist", import.meta.url));

function uiPublicOverlay(): Plugin {
  const contentTypes: Record<string, string> = {
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  };

  return {
    name: "ui-public-overlay",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");

        if (!url || url === "/") {
          next();
          return;
        }

        const filePath = path.join(uiPublicDirectory, url);

        if (!filePath.startsWith(uiPublicDirectory) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        const contentType = contentTypes[path.extname(filePath).toLowerCase()];

        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }

        createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      if (existsSync(uiPublicDirectory)) {
        cpSync(uiPublicDirectory, distDirectory, { recursive: true });
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, uiRoot, "");
  const rawPublicUrl = process.env.VITE_PUBLIC_URL ?? env.VITE_PUBLIC_URL;
  const publicUrl = (rawPublicUrl ?? "http://localhost:5173").replace(/\/+$/, "");

  if (!rawPublicUrl) {
    console.warn("[seo] VITE_PUBLIC_URL is not set; OG/Twitter URLs fall back to http://localhost:5173");
  }

  if (!/^https?:\/\//.test(publicUrl)) {
    throw new Error(`VITE_PUBLIC_URL must be an absolute http(s) URL, got: ${publicUrl}`);
  }

  return {
    plugins: [
      react(),
      uiPublicOverlay(),
      {
        name: "inject-public-url",
        transformIndexHtml(html) {
          return html.replaceAll("__PUBLIC_URL__", publicUrl);
        }
      }
    ],
    publicDir: dataDirectory,
    server: {
      fs: {
        allow: [workspaceRoot]
      },
      port: 5173
    }
  };
});
