import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { env, SESSION_COOKIE } from "./config/env.js";
import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { browseRouter } from "./routes/browse.js";
import { socialRouter } from "./routes/social.js";
import { chatRouter } from "./routes/chat.js";
import { notificationsRouter } from "./routes/notifications.js";
import { datesRouter } from "./routes/dates.js";
import { createSocketServer } from "./sockets/index.js";

mkdirSync(path.resolve(env.UPLOAD_DIR), { recursive: true });

const app = express();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

const PgSession = connectPgSimple(session);

app.set("io", io);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    name: SESSION_COOKIE,
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR), { fallthrough: false }));

app.get("/", (_req, res) => {
  res.redirect(env.CLIENT_URL);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/browse", browseRouter);
app.use("/api/social", socialRouter);
app.use("/api/chat", chatRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/dates", datesRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "JSON invalide." });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  },
);

httpServer.listen(env.PORT, () => {
  console.log(`Matcha API on http://localhost:${env.PORT}`);
});
