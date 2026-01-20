import { afterEach, describe, expect, it } from "vitest";
import { request } from "node:http";
import { createStaticServer, getContentType, resolveAssetPath } from "../scripts/serve.js";

const collectResponse = (options) =>
  new Promise((resolvePromise) => {
    const req = request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolvePromise({ res, data });
      });
    });
    req.end();
  });

describe("serve", () => {
  let server;
  let address;

  afterEach(async () => {
    if (server) {
      await new Promise((resolvePromise) => server.close(resolvePromise));
      server = null;
    }
  });

  it("serves files from the client directory", async () => {
    const serverBundle = createStaticServer({ port: 0 });
    server = serverBundle.server;
    address = await serverBundle.listen();

    const { res, data } = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/"
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(data).toContain("Training Grounds Demo");
  });

  it("serves styles and handles missing files", async () => {
    const serverBundle = createStaticServer({ port: 0 });
    server = serverBundle.server;
    address = await serverBundle.listen();

    const styleResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/styles.css"
    });

    expect(styleResponse.res.statusCode).toBe(200);
    expect(styleResponse.res.headers["content-type"]).toContain("text/css");

    const missingResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/missing"
    });

    expect(missingResponse.res.statusCode).toBe(404);
  });

  it("rejects unsupported methods and traversal attempts", async () => {
    const serverBundle = createStaticServer({ port: 0 });
    server = serverBundle.server;
    address = await serverBundle.listen();

    const methodResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      method: "POST",
      path: "/"
    });

    expect(methodResponse.res.statusCode).toBe(405);
    expect(methodResponse.res.headers.allow).toContain("GET");

    const traversalResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/../package.json"
    });

    expect(traversalResponse.res.statusCode).toBe(404);
  });

  it("resolves asset paths and content types", () => {
    expect(getContentType("index.html")).toBe("text/html; charset=utf-8");
    expect(getContentType("styles.css")).toBe("text/css; charset=utf-8");
    expect(getContentType("main.js")).toBe("text/javascript; charset=utf-8");
    expect(getContentType("file.bin")).toBe("application/octet-stream");

    const resolved = resolveAssetPath("/index.html");
    expect(resolved).toContain("client");
    expect(resolveAssetPath("/../secret")).toBeNull();
    expect(resolveAssetPath("/%E0%A4%A")).toBeNull();
  });

  it("returns no body for HEAD requests", async () => {
    const serverBundle = createStaticServer({ port: 0 });
    server = serverBundle.server;
    address = await serverBundle.listen();

    const { res, data } = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      method: "HEAD",
      path: "/"
    });

    expect(res.statusCode).toBe(200);
    expect(data).toBe("");
  });
});
