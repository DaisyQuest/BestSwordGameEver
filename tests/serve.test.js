import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "node:http";
import { pathToFileURL } from "node:url";
import {
  createStaticServer,
  formatServeAddress,
  getContentType,
  isDirectRun,
  maybeRunCliServer,
  resolveAssetPath,
  resolveCliOptions,
  runCliServer
} from "../scripts/serve.js";

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

    const sharedResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/shared/demo/demoSession.js"
    });

    expect(sharedResponse.res.statusCode).toBe(200);
    expect(sharedResponse.res.headers["content-type"]).toContain("text/javascript");
    expect(sharedResponse.data).toContain("createDemoSession");

    const missingResponse = await collectResponse({
      host: "127.0.0.1",
      port: address.port,
      path: "/missing"
    });

    expect(missingResponse.res.statusCode).toBe(404);
  });

  it("serves the index page when the request url is missing", async () => {
    const serverBundle = createStaticServer({ port: 0 });
    server = serverBundle.server;
    await serverBundle.listen();

    const response = await new Promise((resolvePromise) => {
      const headers = {};
      const res = {
        statusCode: 0,
        setHeader: (key, value) => {
          headers[key.toLowerCase()] = value;
        },
        end: (data = "") => {
          resolvePromise({
            statusCode: res.statusCode,
            headers,
            data: Buffer.isBuffer(data) ? data.toString("utf-8") : data
          });
        }
      };

      server.emit("request", { method: "GET", url: undefined }, res);
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.data).toContain("Training Grounds Demo");
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
    const sharedResolved = resolveAssetPath("/shared/demo/demoSession.js");
    expect(sharedResolved).toContain("shared");
    expect(resolveAssetPath("/../secret")).toBeNull();
    expect(resolveAssetPath("/shared/../client/index.html")).toBeNull();
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

  it("detects direct runs across platforms", () => {
    const entry = "/workspace/BestSwordGameEver/scripts/serve.js";
    const metaUrl = pathToFileURL(entry).href;

    expect(isDirectRun(metaUrl, entry)).toBe(true);
    expect(isDirectRun(metaUrl, "/workspace/BestSwordGameEver/scripts/other.js")).toBe(false);
    expect(isDirectRun(metaUrl, "C:\\workspace\\BestSwordGameEver\\scripts\\serve.js")).toBe(false);

    const windowsEntry = "C:\\workspace\\BestSwordGameEver\\scripts\\serve.js";
    const windowsMeta = pathToFileURL(windowsEntry).href;
    expect(isDirectRun(windowsMeta, windowsEntry)).toBe(true);
  });

  it("returns false when argv is missing", () => {
    expect(isDirectRun("file:///workspace/BestSwordGameEver/scripts/serve.js", null)).toBe(false);
  });

  it("runs the CLI server only when invoked directly", () => {
    const run = vi.fn(() => ({ server: null, ready: Promise.resolve() }));
    const entry = "/workspace/BestSwordGameEver/scripts/serve.js";
    const metaUrl = pathToFileURL(entry).href;

    expect(maybeRunCliServer({ metaUrl, argv1: entry, run })).toEqual({
      server: null,
      ready: expect.any(Promise)
    });
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    expect(maybeRunCliServer({ metaUrl, argv1: "/workspace/BestSwordGameEver/scripts/other.js", run })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("resolves CLI defaults from environment and formats addresses", () => {
    const originalPort = process.env.PORT;
    const originalHost = process.env.HOST;

    process.env.PORT = "0";
    process.env.HOST = "127.0.0.1";

    const resolved = resolveCliOptions();
    expect(resolved).toEqual({ port: 0, host: "127.0.0.1" });

    process.env.PORT = "";
    delete process.env.HOST;

    expect(resolveCliOptions()).toEqual({ port: 5173, host: "0.0.0.0" });

    expect(formatServeAddress("demo-socket", resolved)).toBe("http://demo-socket");
    expect(formatServeAddress({ address: "127.0.0.1", port: 4321 }, resolved)).toBe("http://127.0.0.1:4321");
    expect(formatServeAddress(null, resolved)).toBe("http://127.0.0.1");

    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
    if (originalHost === undefined) {
      delete process.env.HOST;
    } else {
      process.env.HOST = originalHost;
    }
  });

  it("runs the CLI server and exits on SIGINT", async () => {
    let signalHandler;
    let exitCode;
    let resolveExit;
    const logs = [];
    const exitPromise = new Promise((resolvePromise) => {
      resolveExit = resolvePromise;
    });

    const cliServer = runCliServer({
      host: "127.0.0.1",
      port: 0,
      log: (message) => logs.push(message),
      onSignal: (handler) => {
        signalHandler = handler;
      },
      exit: (code) => {
        exitCode = code;
        resolveExit(code);
      }
    });
    server = cliServer.server;

    await cliServer.ready;

    expect(signalHandler).toBeTypeOf("function");
    expect(logs[0]).toMatch(/Serving demo at http:\/\/127\.0\.0\.1:\d+/);

    signalHandler();
    await exitPromise;
    expect(exitCode).toBe(0);

    server = null;
  });
});
