import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validateBody(authController.registerSchema), authController.register);
authRouter.post("/login", authLimiter, validateBody(authController.loginSchema), authController.login);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
