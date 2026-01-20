import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 5173;
const DEFAULT_HOST = "0.0.0.0";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "client");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const decodePath = (url) => {
  try {
    return decodeURIComponent(url);
  } catch {
    return null;
  }
};

export const getContentType = (filePath) =>
  MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";

export const resolveAssetPath = (url) => {
  const sanitized = decodePath(url.split("?")[0].split("#")[0]);
  if (!sanitized) {
    return null;
  }
  const relative = sanitized === "/" ? "/index.html" : sanitized;
  const resolved = resolve(ROOT, `.${relative}`);
  if (!resolved.startsWith(ROOT)) {
    return null;
  }
  return resolved;
};

export const createStaticServer = ({ port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) => {
  const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.end("Method Not Allowed");
      return;
    }

    const path = resolveAssetPath(req.url ?? "/");
    if (!path) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    try {
      const contents = await readFile(path);
      res.statusCode = 200;
      res.setHeader("Content-Type", getContentType(path));
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(contents);
    } catch (error) {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  return {
    server,
    listen: () =>
      new Promise((resolvePromise) => {
        server.listen(port, host, () => {
          resolvePromise(server.address());
        });
      })
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, listen } = createStaticServer({
    port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,
    host: process.env.HOST ?? DEFAULT_HOST
  });

  listen().then((address) => {
    const host = typeof address === "string" ? address : address?.address ?? DEFAULT_HOST;
    const port = typeof address === "string" ? "" : address?.port ?? DEFAULT_PORT;
    const suffix = port ? `:${port}` : "";
    console.log(`Serving demo at http://${host}${suffix}`);
  });

  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
