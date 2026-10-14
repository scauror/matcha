import type { Server as HttpServer } from "node:http";
import { parse as parseCookie } from "cookie";
import signature from "cookie-signature";
import { Server } from "socket.io";
import { env, SESSION_COOKIE } from "../config/env.js";
import { query } from "../db/pool.js";
import { areMatched, isBlockedEitherWay } from "../db/social.js";

let ioRef: Server | null = null;

function sessionIdFromCookie(header: string | undefined): string | null {
  if (!header) return null;
  const cookies = parseCookie(header);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  if (raw.startsWith("s:")) {
    const unsigned = signature.unsign(raw.slice(2), env.SESSION_SECRET);
    return unsigned || null;
  }
  return raw;
}

async function canCall(a: string, b: string): Promise<boolean> {
  if (!b || a === b) return false;
  if (await isBlockedEitherWay(a, b)) return false;
  return areMatched(a, b);
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });
  ioRef = io;

  io.use(async (socket, next) => {
    try {
      const sid = sessionIdFromCookie(socket.handshake.headers.cookie);
      if (!sid) {
        next(new Error("unauthorized"));
        return;
      }
      const { rows } = await query<{ sess: { userId?: string } | string }>(
        `SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()`,
        [sid],
      );
      const raw = rows[0]?.sess;
      const sess = typeof raw === "string" ? (JSON.parse(raw) as { userId?: string }) : raw;
      const userId = sess?.userId;
      if (!userId) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.userId = userId;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    const forward = (event: string) => {
      socket.on(event, async (payload: Record<string, unknown>) => {
        const toUserId = typeof payload?.toUserId === "string" ? payload.toUserId : "";
        if (!(await canCall(userId, toUserId))) return;
        const { toUserId: _ignored, ...rest } = payload;
        emitToUser(toUserId, event, { ...rest, fromUserId: userId });
      });
    };

    forward("call:invite");
    forward("call:accept");
    forward("call:offer");
    forward("call:answer");
    forward("call:ice");
    forward("call:hangup");
    forward("call:reject");

    socket.on("disconnect", () => {
      // presence handled later
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

export type AppSocketServer = ReturnType<typeof createSocketServer>;
