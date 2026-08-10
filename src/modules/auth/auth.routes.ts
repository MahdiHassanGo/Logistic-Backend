import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  loginController,
  logoutController,
  meController,
  refreshController
} from "./auth.controller.js";
import { loginSchema, refreshSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/login", validate({ body: loginSchema }), loginController);
authRouter.post("/refresh", validate({ body: refreshSchema }), refreshController);
authRouter.post("/logout", authenticate, logoutController);
authRouter.get("/me", authenticate, meController);
