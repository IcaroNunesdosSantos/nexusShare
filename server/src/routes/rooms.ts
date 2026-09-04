import { Router } from "express";
import * as roomController from "../controllers/roomController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { joinLimiter } from "../middleware/rateLimit.js";

export const roomsRouter = Router();

roomsRouter.get("/ice", requireAuth, roomController.iceConfig);
roomsRouter.post("/", requireAuth, roomController.createRoom);
roomsRouter.get("/:code", optionalAuth, joinLimiter, roomController.getRoom);
roomsRouter.post("/:code/end", requireAuth, roomController.endRoom);
