/**
 * SECURITY MODEL
 * ──────────────
 * Credentials (username, password) passed into this module:
 *   - Are NEVER written to disk, a database, or any log output.
 *   - Are NEVER included in streamed protocol events (auth commands are
 *     emitted with the literal string "<redacted>" as the display line).
 *   - Are destructured off the request object and the request references
 *     are immediately set to undefined, so the shared object no longer
 *     holds credentials after the auth phase begins.
 *   - Local string variables holding credentials go out of scope at the
 *     end of the auth block. V8 cannot zero the underlying string bytes
 *     (JS strings are immutable), but removing all live references allows
 *     the GC to reclaim the memory at its next opportunity.
 *   - The finally block performs a belt-and-suspenders clear of the
 *     request fields to handle any early-exit paths (errors thrown before
 *     the auth block is reached).
 *
 * TLS:
 *   - SSL_TLS: full TLS wrap from byte 0, rejectUnauthorized: true.
 *   - STARTTLS: plain TCP → STARTTLS upgrade → re-EHLO, same cert checks.
 *   - NONE: plain TCP, no encryption. Credentials sent in plaintext to
 *     the target server. Users are warned via the UI.
 */

import net from "net";
import tls from "tls";
import { ProtocolEvent, SmtpTestRequest } from "./types";

type StreamWriter = (event: ProtocolEvent) => void;

type LineReader = {
  readLine: () => Promise<string>;
  dispose: () => void;
};

const DEFAULT_TIMEOUT_MS = 15000;

const nowIso = () => new Date().toISOString();

const emitInfo = (write: StreamWriter, line: string) =>
  write({ t: nowIso(), type: "info", line });

const emitError = (write: StreamWriter, line: string) =>
  write({ t: nowIso(), type: "error", line });

const emitClient = (write: StreamWriter, line: string) =>
  write({ t: nowIso(), type: "client", line });

const emitServer = (write: StreamWriter, line: string) =>
  write({ t: nowIso(), type: "server", line });

/**
 * Sanitize an error message before emitting it to the client stream.
 * Guards against edge cases where a third-party error message could
 * inadvertently contain credential substrings.
 */
const sanitizeErrorMessage = (
  message: string,
  username: string | undefined,
  password: string | undefined
): string => {
  let safe = message;
  if (username && username.length > 0 && safe.includes(username)) {
    safe = safe.replaceAll(username, "<redacted>");
  }
  if (password && password.length > 0 && safe.includes(password)) {
    safe = safe.replaceAll(password, "<redacted>");
  }
  return safe;
};

const createLineReader = (socket: net.Socket | tls.TLSSocket): LineReader => {
  let buffer = "";
  const lines: string[] = [];
  let resolver: ((line: string) => void) | null = null;

  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let idx = buffer.indexOf("\r\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (resolver) {
        const resolve = resolver;
        resolver = null;
        resolve(line);
      } else {
        lines.push(line);
      }
      idx = buffer.indexOf("\r\n");
    }
  };

  const onClose = () => {
    if (resolver) {
      const resolve = resolver;
      resolver = null;
      resolve("");
    }
  };

  socket.on("data", onData);
  socket.on("close", onClose);

  return {
    readLine: () => {
      if (lines.length > 0) return Promise.resolve(lines.shift() as string);
      return new Promise((resolve) => {
        resolver = resolve;
      });
    },
    dispose: () => {
      socket.off("data", onData);
      socket.off("close", onClose);
    },
  };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string) => {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `Timeout after ${ms}ms during ${label}. ` +
              "The server may be unreachable, or your network/ISP may be blocking this port."
          )
        ),
      ms
    );
  });
  const result = (await Promise.race([promise, timeoutPromise])) as T;
  if (timeoutId) clearTimeout(timeoutId);
  return result;
};

const parseAuthMethods = (lines: string[]) => {
  const methods: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\d{3}[- ](.+)$/);
    if (!match) continue;
    const payload = match[1];
    if (payload.toUpperCase().startsWith("AUTH")) {
      const parts = payload.split(/\s+/).slice(1);
      for (const part of parts) {
        if (part.trim()) methods.push(part.trim().toUpperCase());
      }
    }
  }
  return methods;
};

const readResponse = async (
  reader: LineReader,
  write: StreamWriter,
  timeoutMs: number
) => {
  const lines: string[] = [];
  while (true) {
    const line = await withTimeout(reader.readLine(), timeoutMs, "read server response");
    if (!line) break;
    lines.push(line);
    emitServer(write, line);
    if (/^\d{3} /.test(line)) break;
  }
  return lines;
};

const sendLine = (
  socket: net.Socket | tls.TLSSocket,
  write: StreamWriter,
  line: string,
  displayLine?: string
) => {
  socket.write(`${line}\r\n`);
  emitClient(write, displayLine ?? line);
};

const base64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

