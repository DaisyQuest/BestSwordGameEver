import { describe, expect, it } from "vitest";
import { request } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const collectResponse = (options) =>
  new Promise((resolvePromise, rejectPromise) => {
    const req = request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolvePromise({ res, data });
      });
    });
    req.on("error", (error) => {
      rejectPromise(error);
    });
    req.end();
  });

const waitForOutput = (childProcess, regex, timeoutMs = 5000) =>
  new Promise((resolvePromise, rejectPromise) => {
    let buffer = "";
    let resolved = false;

    const handleData = (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(regex);
      if (match) {
        resolved = true;
        cleanup();
        resolvePromise(match);
      }
    };

    const handleExit = (code) => {
      if (!resolved) {
        cleanup();
        rejectPromise(new Error(`Demo server exited early with code ${code}. Output: ${buffer}`));
      }
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      rejectPromise(new Error(`Timed out waiting for demo server output. Output: ${buffer}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      childProcess.stdout?.off("data", handleData);
      childProcess.stderr?.off("data", handleData);
      childProcess.off("exit", handleExit);
    };

    childProcess.stdout?.on("data", handleData);
    childProcess.stderr?.on("data", handleData);
    childProcess.on("exit", handleExit);
  });

const waitForExit = (childProcess) =>
  new Promise((resolvePromise) => {
    if (childProcess.exitCode !== null) {
      resolvePromise(childProcess.exitCode);
      return;
    }
    childProcess.once("exit", (code) => {
      resolvePromise(code ?? 0);
    });
  });

describe("demo server integration", () => {
  it("boots via the CLI entrypoint and serves the demo", async () => {
    const scriptPath = resolve("scripts/serve.js");
    const childProcess = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "0"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    try {
      const match = await waitForOutput(childProcess, /http:\/\/([\d.]+):(\d+)/);
      const port = Number(match[2]);

      const { res, data } = await collectResponse({
        host: "127.0.0.1",
        port,
        path: "/"
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(data).toContain("Training Grounds Demo");
    } finally {
      childProcess.kill("SIGINT");
      await waitForExit(childProcess);
    }
  });
});
