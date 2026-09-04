import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { Server } from "socket.io";

import { initDatabase } from "./config/database.js";
import { env, isProd } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { registerSocket } from "./socket/index.js";
import { expireStaleRooms } from "./services/roomService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDatabase();

expireStaleRooms();

setInterval(expireStaleRooms, 60_000);

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = env.clientUrl
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || !isProd) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(apiLimiter);

// ==========================
// API
// ==========================

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "screenshare",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);

// ==========================
// FRONTEND REACT
// ==========================

const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDist));

// React Router fallback
app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/socket.io")
  ) {
    next();
    return;
  }

  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) {
      next(err);
    }
  });
});

// ==========================
// ERROR HANDLER
// ==========================

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[error]", err.message);

    res.status(500).json({
      error: "Erro interno do servidor.",
    });
  }
);

// ==========================
// HTTP + SOCKET.IO
// ==========================

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: isProd ? allowedOrigins : true,
    credentials: true,
  },

  pingInterval: 20_000,
  pingTimeout: 25_000,
  maxHttpBufferSize: 1e6,
});

registerSocket(io);

// ==========================
// SERVER
// ==========================

// Render fornece process.env.PORT.
// Localmente usamos env.port como fallback.

const PORT = Number(process.env.PORT) || env.port;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Screenshare server listening on port ${PORT}`);
});