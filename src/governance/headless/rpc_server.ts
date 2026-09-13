import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { chmodSync, rmSync } from "node:fs";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

const MAX_BODY_BYTES = 1024 * 1024;

export interface GovernanceRpcHandlers {
  execute?: (params: unknown) => unknown | Promise<unknown>;
  status?: () => unknown | Promise<unknown>;
  shutdown?: () => unknown | Promise<unknown>;
}

export interface GovernanceRpcServer {
  server: Server;
  get listening(): boolean;
  close(): Promise<void>;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

function reply(
  res: ServerResponse,
  id: unknown,
  payload: Record<string, unknown>,
): void {
  const body = JSON.stringify({ jsonrpc: "2.0", id, ...payload });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body);
}

function methodResult(
  handlers: GovernanceRpcHandlers,
  method: string,
  params: unknown,
): { handled: boolean; result?: unknown } {
  switch (method) {
    case "initialize":
      return { handled: true, result: { protocol: "governance-rpc/1" } };
    case "execute":
      return { handled: true, result: handlers.execute?.(params) };
    case "status":
      return { handled: true, result: handlers.status?.() };
    case "shutdown":
      return { handled: true, result: handlers.shutdown?.() };
    default:
      return { handled: false };
  }
}

/**
 * JSON-RPC 2.0 server over a unix socket for headless governance control.
 * `initialize` answers with the protocol marker, `execute`/`status` delegate
 * to the injected handlers, and `shutdown` resolves after the server closes.
 * Bodies over 1 MiB are rejected with -32600 and the socket destroyed.
 */
export async function createGovernanceRpcServer({
  socketPath,
  handlers,
}: {
  socketPath: string;
  handlers: GovernanceRpcHandlers;
}): Promise<GovernanceRpcServer> {
  const server: Server = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      let body = "";
      let oversized = false;
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
        if (body.length > MAX_BODY_BYTES) {
          oversized = true;
          // Flush the error before tearing the socket down.
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32600,
                message: "Invalid Request: body too large",
              },
            }),
            () => res.destroy(),
          );
        }
      });
      req.on("end", () => {
        if (oversized) {
          return;
        }
        let request: JsonRpcRequest;
        try {
          request = JSON.parse(body);
        } catch {
          reply(res, null, {
            error: { code: -32700, message: "Parse error" },
          });
          return;
        }
        const id = request.id ?? null;
        if (typeof request.method !== "string") {
          reply(res, id, {
            error: { code: -32600, message: "Invalid Request" },
          });
          return;
        }
        if (request.method === "shutdown") {
          reply(res, id, { result: { shuttingDown: true } });
          handlers.shutdown?.();
          server.close();
          return;
        }
        const { handled, result } = methodResult(
          handlers,
          request.method,
          request.params,
        );
        if (!handled) {
          reply(res, id, {
            error: { code: -32601, message: "Method not found" },
          });
          return;
        }
        Promise.resolve(result).then(
          (value) => reply(res, id, { result: value ?? null }),
          (error: unknown) =>
            reply(res, id, {
              error: {
                code: -32000,
                message: error instanceof Error ? error.message : String(error),
              },
            }),
        );
      });
    },
  );

  // A crashed predecessor leaves the socket file behind; node would refuse
  // to listen on it (EADDRINUSE), so clear the path first.
  rmSync(socketPath, { force: true });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });
  chmodSync(socketPath, 0o700);

  return {
    server,
    get listening(): boolean {
      return server.listening;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          rmSync(socketPath, { force: true });
          resolve();
        });
      }),
  };
}

export { DyadError, DyadErrorKind };