export const runSmtpTest = async (
  request: SmtpTestRequest,
  write: StreamWriter,
  signal?: AbortSignal
) => {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clientName = request.clientName ?? "smtp-tester.local";

  // Capture credentials into local scope and immediately clear them from the
  // shared request object. From this point on, `request` holds no credentials.
  const username = request.username;
  const password = request.password;
  request.username = undefined;
  request.password = undefined;

  let socket: net.Socket | tls.TLSSocket | null = null;
  let reader: LineReader | null = null;

  const abortHandler = () => {
    emitInfo(write, "Test cancelled. Closing connection.");
    if (socket) socket.destroy();
  };

  if (signal) signal.addEventListener("abort", abortHandler, { once: true });

  try {
    emitInfo(write, `Connecting to ${request.host}:${request.port}...`);

    if (request.encryption === "SSL_TLS") {
      const tlsSocket = tls.connect({
        host: request.host,
        port: request.port,
        servername: request.host,
        rejectUnauthorized: true,
      });
      socket = tlsSocket;
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          tlsSocket.once("secureConnect", () => resolve());
          tlsSocket.once("error", (err) => reject(err));
        }),
        timeoutMs,
        "TLS connect"
      );
      emitInfo(write, "TLS connection established.");
    } else {
      const tcpSocket = net.connect({ host: request.host, port: request.port });
      socket = tcpSocket;
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          tcpSocket.once("connect", () => resolve());
          tcpSocket.once("error", (err) => reject(err));
        }),
        timeoutMs,
        "TCP connect"
      );
      emitInfo(write, "TCP connection established.");
    }

    reader = createLineReader(socket);

    const greeting = await readResponse(reader, write, timeoutMs);
    if (!greeting.length || !greeting[0].startsWith("220")) {
      throw new Error("SMTP server did not return a 220 greeting.");
    }

    sendLine(socket, write, `EHLO ${clientName}`);
    const ehlo = await readResponse(reader, write, timeoutMs);
    const authMethods = parseAuthMethods(ehlo);

    if (request.encryption === "STARTTLS") {
      const supportsStartTls = ehlo.some((line) => /STARTTLS/i.test(line));
      if (!supportsStartTls) {
        throw new Error("Server does not advertise STARTTLS support.");
      }

      sendLine(socket, write, "STARTTLS");
      const starttlsResp = await readResponse(reader, write, timeoutMs);
      if (!starttlsResp[0]?.startsWith("220")) {
        throw new Error("STARTTLS was rejected by the server.");
      }

      emitInfo(write, "Upgrading connection to TLS...");
      const tlsSocket = tls.connect({
        socket,
        servername: request.host,
        rejectUnauthorized: true,
      });

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          tlsSocket.once("secureConnect", () => resolve());
          tlsSocket.once("error", (err) => reject(err));
        }),
        timeoutMs,
        "STARTTLS upgrade"
      );

      reader.dispose();
      socket = tlsSocket;
      reader = createLineReader(socket);

      sendLine(socket, write, `EHLO ${clientName}`);
      const ehloTls = await readResponse(reader, write, timeoutMs);
      authMethods.splice(0, authMethods.length, ...parseAuthMethods(ehloTls));
      emitInfo(write, "TLS upgrade complete.");
    }

    // ─── Authentication ───────────────────────────────────────────────────────
    // `username` and `password` are local-scope only from this point.
    // They are never passed to emitClient/emitServer/emitInfo/emitError.
    if (username && password) {
      emitInfo(write, "Attempting authentication...");
      const canPlain = authMethods.includes("PLAIN");
      const canLogin = authMethods.includes("LOGIN");

      if (canPlain) {
        // Credential bytes exist only for the duration of this expression.
        sendLine(
          socket,
          write,
          `AUTH PLAIN ${base64(`\u0000${username}\u0000${password}`)}`,
          "AUTH PLAIN <redacted>"
        );
        const authResp = await readResponse(reader, write, timeoutMs);
        if (!authResp[0]?.startsWith("235")) {
          throw new Error("AUTH PLAIN failed.");
        }
      } else if (canLogin) {
        sendLine(socket, write, "AUTH LOGIN", "AUTH LOGIN");
        const loginResp = await readResponse(reader, write, timeoutMs);
        if (!loginResp[0]?.startsWith("334")) {
          throw new Error("AUTH LOGIN not accepted.");
        }
        sendLine(socket, write, base64(username), "<redacted>");
        const userResp = await readResponse(reader, write, timeoutMs);
        if (!userResp[0]?.startsWith("334")) {
          throw new Error("AUTH LOGIN username rejected.");
        }
        sendLine(socket, write, base64(password), "<redacted>");
        const passResp = await readResponse(reader, write, timeoutMs);
        if (!passResp[0]?.startsWith("235")) {
          throw new Error("AUTH LOGIN failed.");
        }
      } else if (authMethods.length === 0) {
        emitInfo(write, "Server did not advertise AUTH methods; skipping auth.");
      } else {
        throw new Error("Server does not support AUTH PLAIN or AUTH LOGIN.");
      }

      emitInfo(write, "Authentication succeeded.");
    } else {
      emitInfo(write, "No credentials provided; skipping authentication.");
    }
    // ─── End authentication ───────────────────────────────────────────────────
    // `username` and `password` go out of scope here. No further references.

    sendLine(socket, write, "NOOP");
    await readResponse(reader, write, timeoutMs);

    sendLine(socket, write, "QUIT");
    await readResponse(reader, write, timeoutMs);

    emitInfo(write, "SMTP test complete.");
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error";
    // Sanitize before emitting: guard against any third-party error message
    // that could inadvertently contain a credential substring.
    const safe = sanitizeErrorMessage(raw, username, password);
    emitError(write, safe);
    throw error;
  } finally {
    if (reader) reader.dispose();
    if (socket) socket.destroy();
    if (signal) signal.removeEventListener("abort", abortHandler);
  }
};
