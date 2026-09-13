import http from "node:http";
import { chmodSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGovernanceRpcServer,
  type GovernanceRpcServer,
} from "./rpc_server";

const isPosix = process.platform !== "win32";

function rpc(
  socketPath: string,
  body: string | object,
): Promise<{ status: number; payload: any }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      // agent:false — a pooled keep-alive socket from a previously closed
      // server instance would surface as EPIPE on the next test's request.
      {
        socketPath,
        method: "POST",
        path: "/",
        agent: false,
        headers: { "content-type": "application/json" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            payload: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        });
      },
    );
    request.on("error", reject);
    request.end(typeof body === "string" ? body : JSON.stringify(body));
  });
}

describe.skipIf(!isPosix)("governance RPC server", () => {
  const dir = mkdtempSync(join(tmpdir(), "gov-rpc-"));
  const socketPath = join(dir, "gov.sock");
  let server: GovernanceRpcServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("answers initialize/status/execute and records handler calls", async () => {
    const execute = vi.fn(async (params: unknown) => ({ echoed: params }));
    const status = vi.fn(() => ({ state: "idle" }));
    server = await createGovernanceRpcServer({
      socketPath,
      handlers: { execute, status },
    });

    chmodSync(socketPath, 0o600);
    const init = await rpc(socketPath, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });
    expect(init.payload).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { protocol: "governance-rpc/1" },
    });

    const statusReply = await rpc(socketPath, {
      jsonrpc: "2.0",
      id: 2,
      method: "status",
    });
    expect(statusReply.payload.result).toEqual({ state: "idle" });
    expect(status).toHaveBeenCalledTimes(1);

    const executed = await rpc(socketPath, {
      jsonrpc: "2.0",
      id: 3,
      method: "execute",
      params: { n: 1 },
    });
    expect(execute).toHaveBeenCalledWith({ n: 1 });
    expect(executed.payload.result).toEqual({ echoed: { n: 1 } });
  });

  it("creates the socket with owner-only permissions", async () => {
    server = await createGovernanceRpcServer({ socketPath, handlers: {} });
    const mode = statSync(socketPath).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it("rejects unknown methods with -32601", async () => {
    server = await createGovernanceRpcServer({ socketPath, handlers: {} });
    const reply = await rpc(socketPath, {
      jsonrpc: "2.0",
      id: 9,
      method: "teleport",
    });
    expect(reply.payload.error.code).toBe(-32601);
  });

  it("rejects malformed JSON with -32700", async () => {
    server = await createGovernanceRpcServer({ socketPath, handlers: {} });
    const reply = await rpc(socketPath, "{not json");
    expect(reply.payload.error.code).toBe(-32700);
  });

  it("rejects oversized bodies with -32600 and closes the connection", async () => {
    server = await createGovernanceRpcServer({ socketPath, handlers: {} });
    const huge = JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "status",
      pad: "x".repeat(1024 * 1024 + 1),
    });
    // The server flushes the -32600 reply and then tears the socket down; a
    // client still mid-upload sees the teardown (EPIPE/ECONNRESET) instead.
    const outcome = await rpc(socketPath, huge).then(
      (reply) => reply.payload.error.code as number,
      (error: NodeJS.ErrnoException) => {
        expect(["EPIPE", "ECONNRESET"]).toContain(error.code);
        return -32600;
      },
    );
    expect(outcome).toBe(-32600);
  });

  it("shuts down on the shutdown method", async () => {
    const shutdown = vi.fn();
    server = await createGovernanceRpcServer({
      socketPath,
      handlers: { shutdown },
    });
    const reply = await rpc(socketPath, {
      jsonrpc: "2.0",
      id: 12,
      method: "shutdown",
    });
    expect(reply.payload.result).toEqual({ shuttingDown: true });
    expect(shutdown).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(server?.listening).toBe(false);
    });
    server = undefined;
  });
});
